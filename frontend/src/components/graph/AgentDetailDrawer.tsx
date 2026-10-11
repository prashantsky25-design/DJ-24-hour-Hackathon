import React from 'react';
import { AgentNodeData } from '../../types/agent';
import { StatusBadge } from '../common/StatusBadge';
import {
  X,
  Clock,
  Wrench,
  CheckCircle,
  FileCode,
  PlayCircle,
  Hash,
  Layers,
  Zap,
} from 'lucide-react';

interface AgentDetailDrawerProps {
  agent: AgentNodeData | null;
  onClose: () => void;
  onTriggerTask?: (agentId: string) => void;
}

export const AgentDetailDrawer: React.FC<AgentDetailDrawerProps> = ({
  agent,
  onClose,
  onTriggerTask,
}) => {
  if (!agent) return null;

  const subtasks       = agent.details?.subtasksCompleted ?? 1;
  const totalSubtasks  = agent.details?.totalSubtasks ?? 1;
  const progressPct    = Math.min(100, Math.round((subtasks / totalSubtasks) * 100));
  const isLive         = agent.status === 'running' || agent.status === 'spawning';

  return (
    <>
      {/* dim the canvas behind the drawer */}
      <div
        className="absolute inset-0 z-30"
        style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}
        onClick={onClose}
      />

      {/* Drawer panel — slides in from the right edge of the graph container */}
      <div
        className="absolute inset-y-0 right-0 z-40 flex flex-col overflow-hidden"
        style={{
          width: 'min(320px, 100%)',
          backgroundColor: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
          style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="min-w-0 flex-1">
            <span
              className="text-[10px] font-mono font-semibold uppercase tracking-wider block"
              style={{ color: 'var(--accent)' }}
            >
              Agent Inspector
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <h3
                className="text-sm font-bold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {agent.name}
              </h3>
              {isLive && (
                <span className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-semibold text-emerald-500 uppercase">Live</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg shrink-0 ml-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

          {/* Status + Model row */}
          <div
            className="rounded-xl border p-3 space-y-2"
            style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Lifecycle State</span>
              <StatusBadge status={agent.status} size="md" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Backing Model</span>
              <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                {agent.details?.model || 'LLM Agent'}
              </span>
            </div>
          </div>

          {/* Current task */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
              Active Sub-Task
            </label>
            <div
              className="p-2.5 rounded-lg border text-xs leading-relaxed font-mono"
              style={{
                backgroundColor: isLive ? 'rgba(99,102,241,0.04)' : 'var(--code-bg)',
                borderColor: isLive ? 'var(--accent)' : 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              {agent.currentTask || 'Idle — awaiting dispatch from Orchestrator.'}
            </div>
          </div>

          {/* Sub-task progress */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              <span>Sub-Task Progress</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                {subtasks}/{totalSubtasks} ({progressPct}%)
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, var(--accent), #10b981)',
                }}
              />
            </div>
          </div>

          {/* Telemetry grid */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Telemetry
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Hash className="w-3 h-3" style={{ color: 'var(--accent)' }} />, label: 'Tokens', value: `${(agent.tokensUsed / 1000).toFixed(1)}k` },
                { icon: <Clock className="w-3 h-3 text-amber-500" />, label: 'Runtime', value: `${agent.runtimeSec}s` },
                { icon: <Wrench className="w-3 h-3 text-emerald-500" />, label: 'Tools', value: String(agent.toolCallsCount) },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-2 rounded-lg border text-center"
                  style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
                >
                  <div className="flex justify-center mb-0.5">{m.icon}</div>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                  <div className="text-xs font-bold font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active file */}
          {agent.details?.activeFile && (
            <div
              className="p-2.5 rounded-lg border flex items-center justify-between text-xs"
              style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{agent.details.activeFile}</span>
              </div>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider"
                style={{ backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}
              >
                Sandbox
              </span>
            </div>
          )}

          {/* Architecture role */}
          <div
            className="p-2.5 rounded-lg border text-xs leading-relaxed"
            style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
          >
            <div className="font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              <CheckCircle className="w-3 h-3" style={{ color: 'var(--accent)' }} />
              Architecture Role
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              {agent.details?.description || 'Autonomous agent module in the ARES multi-agent network.'}
            </p>
          </div>

          {/* Role badges */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { icon: <Layers className="w-2.5 h-2.5" />, label: agent.role },
              { icon: <Zap className="w-2.5 h-2.5" />, label: `Last active: ${agent.lastActive || 'N/A'}` },
            ].map(({ icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-mono"
                style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {icon} {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Footer action ── */}
        <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-secondary)' }}>
          <button
            onClick={() => onTriggerTask?.(agent.id)}
            className="w-full py-2 px-4 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Trigger Dedicated Sub-Task Run
          </button>
        </div>
      </div>
    </>
  );
};
