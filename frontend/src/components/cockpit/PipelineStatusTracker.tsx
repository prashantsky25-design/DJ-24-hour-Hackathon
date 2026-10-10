import React, { useMemo } from 'react';
import {
  Network,
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  Zap,
  Clock,
  Hash,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import type { AgentNodeData } from '../../types/agent';

interface PipelineStatusTrackerProps {
  agents: AgentNodeData[];
  isProcessing: boolean;
  pipelineStepMessage: string;
  onSelectAgent: (id: string) => void;
  selectedAgentId: string | null;
}

const PIPELINE_ORDER = [
  'orchestrator',
  'paper-reader',
  'dynamic-spawner',
  'coding-agent',
  'sandbox-executor',
  'debugging-agent',
  'drafter-agent',
];

type StatusKey = 'running' | 'spawning' | 'completed' | 'retired' | 'idle' | 'error';

const STATUS_CONFIG: Record<
  StatusKey,
  { icon: React.ReactNode; colorClass: string; label: string; dotColor: string }
> = {
  running: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    colorClass: 'text-amber-500',
    label: 'Running',
    dotColor: '#f59e0b',
  },
  spawning: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    colorClass: 'text-blue-500',
    label: 'Spawning',
    dotColor: '#3b82f6',
  },
  completed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    colorClass: 'text-emerald-500',
    label: 'Done',
    dotColor: '#10b981',
  },
  retired: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    colorClass: 'text-emerald-500',
    label: 'Retired',
    dotColor: '#10b981',
  },
  idle: {
    icon: <Circle className="w-3.5 h-3.5" />,
    colorClass: '',
    label: 'Idle',
    dotColor: '',
  },
  error: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    colorClass: 'text-red-500',
    label: 'Error',
    dotColor: '#ef4444',
  },
};

