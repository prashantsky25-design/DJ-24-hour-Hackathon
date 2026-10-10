/**
 * usePipelineSimulator
 *
 * When a research query is submitted, this hook drives the agent states
 * sequentially so the PipelineExecutionModal shows progressive reveal
 * even when no real backend is running (demo/simulator mode).
 *
 * Sequence:
 *   user-node (instant) → orchestrator → paper-reader → dynamic-spawner
 *   → coding-agent → sandbox-executor → debugging-agent → drafter-agent
 *
 * Each agent spends ~2-4s in 'running' state before transitioning to 'retired'.
 * The next agent activates while the previous is completing.
 */

import { useCallback, useRef } from 'react';
import { AgentNodeData } from '../types/agent';
import { TerminalLogEntry } from '../types/log';
import type { QueryPlan } from '../services/intentRouter';

const SEQUENCE: {
  id: string;
  durationMs: number;
  task: string;
  logs: string[];
}[] = [
  {
    id: 'orchestrator',
    durationMs: 2800,
    task: 'Decomposing research brief into 4 task nodes...',
    logs: [
      '[Orchestrator] Received research brief. Decomposing into task DAG...',
      '[Orchestrator] PapersWithCode check: hypothesis is novel ✓',
      '[Orchestrator] Spawning Paper Reader and Task Planner sub-agents.',
    ],
  },
  {
    id: 'paper-reader',
    durationMs: 3200,
    task: 'GPT-4o Vision extracting architecture diagrams from PDF...',
    logs: [
      '[Paper Reader] Downloading paper PDF...',
      '[Paper Reader] GPT-4o Vision: analyzing architecture diagram on page 3...',
      '[Paper Reader] Extracted: KANLayer(784→64→10), grid_size=5, AdamW lr=1e-3',
      '[Paper Reader] Architecture notes written to session context ✓',
    ],
  },
  {
    id: 'dynamic-spawner',
    durationMs: 2200,
    task: 'Spawning Coding Agent and Sandbox Executor sub-tasks...',
    logs: [
      '[Task Planner] Citations extracted: 3 relevant papers found.',
      '[Task Planner] Allocating: CodingAgent → task_2, SandboxExecutor → task_3',
      '[Task Planner] Task DAG committed to memory. Sub-agents spawned.',
    ],
  },
  {
    id: 'coding-agent',
    durationMs: 4000,
    task: 'Synthesising train.py with KAN layer implementation...',
    logs: [
      '[Coding Agent] Writing train.py based on paper architecture...',
      '[Coding Agent] Implementing KANLayer with learnable spline activations...',
      '[Coding Agent] Git commit: "feat: initial KAN train.py" (a7f3b89)',
      '[Coding Agent] Sending code to E2B sandbox for execution.',
    ],
  },
  {
    id: 'sandbox-executor',
    durationMs: 5000,
    task: 'Git-gated execution in E2B sandbox (commit a7f3b89)...',
    logs: [
      '[E2B] Sandbox created. Template: python3, timeout: 300s',
      '[E2B] Installing: torch==2.2.0 numpy scikit-learn...',
      '[stdout] Epoch 01/05 | Train: 0.412 | Val: 0.387 | Acc: 88.2% | 810 smp/s',
      '[stdout] Epoch 02/05 | Train: 0.298 | Val: 0.271 | Acc: 91.4% | 824 smp/s',
      '[stdout] Epoch 03/05 | Train: 0.241 | Val: 0.224 | Acc: 92.8% | 819 smp/s',
      '[E2B] Execution status: SUCCESS. Exit code: 0',
    ],
  },
  {
    id: 'debugging-agent',
    durationMs: 3000,
    task: 'Audit: verifying metrics and git-gated state...',
    logs: [
      '[Self-Healer] Reviewing execution logs for anomalies...',
      '[Self-Healer] Metric sanity check: val_loss monotone ✓',
      '[Self-Healer] Git-gated state: clean tree, no uncommitted changes ✓',
      '[Self-Healer] Handing off to Drafter Agent.',
    ],
  },
  {
    id: 'drafter-agent',
    durationMs: 2500,
    task: 'Generating IEEE-format LaTeX report draft...',
    logs: [
      '[Drafter] Rendering IEEE LaTeX template...',
      '[Drafter] Inserting metrics: KAN val_loss=0.224, accuracy=92.8%',
      '[Drafter] Baseline comparison: MLP val_loss=1.09 → Δ-79.4%',
      '[Drafter] Report compiled: report.pdf (14 pages, 5 citations) ✓',
      '[System] Pipeline complete. All agents retired.',
    ],
  },
];

type SetAgentsFn = React.Dispatch<React.SetStateAction<AgentNodeData[]>>;
type SetLogsFn   = React.Dispatch<React.SetStateAction<TerminalLogEntry[]>>;

function makeLog(message: string, source: TerminalLogEntry['source'] = 'system'): TerminalLogEntry {
  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleTimeString(),
    source,
    level: message.includes('ERROR') || message.includes('error') ? 'error'
         : message.includes('warn')  ? 'warn'
         : 'info',
    message,
  };
}

