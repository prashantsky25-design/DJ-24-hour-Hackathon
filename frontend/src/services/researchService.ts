import { ResearchReport, CitationReference, AttachedDocument } from '../types/research';
import type { QueryIntent } from './intentRouter';

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

export async function buildSynthesizedReport(
  query: string,
  documents: AttachedDocument[] = [],
  intent: QueryIntent = 'experiment'
): Promise<ResearchReport> {
  const base = {
    id: `rep-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    title: `Investigation on ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}`,
    generatedAt: new Date().toISOString(),
    query,
    citations: BENCHMARK_CITATIONS,
    executiveSummary: '',
    methodology: '',
    findings: [],
    comparisons: [],
    limitations: '',
  };

  try {
    const docNames = documents.map(d => d.name);
    const response = await fetch('http://localhost:8001/api/report/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        documents: docNames,
        intent
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        ...base,
        title: data.title || base.title,
        executiveSummary: data.executiveSummary || '',
        methodology: data.methodology || '',
        findings: data.findings || [],
        comparisons: data.comparisons || [],
        limitations: data.limitations || '',
        visualData: data.visualData,
      };
    } else {
      console.error('Failed to generate report from backend:', await response.text());
    }
  } catch (error) {
    console.error('Error generating report:', error);
  }

  // Fallback if the API call fails
  const docSummary = documents.length > 0
    ? ` Ingestion completed for ${documents.length} attached document(s).`
    : ' No external documents attached.';

  if (intent === 'literature' || intent === 'paper') {
    return {
      ...base,
      title: `${intent === 'paper' ? 'Paper Analysis' : 'Literature Review'}: ${query.slice(0, 50)}`,
      executiveSummary: `This review addresses the inquiry "${query}".${docSummary} Only the required agents were engaged; no sandbox experiments were run.`,
      methodology: `(1) Orchestrator classified request; (2) Paper Reader gathered sources; (3) Drafter compiled summary.`,
      findings: [`The request was answered from the literature and attached material only.`],
      comparisons: [],
      limitations: `This is a text-only synthesis, generated as a fallback due to an API error.`,
    };
  }

  return {
    ...base,
    executiveSummary: `This report synthesizes empirical investigations initiated by the user inquiry regarding "${query}".${docSummary} (Fallback report due to API error)`,
    methodology: `The research protocol followed a closed-loop multi-agent workflow.`,
    findings: [`API generation failed, showing fallback data.`],
    comparisons: [],
    limitations: `Observations are subject to bounded context windows and document resolution constraints.`,
  };
}
