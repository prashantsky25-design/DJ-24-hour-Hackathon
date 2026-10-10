import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { User, FileText, Send } from 'lucide-react';

export interface UserNodeData {
  label: string;
  role: string;
  activeQuery?: string;
  attachedDocsCount?: number;
  status: 'idle' | 'active' | 'reviewing';
}

export const UserNode: React.FC<NodeProps> = ({ data, selected }) => {
  const d = data as unknown as UserNodeData;
  const isActive    = d.status === 'active';
  const isReviewing = d.status === 'reviewing';
  const isLive      = isActive || isReviewing;

  const borderColor = selected ? 'var(--accent)'
    : isActive    ? '#6366f1'
    : isReviewing ? '#10b981'
    : 'var(--border)';

  const glowColor = isActive    ? 'rgba(99,102,241,0.25)'
    : isReviewing ? 'rgba(16,185,129,0.22)'
    : 'none';

  const statusLabel = isActive ? 'Query Active' : isReviewing ? 'Report Delivered' : 'Ready';
  const statusColor = isActive ? '#6366f1' : isReviewing ? '#10b981' : undefined;

  return (
    <div
      className="relative w-72 rounded-2xl border p-4 transition-all duration-300"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor,
        boxShadow: selected
          ? `0 0 0 2px var(--accent), 0 4px 20px ${glowColor}`
          : isLive
          ? `0 0 0 1.5px ${borderColor}, 0 4px 20px ${glowColor}`
          : '0 2px 8px rgba(0,0,0,0.07)',
      }}
    >
      {/* Live pulse ring */}
      {isLive && (
        <div
          className="absolute -inset-[3px] rounded-2xl pointer-events-none"
          style={{
            border: `1.5px solid ${borderColor}`,
            opacity: 0.45,
            animation: 'node-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !rounded-full !border-2"
        style={{ backgroundColor: '#10b981', borderColor: 'var(--surface)' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <User className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Human Researcher
            </h4>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
              Client Initiator &amp; Evaluator
            </span>
          </div>
        </div>

        <span
          className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border shrink-0"
          style={{
            backgroundColor: statusColor ? `${statusColor}18` : 'var(--surface-secondary)',
            borderColor:     statusColor ? `${statusColor}55` : 'var(--border)',
            color:           statusColor ?? 'var(--text-secondary)',
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Query display */}
      <div className="mt-3">
        <div
          className="p-2.5 rounded-xl border text-[11px] leading-relaxed"
          style={{
            backgroundColor: isActive ? 'rgba(99,102,241,0.05)' : 'var(--surface-secondary)',
            borderColor: isActive ? '#6366f180' : 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {d.activeQuery && d.activeQuery !== 'Awaiting research query…' ? (
            <div className="space-y-1">
              <span
                className="text-[9px] uppercase font-bold tracking-wider font-mono block"
                style={{ color: 'var(--accent)' }}
              >
                Dispatched Research Inquiry:
              </span>
              <p className="line-clamp-2 italic" style={{ color: 'var(--text-primary)' }}>
                "{d.activeQuery}"
              </p>
            </div>
          ) : (
            <span className="italic" style={{ color: 'var(--text-muted)' }}>
              Awaiting research question or document upload…
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] font-mono"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
      >
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" style={{ color: 'var(--accent)' }} />
          {d.attachedDocsCount || 0} docs
        </span>
        <span className="flex items-center gap-1">
          <Send className="w-3 h-3 text-emerald-500" />
          {isLive ? 'Loop active' : 'Feedback loop'}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !rounded-full !border-2"
        style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--surface)' }}
      />

      <style>{`
        @keyframes node-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.03); }
        }
      `}</style>
    </div>
  );
};
