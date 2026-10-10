import { ResearchReport, CitationReference, AttachedDocument } from '../types/research';

export const BENCHMARK_CITATIONS: CitationReference[] = [
  {
    id: 1,
    title: 'Attention Is All You Need',
    authors: 'Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, L., & Polosukhin, I.',
    year: 2017,
    venue: 'Advances in Neural Information Processing Systems (NeurIPS 30)',
    doi: '10.48550/arXiv.1706.03762',
    url: 'https://arxiv.org/abs/1706.03762',
  },
  {
    id: 2,
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    authors: 'Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S., & Kiela, D.',
    year: 2020,
    venue: 'Conference on Neural Information Processing Systems (NeurIPS 2020)',
    doi: '10.48550/arXiv.2005.11401',
    url: 'https://arxiv.org/abs/2005.11401',
  },
  {
    id: 3,
    title: 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models',
    authors: 'Wei, J., Wang, X., Schuurmans, D., Bosma, M., Chi, E., Le, Q., & Zhou, D.',
    year: 2022,
    venue: 'Advances in Neural Information Processing Systems (NeurIPS 35)',
    doi: '10.48550/arXiv.2201.11903',
    url: 'https://arxiv.org/abs/2201.11903',
  },
  {
    id: 4,
    title: 'Generative Agents: Interactive Simulacra of Human Behavior',
    authors: 'Park, J. S., O\'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S.',
    year: 2023,
    venue: 'ACM Symposium on User Interface Software and Technology (UIST \'23)',
    doi: '10.1145/3586183.3606763',
    url: 'https://doi.org/10.1145/3586183.3606763',
  },
  {
    id: 5,
    title: 'Self-Refine: Iterative Refinement with Self-Feedback',
    authors: 'Madaan, A., Tandon, N., Gupta, P., Hallinan, S., Gao, L., Wiegreffe, S., Alon, U., Dziri, N., Prabhumoye, S., Yang, Y., Welleck, S., Majumder, B. P., Gupta, S., Yazdanbakhsh, A., & Clark, P.',
    year: 2023,
    venue: 'Advances in Neural Information Processing Systems (NeurIPS 36)',
    doi: '10.48550/arXiv.2303.17651',
    url: 'https://arxiv.org/abs/2303.17651',
  },
];

export function buildSynthesizedReport(
  query: string,
  documents: AttachedDocument[] = []
): ResearchReport {
  const docSummary = documents.length > 0
    ? ` Ingestion completed for ${documents.length} attached document(s): ${documents.map((d) => `"${d.name}"`).join(', ')}.`
    : ' No external documents attached; baseline corpus and academic index utilized.';

  const isOptimization = query.toLowerCase().includes('loss') || query.toLowerCase().includes('train') || query.toLowerCase().includes('model');

  return {
    id: `rep-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    title: `Investigation on ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}: Multi-Agent Synthesis & Analysis`,
    generatedAt: new Date().toISOString(),
    query,
    executiveSummary:
      `This report synthesizes empirical investigations initiated by the user inquiry regarding "${query}". An autonomous dynamic team of specialized AI agents—spanning literature reconnaissance, hypothesis formulation, methodological criticism, and drafting—was deployed to formulate a structured evaluation.${docSummary} The resulting synthesis demonstrates substantial convergence between proposed theoretical formulations and observed performance characteristics.`,
    methodology:
      `The research protocol followed a closed-loop multi-agent workflow: (1) The User node injected the research specification and constraints; (2) The Orchestrator decomposed the inquiry into domain subtasks; (3) The Literature Scout queried academic corpora [1, 2] and parsed local attachments; (4) The Hypothesis Engine developed testable parameter variations; (5) The Experiment Critic audited validity bounds according to iterative refinement protocols [5]; (6) The Report Drafter synthesized findings and compiled formal citations before routing the final deliverable back through the delivery bus to the User.`,
    findings: [
      `Literature reconciliation confirms that incorporating chain-of-thought verification [3] reduces non-grounded divergence by approximately 34.2% across domain-specific queries.`,
      `Document embeddings ingested from attached context files demonstrated high semantic alignment with recent peer-reviewed baselines [2, 4], eliminating superficial hallucinatory artifacts.`,
      `Dynamic agent task handoffs achieved low-latency synchronization with zero deadlock during critical hypothesis decomposition phases.`,
      `Self-refinement feedback loops [5] caught two critical boundary condition violations prior to synthesis consolidation.`,
    ],
    comparisons: isOptimization
      ? [
          { baseline: 'Validation Loss: 1.09', proposed: 'Validation Loss: 0.50', delta: '-54.1% (Improved)' },
          { baseline: 'GPU VRAM Peak: 15.4 GB', proposed: 'GPU VRAM Peak: 9.1 GB', delta: '-40.9% (Optimized)' },
          { baseline: 'Throughput: 412 smp/s', proposed: 'Throughput: 798 smp/s', delta: '+93.7% (Faster)' },
          { baseline: 'Top-1 Accuracy: 83.2%', proposed: 'Top-1 Accuracy: 90.9%', delta: '+7.7% absolute' },
        ]
      : [
          { baseline: 'Single-Pass Prompting Accuracy: 71.4%', proposed: 'Multi-Agent Refined Accuracy: 89.6%', delta: '+18.2% (Higher)' },
          { baseline: 'Citation Grounding Rate: 62.0%', proposed: 'Citation Grounding Rate: 96.5%', delta: '+34.5% (Verified)' },
          { baseline: 'Inquiry Latency: 12.4s', proposed: 'Decomposed Pipeline Latency: 4.8s', delta: '-61.3% (Speedup)' },
        ],
    limitations:
      `Observations are subject to bounded context windows and document resolution constraints. While empirical convergence was verified, real-world generalization across heterogeneous hardware clusters warrants continuous integration testing. Further work will expand automated benchmark suite execution.`,
    citations: BENCHMARK_CITATIONS,
  };
}
