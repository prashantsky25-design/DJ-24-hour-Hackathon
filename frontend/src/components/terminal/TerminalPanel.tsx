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

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    const matchesSource =
      sourceFilter === 'all' ? true
      : sourceFilter === 'stderr' ? log.source === 'stderr' || log.level === 'error'
      : sourceFilter === 'stdout' ? log.source === 'stdout' || log.source === 'pytorch'
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
    const badges: Record<string, { label: string; color: string }> = {
      stderr:  { label: '[STDERR]',  color: '#ef4444' },
      stdout:  { label: '[STDOUT]',  color: '#10b981' },
      pytorch: { label: '[PYTORCH]', color: '#14b8a6' },
      system:  { label: '[SYSTEM]',  color: '#06b6d4' },
      agent:   { label: '[AGENT]',   color: '#f59e0b' },
      sandbox: { label: '[E2B]',     color: '#a855f7' },
    };
    const b = badges[source];
    return b
      ? <span style={{ color: b.color, fontWeight: 600 }}>{b.label}</span>
      : <span style={{ color: 'var(--text-muted)' }}>[{(source as string).toUpperCase()}]</span>;
  };

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden font-mono"
      style={{ backgroundColor: 'var(--code-bg)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4" style={{ color: 'var(--success)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            E2B Sandbox Stream
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {filteredLogs.length} lines
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search stream..."
              className="pl-8 pr-3 py-1 rounded-lg text-xs w-36 sm:w-44 focus:outline-none font-sans border"
              style={{
                backgroundColor: 'var(--surface-secondary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Source filters */}
          <div
            className="flex items-center rounded-lg p-0.5 border text-[10px]"
            style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
          >
            {(['all', 'stdout', 'stderr', 'system'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className="px-2 py-0.5 rounded-md capitalize transition-all"
                style={{
                  backgroundColor: sourceFilter === f ? 'var(--accent)' : 'transparent',
                  color: sourceFilter === f ? '#fff' : 'var(--text-secondary)',
                  fontWeight: sourceFilter === f ? 600 : 400,
                }}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Autoscroll */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="p-1.5 rounded-lg border text-xs transition-colors"
            style={{
              backgroundColor: autoScroll ? 'var(--accent-subtle)' : 'var(--surface-secondary)',
              borderColor: autoScroll ? 'var(--accent)' : 'var(--border)',
              color: autoScroll ? 'var(--accent)' : 'var(--text-muted)',
            }}
            title={autoScroll ? 'Autoscroll Active' : 'Autoscroll Paused'}
          >
            <ArrowDown className={`w-3.5 h-3.5 ${autoScroll ? 'animate-bounce' : ''}`} />
          </button>

          {/* Copy */}
          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg border transition-colors"
            style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            title="Copy logs"
          >
            {copied
              ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
              : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear */}
          <button
            onClick={onClearLogs}
            className="p-1.5 rounded-lg border transition-colors"
            style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Clear console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log viewport */}
      <div className="flex-1 p-4 overflow-y-auto max-h-[520px] min-h-[320px] space-y-0.5 text-xs select-text"
        style={{ color: 'var(--text-secondary)' }}>
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 font-sans italic" style={{ color: 'var(--text-muted)' }}>
            No console output matches current filter.
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isError = log.level === 'error' || log.source === 'stderr';
            const isWarn  = log.level === 'warn';

            return (
              <div
                key={log.id || index}
                className="flex items-start gap-2.5 py-0.5 px-1.5 rounded transition-colors"
                style={{
                  backgroundColor: isError ? 'rgba(239,68,68,0.06)' : 'transparent',
                  color: isError ? '#ef4444' : isWarn ? '#f59e0b' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  if (!isError) e.currentTarget.style.backgroundColor = 'var(--hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isError) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span className="text-[10px] w-7 shrink-0 text-right select-none" style={{ color: 'var(--text-muted)' }}>
                  {index + 1}
                </span>
                <span className="text-[10px] shrink-0 select-none" style={{ color: 'var(--text-muted)' }}>
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
