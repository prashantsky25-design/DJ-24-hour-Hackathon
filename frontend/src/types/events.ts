import { AgentNodeData } from './agent';
import { TerminalLogEntry, ReasoningStep } from './log';
import { MetricPoint, ExperimentMetadata } from './metric';

export type AresEventType =
  | 'agent_state_changed'
  | 'log_chunk'
  | 'reasoning_step'
  | 'metric_point'
  | 'execution_status'
  | 'steering_ack'
  | 'git_event'
  | 'initial_state';

export interface AresEvent<T = unknown> {
  type: AresEventType;
  timestamp: string;
  payload: T;
}

export interface AgentStateChangedPayload {
  agentId: string;
  status: AgentNodeData['status'];
  currentTask?: string;
  tokensUsed?: number;
  runtimeSec?: number;
  toolCallsCount?: number;
}

export interface ExecutionStatusPayload {
  status: ExperimentMetadata['status'];
  message?: string;
  currentEpoch?: number;
  totalEpochs?: number;
  activeAgentsCount?: number;
}

export interface SteeringCommandPayload {
  action: 'emergency_stop' | 'pause' | 'resume' | 'what_if_prompt' | 'git_rollback' | 'start_experiment';
  prompt?: string;
  targetCommit?: string;
  params?: Record<string, unknown>;
}

export interface ConnectionConfig {
  mode: 'simulator' | 'websocket' | 'sse';
  wsUrl: string;
  sseUrl: string;
  orchestratorUrl: string;
  sandboxApiUrl: string;
  autoReconnect: boolean;
}
