export type AgentStatus = 'idle' | 'spawning' | 'running' | 'completed' | 'retired' | 'error';

export interface AgentNodeData {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask?: string;
  tokensUsed: number;
  runtimeSec: number;
  toolCallsCount: number;
  lastActive?: string;
  details?: {
    model: string;
    description: string;
    activeFile?: string;
    subtasksCompleted: number;
    totalSubtasks: number;
  };
  [key: string]: unknown;
}

export interface AgentSummary {
  total: number;
  running: number;
  spawning: number;
  idle: number;
  retired: number;
}
