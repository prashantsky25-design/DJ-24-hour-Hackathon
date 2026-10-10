import React, { useState, useEffect, useRef } from 'react';
import { TerminalLogEntry, LogSource } from '../../types/log';
import {
  Terminal as TerminalIcon,
  Search,
  ArrowDown,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';

interface TerminalPanelProps {
  logs: TerminalLogEntry[];
  onClearLogs: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ logs, onClearLogs }) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSource =
      sourceFilter === 'all'
        ? true
        : sourceFilter === 'stderr'
        ? log.source === 'stderr' || log.level === 'error'
        : sourceFilter === 'stdout'
        ? log.source === 'stdout' || log.source === 'pytorch'
        : log.source === sourceFilter;

    const matchesQuery = filterQuery
      ? log.message.toLowerCase().includes(filterQuery.toLowerCase()) ||
        log.source.toLowerCase().includes(filterQuery.toLowerCase())
      : true;

    return matchesSource && matchesQuery;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.source.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSourceBadge = (source: LogSource) => {
    switch (source) {
      case 'stderr':
        return <span className="text-rose-400 font-bold">[STDERR]</span>;
      case 'stdout':
        return <span className="text-emerald-400 font-semibold">[STDOUT]</span>;
      case 'pytorch':
        return <span className="text-teal-400 font-semibold">[PYTORCH]</span>;
      case 'system':
        return <span className="text-cyan-400 font-semibold">[SYSTEM]</span>;
      case 'agent':
        return <span className="text-amber-400 font-semibold">[AGENT]</span>;
      case 'sandbox':
        return <span className="text-purple-400 font-semibold">[E2B]</span>;
      default:
        return <span className="text-slate-400">[{(source as string).toUpperCase()}]</span>;
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-[#090b10] border border-slate-800/90 overflow-hidden shadow-xl font-mono">
      {/* Top Console Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#0e1219] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200">
            E2B Sandbox Stream (stdout / stderr)
          </span>
          <span className="text-[10px] text-slate-500">
            {filteredLogs.length} lines
          </span>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search stream..."
              className="pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs w-36 sm:w-44 focus:outline-hidden focus:border-indigo-500 font-sans"
            />
          </div>

          {/* Source filters */}
          <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'stdout', label: 'Stdout' },
                { id: 'stderr', label: 'Stderr' },
                { id: 'system', label: 'Sys' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setSourceFilter(f.id)}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  sourceFilter === f.id
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Autoscroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              autoScroll
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title={autoScroll ? 'Autoscroll Active' : 'Autoscroll Paused'}
          >
            <ArrowDown className={`w-3.5 h-3.5 ${autoScroll ? 'animate-bounce' : ''}`} />
          </button>

          {/* Copy logs */}
          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear logs */}
          <button
            onClick={onClearLogs}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
            title="Clear console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 p-4 overflow-y-auto max-h-[500px] min-h-[350px] space-y-1 text-xs text-slate-300 select-text">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500 text-center py-12 font-sans italic">
            No console output matches current filter criteria.
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isError = log.level === 'error' || log.source === 'stderr';
            const isWarn = log.level === 'warn';

            return (
              <div
                key={log.id || index}
                className={`flex items-start gap-2.5 py-0.5 px-1.5 rounded hover:bg-slate-900/60 transition-colors ${
                  isError
                    ? 'bg-rose-950/20 text-rose-300'
                    : isWarn
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }`}
              >
                <span className="text-slate-600 select-none text-[10px] w-7 shrink-0 text-right">
                  {index + 1}
                </span>
                <span className="text-slate-500 text-[10px] shrink-0 select-none">
                  {log.timestamp}
                </span>
                <span className="text-[10px] shrink-0 select-none">
                  {getSourceBadge(log.source)}
                </span>
                <span className="break-all whitespace-pre-wrap leading-relaxed flex-1">
                  {log.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
