import React, { useState } from 'react';
import { ReasoningStep } from '../../types/log';
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
} from 'lucide-react';

interface ReasoningLogsProps {
  reasoningSteps: ReasoningStep[];
}

export const ReasoningLogs: React.FC<ReasoningLogsProps> = ({ reasoningSteps }) => {
  const [expandedId, setExpandedId] = useState<string | null>(
    reasoningSteps[0]?.id || null,
  );
  const [search, setSearch] = useState('');

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const filteredSteps = reasoningSteps.filter((step) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      step.agentName.toLowerCase().includes(q) ||
      step.thought.toLowerCase().includes(q) ||
      (step.hypothesis?.toLowerCase().includes(q)) ||
      (step.decision?.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b"
        style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            Agent Reasoning Stream
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full border"
            style={{
              backgroundColor: 'var(--accent-subtle)',
              borderColor: 'var(--border)',
              color: 'var(--accent)',
            }}
          >
            {filteredSteps.length} Steps
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reasoning..."
            className="pl-8 pr-3 py-1 rounded-lg text-xs w-40 sm:w-52 focus:outline-none border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="flex-1 p-4 overflow-y-auto max-h-[520px] min-h-[320px] space-y-3">
        {filteredSteps.length === 0 ? (
          <div className="text-center py-12 italic text-xs" style={{ color: 'var(--text-muted)' }}>
            No agent reasoning traces match search.
          </div>
        ) : (
          filteredSteps.map((step) => {
            const isExpanded  = expandedId === step.id;
            const isInProgress = step.status === 'in_progress';

            return (
              <div
                key={step.id}
                className="rounded-xl border transition-all"
                style={{
                  backgroundColor: isInProgress ? 'var(--accent-subtle)' : 'var(--surface-secondary)',
                  borderColor: isInProgress ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {/* Collapsible header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(step.id)}
                  className="w-full text-left p-3.5 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                        : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          {step.agentName}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {step.timestamp}
                        </span>
                        <span
                          className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: isInProgress ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                            borderColor: isInProgress ? '#f59e0b' : '#10b981',
                            color: isInProgress ? '#f59e0b' : '#10b981',
                          }}
                        >
                          {isInProgress ? 'In Progress' : 'Completed'}
                        </span>
                      </div>
                      {step.hypothesis && (
                        <div className="mt-1 text-xs font-medium flex items-center gap-1.5 truncate" style={{ color: 'var(--accent)' }}>
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{step.hypothesis}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div
                    className="px-4 pb-4 pt-1 border-t space-y-3 text-xs"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {/* Chain of thought */}
                    <div>
                      <div
                        className="text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Brain className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                        <span>Chain-of-Thought</span>
                      </div>
                      <p
                        className="p-3 rounded-lg border leading-relaxed font-sans"
                        style={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {step.thought}
                      </p>
                    </div>

                    {/* Tool action & observation */}
                    {step.action && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <div
                            className="text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>Tool Execution</span>
                          </div>
                          <div
                            className="p-2.5 rounded-lg border font-mono text-[11px]"
                            style={{
                              backgroundColor: 'var(--code-bg)',
                              borderColor: 'var(--border)',
                              color: 'var(--accent)',
                            }}
                          >
                            <div>tool: {step.action.tool}</div>
                            <pre
                              className="text-[10px] mt-1 overflow-x-auto"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {JSON.stringify(step.action.params, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {step.observation && (
                          <div>
                            <div
                              className="text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--success)' }} />
                              <span>Observation</span>
                            </div>
                            <div
                              className="p-2.5 rounded-lg border text-[11px] leading-relaxed"
                              style={{
                                backgroundColor: 'var(--surface)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {step.observation}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Decision */}
                    {step.decision && (
                      <div
                        className="p-2.5 rounded-lg border flex items-start gap-2"
                        style={{
                          backgroundColor: 'rgba(16,185,129,0.05)',
                          borderColor: 'rgba(16,185,129,0.3)',
                        }}
                      >
                        <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
                        <div>
                          <div
                            className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: 'var(--success)' }}
                          >
                            Synthesized Decision
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {step.decision}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
