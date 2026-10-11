import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AgentNodeData } from '../../types/agent';
import { StatusBadge } from '../common/StatusBadge';
import {
  Cpu, Eye, FileCode2, Sparkles, Bug, FileText, Radio, Server, Zap,
} from 'lucide-react';

/* ── icon map ───────────────────────────────────────────── */
const AGENT_ICONS: Record<string, React.ReactNode> = {
  'orchestrator':      <Sparkles  className="w-4 h-4" style={{ color: '#818cf8' }} />,
  'paper-reader':      <Eye       className="w-4 h-4" style={{ color: '#fbbf24' }} />,
  'literature-scout':  <Eye       className="w-4 h-4" style={{ color: '#fbbf24' }} />,
  'dynamic-spawner':   <Zap       className="w-4 h-4" style={{ color: '#22d3ee' }} />,
  'hypothesis-engine': <Zap       className="w-4 h-4" style={{ color: '#22d3ee' }} />,
  'arxiv-radar':       <Radio     className="w-4 h-4" style={{ color: '#c084fc' }} />,
  'coding-agent':      <FileCode2 className="w-4 h-4" style={{ color: '#34d399' }} />,
  'debugging-agent':   <Bug       className="w-4 h-4" style={{ color: '#fb7185' }} />,
  'critic-agent':      <Bug       className="w-4 h-4" style={{ color: '#fb7185' }} />,
  'drafter-agent':     <FileText  className="w-4 h-4" style={{ color: '#60a5fa' }} />,
  'sandbox-executor':  <Server    className="w-4 h-4" style={{ color: '#2dd4bf' }} />,
};

/* ── status → border / glow colours ────────────────────── */
const STATUS_STYLE: Record<
  string,
  { border: string; glow: string; bg: string }
> = {
  running:   { border: '#10b981', glow: 'rgba(16,185,129,0.28)', bg: 'rgba(16,185,129,0.04)' },
  spawning:  { border: '#f59e0b', glow: 'rgba(245,158,11,0.25)', bg: 'rgba(245,158,11,0.04)' },
  completed: { border: '#10b981', glow: 'rgba(16,185,129,0.15)', bg: 'rgba(16,185,129,0.03)' },
  retired:   { border: '#8b5cf6', glow: 'rgba(139,92,246,0.18)', bg: 'rgba(139,92,246,0.03)' },
  error:     { border: '#ef4444', glow: 'rgba(239,68,68,0.22)',  bg: 'rgba(239,68,68,0.04)'  },
  idle:      { border: 'var(--border)', glow: 'none', bg: 'transparent' },
};

function fmtK(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

/* ── component ──────────────────────────────────────────── */
export const CustomAgentNode: React.FC<NodeProps> = ({ data, selected }) => {
  const agent = data as unknown as AgentNodeData;
  const isLive = agent.status === 'running' || agent.status === 'spawning';
  const st = STATUS_STYLE[agent.status] ?? STATUS_STYLE.idle;
  const icon = AGENT_ICONS[agent.id] ?? <Cpu className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />;

  return (
    <div
      className="relative w-60 rounded-2xl border transition-all duration-300"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: selected ? 'var(--accent)' : st.border,
        boxShadow: selected
          ? `0 0 0 2px var(--accent), 0 4px 20px ${st.glow}`
          : isLive
          ? `0 0 0 1.5px ${st.border}, 0 4px 20px ${st.glow}`
          : '0 2px 8px rgba(0,0,0,0.07)',
      }}
    >
      {/* Live pulse ring — outer glow layer */}
      {isLive && (
        <div
          className="absolute -inset-[3px] rounded-2xl pointer-events-none"
          style={{
            border: `1.5px solid ${st.border}`,
            opacity: 0.5,
            animation: 'node-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !rounded-full !border-2"
        style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--surface)' }}
      />

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="p-1.5 rounded-lg border shrink-0"
            style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h4 className="text-[11px] font-bold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
              {agent.name}
            </h4>
            <span className="text-[9px] block truncate font-mono leading-tight" style={{ color: 'var(--text-muted)' }}>
              {agent.role}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge status={agent.status} size="sm" />
        </div>
      </div>

      {/* ── Active task ── */}
      <div className="px-3 py-2">
        <div
          className="rounded-lg px-2.5 py-2 text-[10px] leading-snug min-h-[38px] flex items-start border"
          style={{
            backgroundColor: isLive ? st.bg : 'var(--surface-secondary)',
            borderColor: isLive ? st.border : 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {isLive && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-1 mr-1.5"
              style={{
                backgroundColor: st.border,
                animation: 'node-pulse 1.4s ease-in-out infinite',
              }}
            />
          )}
          <span className="line-clamp-2 font-mono">
            {agent.currentTask || 'Idle — awaiting orchestrator dispatch'}
          </span>
        </div>
      </div>

      {/* ── Metric footer ── */}
      <div
        className="flex items-center justify-between px-3 pb-3 text-[9px] font-mono"
        style={{ color: 'var(--text-muted)' }}
      >
        <span title="Tokens used">{fmtK(agent.tokensUsed || 0)} tok</span>
        <span className="opacity-40">·</span>
        <span title="Tool calls">{agent.toolCallsCount || 0} tools</span>
        <span className="opacity-40">·</span>
        <span title="Runtime">{agent.runtimeSec || 0}s</span>
        {agent.lastActive && (
          <>
            <span className="opacity-40">·</span>
            <span className="truncate max-w-[48px]" title="Last active">{agent.lastActive}</span>
          </>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !rounded-full !border-2"
        style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--surface)' }}
      />

      {/* Keyframe injected once per node instance */}
      <style>{`
        @keyframes node-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
};