type SequenceStep = (typeof SEQUENCE)[number];

/** Wording used when the plan is NOT a full code experiment. */
function lightweightOverride(id: string, plan: QueryPlan): Partial<SequenceStep> | undefined {
  switch (id) {
    case 'orchestrator':
      return plan.intent === 'chat'
        ? {
            durationMs: 1200,
            task: 'Reading message — no sub-agents required.',
            logs: [
              '[Orchestrator] Classified request as direct conversation.',
              '[Orchestrator] No research agents needed. Replying directly.',
              '[System] Pipeline complete. No agents were spawned.',
            ],
          }
        : {
            durationMs: 2200,
            task: `Routing request as "${plan.label}"...`,
            logs: [
              `[Orchestrator] Classified request as: ${plan.label}.`,
              `[Orchestrator] Spawning ${plan.agentIds.length - 1} agent(s): ${plan.agentIds.slice(1).join(' → ')}.`,
              '[Orchestrator] Skipping code execution and sandbox — not required.',
            ],
          };
    case 'paper-reader':
      return {
        durationMs: 3000,
        task: 'Retrieving and reading relevant sources...',
        logs: [
          '[Paper Reader] Searching literature for the research question...',
          '[Paper Reader] Extracting key claims and citations from sources.',
          '[Paper Reader] Notes written to session context ✓',
        ],
      };
    case 'dynamic-spawner':
      return {
        durationMs: 2000,
        task: 'Structuring the analysis outline...',
        logs: [
          '[Task Planner] Outlining sections from extracted notes.',
          '[Task Planner] Handing outline to Drafter Agent.',
        ],
      };
    case 'drafter-agent':
      return {
        durationMs: 2500,
        task: 'Writing the research summary...',
        logs: [
          '[Drafter] Composing summary from gathered sources...',
          '[Drafter] Formatting citations.',
          '[Drafter] Report compiled ✓',
          '[System] Pipeline complete. All agents retired.',
        ],
      };
    default:
      return undefined;
  }
}

/** Build the ordered list of steps to animate for a given plan. */
export function buildSequence(plan?: QueryPlan): SequenceStep[] {
  if (!plan) return SEQUENCE;
  return plan.agentIds
    .map(id => SEQUENCE.find(s => s.id === id))
    .filter((s): s is SequenceStep => Boolean(s))
    .map(step =>
      plan.intent === 'experiment' ? step : { ...step, ...lightweightOverride(step.id, plan) },
    );
}

/** Total simulated duration for a plan (ms). */
export function planDurationMs(plan?: QueryPlan): number {
  return buildSequence(plan).reduce((sum, s) => sum + s.durationMs, 0);
}

export function usePipelineSimulator(
  setAgents: SetAgentsFn,
  setLogs?: SetLogsFn,
) {
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancel = useCallback(() => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }, []);

  const start = useCallback((plan?: QueryPlan) => {
    cancel();

    // Initial system log
    if (setLogs) {
      setLogs(prev => [...prev, makeLog('[System] Pipeline started. Initialising agent cluster...', 'system')]);
    }

    let elapsed = 0;

    buildSequence(plan).forEach(({ id, durationMs, task, logs }) => {
      // Activate agent
      const activateTimer = setTimeout(() => {
        setAgents(prev =>
          prev.map(ag =>
            ag.id === id
              ? { ...ag, status: 'running', currentTask: task, lastActive: 'Just now' }
              : ag
          )
        );
      }, elapsed);
      timerRefs.current.push(activateTimer);

      // Drip logs for this agent while it's running
      logs.forEach((msg, i) => {
        const logTimer = setTimeout(() => {
          if (!setLogs) return;
          const source: TerminalLogEntry['source'] =
            msg.startsWith('[stdout]') ? 'stdout' :
            msg.startsWith('[stderr]') ? 'stderr' :
            msg.startsWith('[E2B]')    ? 'sandbox' :
            msg.startsWith('[System]') ? 'system' :
            'agent';
          setLogs(prev => [...prev.slice(-300), makeLog(msg.replace(/^\[(stdout|stderr|E2B|System)\] /, ''), source)]);
        }, elapsed + Math.floor((durationMs / (logs.length + 1)) * (i + 1)));
        timerRefs.current.push(logTimer);
      });

      // Complete agent
      const completeTimer = setTimeout(() => {
        setAgents(prev =>
          prev.map(ag =>
            ag.id === id
              ? {
                  ...ag,
                  status: 'retired',
                  currentTask: task.replace('...', ' ✓'),
                  lastActive: 'Just now',
                  tokensUsed: ag.tokensUsed + Math.floor(Math.random() * 8000 + 2000),
                  toolCallsCount: ag.toolCallsCount + Math.floor(Math.random() * 5 + 1),
                  runtimeSec: ag.runtimeSec + Math.floor(durationMs / 1000),
                }
              : ag
          )
        );
      }, elapsed + durationMs);
      timerRefs.current.push(completeTimer);

      elapsed += durationMs;
    });

    return elapsed;
  }, [cancel, setAgents, setLogs]);

  return { start, cancel };
}
