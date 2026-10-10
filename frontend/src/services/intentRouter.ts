/**
 * intentRouter
 *
 * Looks at what the user asked and decides which agents (and therefore which
 * workflow) are actually needed, instead of always running the full
 * experiment pipeline.
 *
 *   chat        -> orchestrator only (direct reply, no report)
 *   literature  -> orchestrator -> paper-reader -> drafter
 *   paper       -> orchestrator -> paper-reader -> task planner -> drafter
 *   experiment  -> full pipeline (coding, sandbox, self-healer, drafter)
 */

export type QueryIntent = 'chat' | 'literature' | 'paper' | 'experiment';

export interface QueryPlan {
  intent: QueryIntent;
  /** Short human readable name shown in the UI. */
  label: string;
  /** Agent ids (in execution order) that take part in this plan. */
  agentIds: string[];
  /** Direct answer for `chat` intent. */
  reply?: string;
}

const EXPERIMENT_AGENTS = [
  'orchestrator',
  'paper-reader',
  'dynamic-spawner',
  'coding-agent',
  'sandbox-executor',
  'debugging-agent',
  'drafter-agent',
];

const GREETING_RE =
  /^(hi+|hello+|hey+|yo|hola|namaste|thanks?|thank you|ok(ay)?|cool|good (morning|afternoon|evening|night)|how are you|who are you|what can you do|help|test|testing)\b/i;

const EXPERIMENT_RE =
  /\b(train|training|implement|implementation|code|coding|run|experiment|benchmark|loss|accuracy|hypothes[ie]s|optimi[sz]e|optimi[sz]ation|modify|fine-?tune|reproduce|learning rate|sandbox|gpu|layer|ablation|prototype|simulate)\b/i;

const PAPER_RE = /\b(paper|pdf|arxiv|doi|attached|document|this study)\b|https?:\/\//i;

export function classifyQuery(query: string, attachmentCount = 0): QueryPlan {
  const text = query.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const hasExperiment = EXPERIMENT_RE.test(text);
  const hasPaper = attachmentCount > 0 || PAPER_RE.test(text);

  // Small talk: greeting or very short message with no research signal.
  const looksLikeChat =
    !hasExperiment &&
    !hasPaper &&
    attachmentCount === 0 &&
    (GREETING_RE.test(text) || words.length <= 2);

  if (looksLikeChat) {
    const asksCapabilities = /what can you do|who are you|help/i.test(text);
    return {
      intent: 'chat',
      label: 'Direct response',
      agentIds: ['orchestrator'],
      reply: asksCapabilities
        ? 'I am ARES, an autonomous research assistant. I can survey literature, read papers you attach, and run code experiments in a sandbox, then write up the results. Describe a research question and I will only spin up the agents it needs.'
        : 'Hi! I am ARES. Ask me a research question, attach a paper, or describe an experiment you would like to run, and I will route it to the right agents.',
    };
  }

  if (hasExperiment) {
    return { intent: 'experiment', label: 'Experiment pipeline', agentIds: EXPERIMENT_AGENTS };
  }

  if (hasPaper) {
    return {
      intent: 'paper',
      label: 'Paper analysis',
      agentIds: ['orchestrator', 'paper-reader', 'dynamic-spawner', 'drafter-agent'],
    };
  }

  return {
    intent: 'literature',
    label: 'Literature review',
    agentIds: ['orchestrator', 'paper-reader', 'drafter-agent'],
  };
}

