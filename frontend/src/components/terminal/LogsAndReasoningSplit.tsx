import React, { useState } from 'react';
import { TerminalPanel } from './TerminalPanel';
import { ReasoningLogs } from './ReasoningLogs';
import { TerminalLogEntry, ReasoningStep } from '../../types/log';
import { Terminal, Brain, Columns } from 'lucide-react';

interface LogsAndReasoningSplitProps {
  logs: TerminalLogEntry[];
  reasoning: ReasoningStep[];
  onClearLogs: () => void;
}

export const LogsAndReasoningSplit: React.FC<LogsAndReasoningSplitProps> = ({
  logs,
  reasoning,
  onClearLogs,
}) => {
  const [layout, setLayout] = useState<'split' | 'terminal' | 'reasoning'>('split');

  const TABS = [
    { id: 'split'     as const, label: 'Split View',    icon: <Columns  className="w-3.5 h-3.5" /> },
    { id: 'terminal'  as const, label: 'Terminal Only', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'reasoning' as const, label: 'Reasoning CoT', icon: <Brain    className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* ── Mode bar ── */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Telemetry &amp; Reasoning Inspection
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-xl border text-xs"
          style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLayout(tab.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all"
              style={{
                backgroundColor: layout === tab.id ? 'var(--accent)' : 'transparent',
                color: layout === tab.id ? '#fff' : 'var(--text-secondary)',
                fontWeight: layout === tab.id ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (layout !== tab.id)
                  e.currentTarget.style.backgroundColor = 'var(--hover)';
              }}
              onMouseLeave={(e) => {
                if (layout !== tab.id)
                  e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(layout === 'split' || layout === 'terminal') && (
          <div className={layout === 'terminal' ? 'lg:col-span-2' : ''}>
            <TerminalPanel logs={logs} onClearLogs={onClearLogs} />
          </div>
        )}

        {(layout === 'split' || layout === 'reasoning') && (
          <div className={layout === 'reasoning' ? 'lg:col-span-2' : ''}>
            <ReasoningLogs reasoningSteps={reasoning} />
          </div>
        )}
      </div>
    </div>
  );
};
