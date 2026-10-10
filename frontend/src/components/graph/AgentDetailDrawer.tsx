import React from 'react';
import { AgentNodeData } from '../../types/agent';
import { StatusBadge } from '../common/StatusBadge';
import { X, Sparkles, Clock, Wrench, CheckCircle, FileCode, PlayCircle } from 'lucide-react';

interface AgentDetailDrawerProps {
  agent: AgentNodeData | null;
  onClose: () => void;
  onTriggerTask?: (agentId: string) => void;
}

export const AgentDetailDrawer: React.FC<AgentDetailDrawerProps> = ({
  agent,
  onClose,
  onTriggerTask,
}) => {
  if (!agent) return null;

  const subtasks = agent.details?.subtasksCompleted ?? 1;
  const totalSubtasks = agent.details?.totalSubtasks ?? 1;
  const progressPercent = Math.min(100, Math.round((subtasks / totalSubtasks) * 100));

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#0d1017] border-l border-slate-800 p-5 shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400">
            Agent Inspector
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">{agent.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {/* Status & Model */}
        <div className="p-3.5 rounded-xl bg-[#141822] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Lifecycle State:</span>
            <StatusBadge status={agent.status} size="md" />
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
            <span className="text-xs text-slate-400">Backing Model:</span>
            <span className="text-xs font-mono font-semibold text-indigo-300">
              {agent.details?.model || 'LLM Agent'}
            </span>
          </div>
        </div>

        {/* Current Task */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
            Active Research Sub-Task
          </label>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono">
            {agent.currentTask || 'Idle awaiting delegation from Central Orchestrator.'}
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Sub-Task Completion</span>
            <span className="font-mono text-white">
              {subtasks} / {totalSubtasks} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
            Agent Telemetry
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-[#141822] border border-slate-800 text-center">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 mx-auto mb-1" />
              <div className="text-[10px] text-slate-400">Tokens</div>
              <div className="text-xs font-bold font-mono text-white mt-0.5">
                {(agent.tokensUsed / 1000).toFixed(1)}k
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#141822] border border-slate-800 text-center">
              <Clock className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
              <div className="text-[10px] text-slate-400">Runtime</div>
              <div className="text-xs font-bold font-mono text-white mt-0.5">
                {agent.runtimeSec}s
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#141822] border border-slate-800 text-center">
              <Wrench className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
              <div className="text-[10px] text-slate-400">Tool Calls</div>
              <div className="text-xs font-bold font-mono text-white mt-0.5">
                {agent.toolCallsCount}
              </div>
            </div>
          </div>
        </div>

        {/* Target File Gated Contract */}
        {agent.details?.activeFile && (
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300 font-mono">{agent.details.activeFile}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
              Editable in Sandbox
            </span>
          </div>
        )}

        {/* Agent Description */}
        <div className="p-3 rounded-xl bg-[#121620] border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
          <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
            Architecture Role
          </div>
          <p>{agent.details?.description || 'Autonomous agent module inside ARES network.'}</p>
        </div>

        {/* Action Trigger */}
        <div className="pt-2">
          <button
            onClick={() => onTriggerTask && onTriggerTask(agent.id)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-900/30"
          >
            <PlayCircle className="w-4 h-4" />
            Trigger Dedicated Sub-Task Run
          </button>
        </div>
      </div>
    </div>
  );
};
