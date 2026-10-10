export interface AttachedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface CitationReference {
  id: number;
  title: string;
  authors: string;
  year: number;
  venue: string;
  doi?: string;
  url?: string;
}

export interface ResearchReport {
  id: string;
  title: string;
  generatedAt: string;
  query: string;
  executiveSummary: string;
  methodology: string;
  findings: string[];
  comparisons: {
    baseline: string;
    proposed: string;
    delta: string;
  }[];
  limitations: string;
  citations: CitationReference[];
}

export interface ResearchMessage {
  id: string;
  role: 'user' | 'assistant' | 'agent-status';
  content: string;
  timestamp: string;
  attachments?: AttachedDocument[];
  reportId?: string;
  agentId?: string;
  agentName?: string;
}

export interface ResearchSession {
  id: string;
  title: string;
  createdAt: string;
  query: string;
  documents: AttachedDocument[];
  messages: ResearchMessage[];
  report?: ResearchReport;
  status: 'idle' | 'orchestrating' | 'researching' | 'synthesizing' | 'completed' | 'halted';
  activeAgentId?: string;
}
