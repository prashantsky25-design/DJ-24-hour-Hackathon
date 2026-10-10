export type LogSource = 'stdout' | 'stderr' | 'system' | 'agent' | 'pytorch' | 'sandbox';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface TerminalLogEntry {
  id: string;
  timestamp: string;
  source: LogSource;
  level: LogLevel;
  message: string;
  agentId?: string;
  runId?: string;
}

export interface ReasoningStep {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  hypothesis?: string;
  thought: string;
  action?: {
    tool: string;
    params: Record<string, unknown>;
  };
  observation?: string;
  decision?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}
