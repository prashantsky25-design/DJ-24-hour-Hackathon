import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { User, FileText, Send, Sparkles } from 'lucide-react';

export interface UserNodeData {
  label: string;
  role: string;
  activeQuery?: string;
  attachedDocsCount?: number;
  status: 'idle' | 'active' | 'reviewing';
}

export const UserNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as UserNodeData;
  const isActive = nodeData.status === 'active';
  const isReviewing = nodeData.status === 'reviewing';

  return (
    <div
      className={`relative w-72 rounded-2xl border p-4 transition-all duration-200 shadow-xl ${
        selected
          ? 'ring-2 ring-indigo-500'
          : isActive
          ? 'border-indigo-500 shadow-indigo-500/20'
          : isReviewing
          ? 'border-emerald-500 shadow-emerald-500/20'
          : 'border-[var(--border)]'
      }`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
      }}
    >
      {/* Target handle receiving synthesized research report from Report Delivery Node */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 rounded-full border-2"
        style={{
          backgroundColor: '#10B981',
          borderColor: 'var(--surface)',
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
            style={{
              backgroundColor: 'var(--accent)',
            }}
          >
            <User className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Human Researcher
            </h4>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
              Client Initiator & Evaluator
            </span>
          </div>
        </div>

        <span
          className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border"
          style={{
            backgroundColor: isActive
              ? 'rgba(79, 70, 229, 0.15)'
              : isReviewing
              ? 'rgba(16, 185, 129, 0.15)'
              : 'var(--surface-secondary)',
            borderColor: isActive ? 'var(--accent)' : isReviewing ? '#10B981' : 'var(--border)',
            color: isActive ? 'var(--accent)' : isReviewing ? '#10B981' : 'var(--text-secondary)',
          }}
        >
          {isActive ? 'Query Active' : isReviewing ? 'Report Delivered' : 'Ready'}
        </span>
      </div>

      {/* Query Status */}
      <div className="mt-3">
        <div
          className="p-2.5 rounded-xl border text-[11px] leading-relaxed"
          style={{
            backgroundColor: 'var(--surface-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {nodeData.activeQuery ? (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-indigo-500 block">
                Dispatched Research Inquiry:
              </span>
              <p className="line-clamp-2 italic">
                "{nodeData.activeQuery}"
              </p>
            </div>
          ) : (
            <span className="italic" style={{ color: 'var(--text-secondary)' }}>
              Awaiting research question or document upload...
            </span>
          )}
        </div>
      </div>

      {/* Attachments & Flow Info */}
      <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] font-mono" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3 text-indigo-400" />
          {nodeData.attachedDocsCount || 0} docs attached
        </span>
        <span className="flex items-center gap-1">
          <Send className="w-3 h-3 text-emerald-400" />
          Feedback Loop Active
        </span>
      </div>

      {/* Source handle dispatching query to Orchestrator */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 rounded-full border-2"
        style={{
          backgroundColor: 'var(--accent)',
          borderColor: 'var(--surface)',
        }}
      />
    </div>
  );
};
