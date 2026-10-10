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
    reasoningSteps[0]?.id || null
  );
  const [search, setSearch] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const filteredSteps = reasoningSteps.filter((step) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      step.agentName.toLowerCase().includes(q) ||
      step.thought.toLowerCase().includes(q) ||
      (step.hypothesis && step.hypothesis.toLowerCase().includes(q)) ||
      (step.decision && step.decision.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full rounded-2xl bg-[#090b10] border border-slate-800/90 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-[#0e1219] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-200">
            Agent Reasoning & Chain-of-Thought Stream
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
            {filteredSteps.length} Steps
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reasoning..."
            className="pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs w-40 sm:w-52 focus:outline-hidden focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 p-4 overflow-y-auto max-h-[500px] min-h-[350px] space-y-3">
        {filteredSteps.length === 0 ? (
          <div className="text-slate-500 text-center py-12 italic text-xs">
            No agent reasoning traces match search.
          </div>
        ) : (
          filteredSteps.map((step) => {
            const isExpanded = expandedId === step.id;
            const isInProgress = step.status === 'in_progress';

            return (
              <div
                key={step.id}
                className={`rounded-xl border transition-all ${
                  isInProgress
                    ? 'border-indigo-500/70 bg-indigo-950/20'
                    : 'border-slate-800 bg-[#0e1219]/90 hover:border-slate-700'
                }`}
              >
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(step.id)}
                  className="w-full text-left p-3.5 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {step.agentName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {step.timestamp}
                        </span>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-full border ${
                            isInProgress
                              ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                          }`}
                        >
                          {isInProgress ? 'In Progress' : 'Completed'}
                        </span>
                      </div>
                      {step.hypothesis && (
                        <div className="mt-1 text-xs text-indigo-300/90 font-medium flex items-center gap-1.5 truncate">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{step.hypothesis}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-3 text-xs">
                    {/* Chain of Thought */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                        <Brain className="w-3 h-3 text-indigo-400" />
                        <span>Chain-of-Thought (Reasoning)</span>
                      </div>
                      <p className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 leading-relaxed font-sans">
                        {step.thought}
                      </p>
                    </div>

                    {/* Tool Action & Observation */}
                    {step.action && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Tool Execution</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-indigo-300">
                            <div>tool: {step.action.tool}</div>
                            <pre className="text-slate-400 text-[10px] mt-1 overflow-x-auto">
                              {JSON.stringify(step.action.params, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {step.observation && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Sandbox Observation</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] leading-relaxed">
                              {step.observation}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Final Decision */}
                    {step.decision && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/50 flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                            Synthesized Decision
                          </div>
                          <p className="text-xs text-slate-200 mt-0.5">{step.decision}</p>
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