function fmtRuntime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const AgentRow: React.FC<{
  agent: AgentNodeData;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  prevIsDone: boolean;
  isDone: boolean;
  isActive: boolean;
  onSelect: () => void;
}> = ({ agent, isFirst, isLast, isSelected, prevIsDone, isDone, isActive, onSelect }) => {
  const cfg = STATUS_CONFIG[agent.status as StatusKey] ?? STATUS_CONFIG.idle;

  return (
    <div className="flex gap-2">
      {/* Timeline spine */}
      <div className="flex flex-col items-center w-4 shrink-0">
        {!isFirst && (
          <div
            className="w-px flex-1 min-h-[6px] transition-colors duration-500"
            style={{ backgroundColor: prevIsDone ? '#10b981' : 'var(--border)' }}
          />
        )}
        <div
          className="w-2.5 h-2.5 rounded-full border-2 shrink-0 transition-all duration-300"
          style={{
            borderColor: isActive ? '#f59e0b' : isDone ? '#10b981' : 'var(--border-strong)',
            backgroundColor: isActive
              ? 'rgba(245,158,11,0.2)'
              : isDone
              ? 'rgba(16,185,129,0.2)'
              : 'var(--surface)',
            boxShadow: isActive ? '0 0 6px rgba(245,158,11,0.5)' : undefined,
          }}
        />
        {!isLast && (
          <div
            className="w-px flex-1 min-h-[6px] transition-colors duration-500"
            style={{ backgroundColor: isDone ? '#10b981' : 'var(--border)' }}
          />
        )}
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 mb-2 rounded-lg border px-3 py-2 text-left transition-all duration-150"
        style={{
          backgroundColor: isSelected
            ? 'var(--accent-subtle)'
            : isActive
            ? 'var(--hover)'
            : 'var(--surface-secondary)',
          borderColor: isSelected
            ? 'var(--accent)'
            : isActive
            ? '#f59e0b'
            : 'var(--border)',
        }}
        onMouseEnter={(e) => {
          if (!isSelected && !isActive)
            e.currentTarget.style.backgroundColor = 'var(--hover)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected && !isActive)
            e.currentTarget.style.backgroundColor = 'var(--surface-secondary)';
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cfg.colorClass || ''} style={!cfg.colorClass ? { color: 'var(--text-muted)' } : undefined}>
              {cfg.icon}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {agent.name}
                </span>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 rounded ${cfg.colorClass}`}
                  style={!cfg.colorClass ? { color: 'var(--text-muted)' } : undefined}
                >
                  {cfg.label}
                </span>
              </div>
              {agent.currentTask && (
                <p className="text-[11px] mt-0.5 truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>
                  {agent.currentTask}
                </p>
              )}
            </div>
          </div>

          {/* Metrics */}
          {(agent.tokensUsed > 0 || agent.runtimeSec > 0 || agent.toolCallsCount > 0) && (
            <div className="flex items-center gap-2 shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {agent.runtimeSec > 0 && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />{fmtRuntime(agent.runtimeSec)}
                </span>
              )}
              {agent.tokensUsed > 0 && (
                <span className="flex items-center gap-0.5">
                  <Hash className="w-2.5 h-2.5" />{fmtTokens(agent.tokensUsed)}
                </span>
              )}
              {agent.toolCallsCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <Wrench className="w-2.5 h-2.5" />{agent.toolCallsCount}
                </span>
              )}
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

const ProgressBar: React.FC<{ done: number; total: number; isProcessing: boolean }> = ({
  done, total, isProcessing,
}) => {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <span>{done}/{total} agents complete</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: isProcessing
              ? 'linear-gradient(90deg, var(--accent), #a78bfa, var(--accent))'
              : pct === 100
              ? '#10b981'
              : 'var(--accent)',
            backgroundSize: '200% 100%',
            animation: isProcessing ? 'cockpit-shimmer 1.8s linear infinite' : 'none',
          }}
        />
      </div>
    </div>
  );
};

export const PipelineStatusTracker: React.FC<PipelineStatusTrackerProps> = ({
  agents,
  isProcessing,
  pipelineStepMessage,
  onSelectAgent,
  selectedAgentId,
}) => {
  const ordered = useMemo(() => {
    const map = new Map(agents.map((a) => [a.id, a]));
    const sorted: AgentNodeData[] = [];
    PIPELINE_ORDER.forEach((id) => { const a = map.get(id); if (a) sorted.push(a); });
    agents.forEach((a) => { if (!PIPELINE_ORDER.includes(a.id)) sorted.push(a); });
    return sorted;
  }, [agents]);

  const doneCount = ordered.filter(
    (a) => a.status === 'retired' || a.status === 'completed',
  ).length;

  const activeAgent = ordered.find(
    (a) => a.status === 'running' || a.status === 'spawning',
  );

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden h-full"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            Pipeline Tracker
          </span>
          {isProcessing && activeAgent && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 text-amber-500"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {activeAgent.name}
            </span>
          )}
        </div>
        {isProcessing && <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />}
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <ProgressBar done={doneCount} total={ordered.length} isProcessing={isProcessing} />
        {isProcessing && pipelineStepMessage && (
          <p
            className="mt-1.5 text-[10px] font-mono truncate flex items-center gap-1.5 text-amber-500"
          >
            <ArrowRight className="w-2.5 h-2.5 shrink-0" />
            {pipelineStepMessage}
          </p>
        )}
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {ordered.map((agent, idx) => {
          const prev = ordered[idx - 1];
          const prevIsDone = !!prev && (prev.status === 'retired' || prev.status === 'completed');
          const isDone = agent.status === 'retired' || agent.status === 'completed';
          const isActive = agent.status === 'running' || agent.status === 'spawning';
          return (
            <AgentRow
              key={agent.id}
              agent={agent}
              isFirst={idx === 0}
              isLast={idx === ordered.length - 1}
              isSelected={selectedAgentId === agent.id}
              prevIsDone={prevIsDone}
              isDone={isDone}
              isActive={isActive}
              onSelect={() => onSelectAgent(agent.id)}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes cockpit-shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
};
