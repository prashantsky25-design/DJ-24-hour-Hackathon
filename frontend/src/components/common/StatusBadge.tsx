import React from 'react';
import { AgentStatus } from '../../types/agent';

interface StatusBadgeProps {
  status: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

/* Semantic colors that work on both light and dark themes */
const CONFIGS: Record<
  AgentStatus,
  { label: string; dotColor: string; textColor: string; bg: string; border: string }
> = {
  idle: {
    label: 'IDLE',
    dotColor: '#94a3b8',
    textColor: '#64748b',
    bg: 'rgba(100,116,139,0.1)',
    border: 'rgba(100,116,139,0.25)',
  },
  spawning: {
    label: 'SPAWNING',
    dotColor: '#f59e0b',
    textColor: '#d97706',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.35)',
  },
  running: {
    label: 'RUNNING',
    dotColor: '#10b981',
    textColor: '#059669',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.35)',
  },
  completed: {
    label: 'DONE',
    dotColor: '#10b981',
    textColor: '#059669',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.35)',
  },
  retired: {
    label: 'RETIRED',
    dotColor: '#8b5cf6',
    textColor: '#7c3aed',
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.3)',
  },
  error: {
    label: 'ERROR',
    dotColor: '#ef4444',
    textColor: '#dc2626',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.35)',
  },
};

const SIZE = {
  sm: 'px-2 py-0.5 text-[9px] gap-1',
  md: 'px-2.5 py-1 text-[10px] gap-1.5',
  lg: 'px-3 py-1.5 text-xs gap-1.5',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showPulse = true,
}) => {
  const c = CONFIGS[status] ?? CONFIGS.idle;
  const isLive = status === 'running' || status === 'spawning';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border uppercase tracking-wider ${SIZE[size]}`}
      style={{ backgroundColor: c.bg, borderColor: c.border, color: c.textColor }}
    >
      <span className="relative flex items-center justify-center w-2 h-2 shrink-0">
        {showPulse && isLive && (
          <span
            className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping"
            style={{ backgroundColor: c.dotColor }}
          />
        )}
        <span
          className="relative inline-flex rounded-full w-1.5 h-1.5"
          style={{ backgroundColor: c.dotColor }}
        />
      </span>
      {c.label}
    </span>
  );
};
