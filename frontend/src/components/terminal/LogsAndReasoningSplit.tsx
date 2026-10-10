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

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Mode Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-semibold text-slate-400">
          Telemetry & Reasoning Inspection
        </div>
        <div className="flex items-center gap-1 bg-[#0f131a] p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setLayout('split')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              layout === 'split'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split View</span>
          </button>

          <button
            onClick={() => setLayout('terminal')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              layout === 'terminal'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal Only</span>
          </button>

          <button
            onClick={() => setLayout('reasoning')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              layout === 'reasoning'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Reasoning CoT</span>
          </button>
        </div>
      </div>

      {/* Panels Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
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
