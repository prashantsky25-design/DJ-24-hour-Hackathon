import React from 'react';
import { AgentStatus } from '../../types/agent';

interface StatusBadgeProps {
  status: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showPulse = true,
}) => {
  const configs: Record<
    AgentStatus,
    { label: string; bg: string; text: string; dot: string; border: string }
  > = {
    idle: {
      label: 'IDLE',
      bg: 'bg-slate-800/80',
      text: 'text-slate-300',
      dot: 'bg-slate-400',
      border: 'border-slate-700/60',
    },
    spawning: {
      label: 'SPAWNING',
      bg: 'bg-amber-950/50',
      text: 'text-amber-300',
      dot: 'bg-amber-400',
      border: 'border-amber-600/50',
    },
    running: {
      label: 'RUNNING',
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
      border: 'border-emerald-500/50',
    },
    retired: {
      label: 'RETIRED',
      bg: 'bg-purple-950/40',
      text: 'text-purple-300',
      dot: 'bg-purple-400',
      border: 'border-purple-600/40',
    },
    error: {
      label: 'ERROR',
      bg: 'bg-rose-950/60',
      text: 'text-rose-300',
      dot: 'bg-rose-400',
      border: 'border-rose-600/50',
    },
  };

  const c = configs[status] || configs.idle;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${c.bg} ${c.text} ${c.border} ${sizeClasses[size]} tracking-wider uppercase shadow-xs`}
    >
      <span className="relative flex h-2 w-2">
        {showPulse && (status === 'running' || status === 'spawning') && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${c.dot}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot}`} />
      </span>
      {c.label}
    </span>
  );
};
