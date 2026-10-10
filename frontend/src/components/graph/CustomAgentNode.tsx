import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AgentNodeData } from '../../types/agent';
import { StatusBadge } from '../common/StatusBadge';
import {
  Cpu,
  Eye,
  FileCode2,
  Sparkles,
  Bug,
  FileText,
  Radio,
  Server,
  Zap,
} from 'lucide-react';

export const CustomAgentNode: React.FC<NodeProps> = ({ data, selected }) => {
  const agent = data as unknown as AgentNodeData;

  const getAgentIcon = (id: string) => {
    switch (id) {
      case 'orchestrator':
        return <Sparkles className="w-4 h-4 text-indigo-400" />;
      case 'paper-reader':
      case 'literature-scout':
        return <Eye className="w-4 h-4 text-amber-400" />;
      case 'dynamic-spawner':
      case 'hypothesis-engine':
        return <Zap className="w-4 h-4 text-cyan-400" />;
      case 'arxiv-radar':
        return <Radio className="w-4 h-4 text-purple-400" />;
      case 'coding-agent':
        return <FileCode2 className="w-4 h-4 text-emerald-400" />;
      case 'debugging-agent':
      case 'critic-agent':
        return <Bug className="w-4 h-4 text-rose-400" />;
      case 'drafter-agent':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'sandbox-executor':
        return <Server className="w-4 h-4 text-teal-400" />;
      default:
        return <Cpu className="w-4 h-4 text-slate-400" />;
    }
  };

  const isRunning = agent.status === 'running';
  const isSpawning = agent.status === 'spawning';
  const isCompleted = agent.status === 'completed';

  return (
    <div
      className={`relative w-64 rounded-2xl border p-3.5 transition-all duration-200 shadow-xl ${
        selected
          ? 'ring-2 ring-indigo-500'
          : isRunning || isCompleted
          ? 'border-emerald-500 shadow-emerald-500/10'
          : isSpawning
          ? 'border-amber-500 shadow-amber-500/10'
          : 'border-[var(--border)]'
      }`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: selected
          ? 'var(--accent)'
          : isRunning || isCompleted
          ? '#10B981'
          : isSpawning
          ? '#F59E0B'
          : 'var(--border)',
      }}
    >
      {/* Top handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2.5 h-2.5 rounded-full border-2"
        style={{
          backgroundColor: 'var(--accent)',
          borderColor: 'var(--surface)',
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 truncate">
          <div
            className="p-1.5 rounded-lg border shrink-0"
            style={{
              backgroundColor: 'var(--surface-secondary)',
              borderColor: 'var(--border)',
            }}
          >
            {getAgentIcon(agent.id)}
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {agent.name}
            </h4>
            <span className="text-[10px] block truncate font-mono" style={{ color: 'var(--text-secondary)' }}>
              {agent.role}
            </span>
          </div>
        </div>
        <StatusBadge status={agent.status} size="sm" />
      </div>

      {/* Body: Active Task */}
      <div className="mt-2.5">
        <p
          className="text-[11px] line-clamp-2 leading-relaxed p-2 rounded-lg border font-sans"
          style={{
            backgroundColor: 'var(--surface-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {agent.currentTask || 'Idle awaiting orchestrator dispatch'}
        </p>
      </div>

      {/* Footer Metrics */}
      <div
        className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] font-mono"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--text-secondary)',
        }}
      >
        <span>{((agent.tokensUsed || 0) / 1000).toFixed(1)}k tok</span>
        <span>•</span>
        <span>{agent.toolCallsCount || 0} tools</span>
        <span>•</span>
        <span>{agent.runtimeSec || 0}s</span>
      </div>

      {/* Bottom handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2.5 h-2.5 rounded-full border-2"
        style={{
          backgroundColor: 'var(--accent)',
          borderColor: 'var(--surface)',
        }}
      />
    </div>
  );
};
