import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FileText, Download, CheckCircle2, Bookmark, ArrowUpRight } from 'lucide-react';

export interface ReportDeliveryNodeData {
  title?: string;
  citationsCount?: number;
  status: 'pending' | 'ready';
  onOpenReport?: () => void;
}

export const ReportDeliveryNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as ReportDeliveryNodeData;
  const isReady = nodeData.status === 'ready';

  return (
    <div
      className={`relative w-72 rounded-2xl border p-4 transition-all duration-200 shadow-xl ${
        selected
          ? 'ring-2 ring-emerald-500'
          : isReady
          ? 'border-emerald-500 shadow-emerald-500/20'
          : 'border-[var(--border)]'
      }`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: selected ? '#10B981' : isReady ? '#10B981' : 'var(--border)',
      }}
    >
      {/* Target handle receiving report from Report Drafter Agent */}
      <Handle
        type="target"
        position={Position.Bottom}
        className="w-3 h-3 rounded-full border-2"
        style={{
          backgroundColor: '#8B5CF6',
          borderColor: 'var(--surface)',
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
            style={{
              backgroundColor: isReady ? '#10B981' : '#6B7280',
            }}
          >
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Research Report
            </h4>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
              Verified Deliverable Bus
            </span>
          </div>
        </div>

        <span
          className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border"
          style={{
            backgroundColor: isReady ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-secondary)',
            borderColor: isReady ? '#10B981' : 'var(--border)',
            color: isReady ? '#10B981' : 'var(--text-secondary)',
          }}
        >
          {isReady ? 'Ready & Verified' : 'Synthesizing'}
        </span>
      </div>

      {/* Report Info */}
      <div className="mt-3">
        <div
          className="p-2.5 rounded-xl border text-[11px] leading-relaxed"
          style={{
            backgroundColor: 'var(--surface-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {isReady ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-[10px] uppercase font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Publication Synthesis Ready</span>
              </div>
              <p className="font-semibold line-clamp-2">
                {nodeData.title || 'Technical Synthesis Report'}
              </p>
              <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1">
                  <Bookmark className="w-3 h-3 text-indigo-400" />
                  {nodeData.citationsCount || 5} Formal Citations
                </span>
                <span>•</span>
                <span>PDF Ready</span>
              </div>
            </div>
          ) : (
            <span className="italic" style={{ color: 'var(--text-secondary)' }}>
              Awaiting consolidated findings from Report Drafter...
            </span>
          )}
        </div>
      </div>

      {/* Action CTA */}
      {isReady && nodeData.onOpenReport && (
        <button
          type="button"
          onClick={nodeData.onOpenReport}
          className="mt-3 w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#10B981' }}
        >
          <Download className="w-3.5 h-3.5" />
          <span>View & Download PDF</span>
          <ArrowUpRight className="w-3.5 h-3.5 ml-auto" />
        </button>
      )}

      {/* Source handle delivering final verified report to User Node */}
      <Handle
        type="source"
        position={Position.Top}
        className="w-3 h-3 rounded-full border-2"
        style={{
          backgroundColor: '#10B981',
          borderColor: 'var(--surface)',
        }}
      />
    </div>
  );
};
