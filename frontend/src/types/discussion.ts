export interface AgentDiscussionMessage {
  id: string;
  session_id: string;
  agent_name: string;
  agent_role: string;
  message_type: 'decision' | 'action' | 'critique' | 'approval' | 'plan' | 'research' | 'draft' | 'analysis' | 'info' | 'warning' | 'success';
  content: string;
  confidence: number;
  reply_to?: string;
  timestamp: string;
}

