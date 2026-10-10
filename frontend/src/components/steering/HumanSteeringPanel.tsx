import React from 'react';
import { ExperimentMetadata } from '../../types/metric';
import { WhatIfInput } from './WhatIfInput';
import {
  OctagonAlert,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  GitCommit,
  Lock,
  Cpu,
} from 'lucide-react';

interface HumanSteeringPanelProps {
  experiment: ExperimentMetadata;
  onOpenEmergencyModal: () => void;
  onTogglePauseResume: () => void;
  onSubmitWhatIf: (prompt: string) => void;
  onRollback: () => void;
}

export const HumanSteeringPanel: React.FC<HumanSteeringPanelProps> = ({
  experiment,
  onOpenEmergencyModal,
  onTogglePauseResume,
  onSubmitWhatIf,
  onRollback,
}) => {
  const isRunning = experiment.status === 'running';
  const isPaused = experiment.status === 'paused';
  const isHalted = experiment.status === 'halted';

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Top Banner: Emergency & Core Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Emergency Stop Card */}
        <div className="rounded-2xl bg-linear-to-b from-rose-950/40 to-[#0f131a] border border-rose-800/60 p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-rose-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Safety Overrides
              </span>
              <OctagonAlert className="w-5 h-5 text-rose-400" />
            </div>
            <h3 className="text-base font-bold text-white">Emergency Stop</h3>
            <p className="text-xs text-rose-200/70 mt-1 leading-relaxed">
              Instant hard halt (SIGKILL). Kills running E2B sandboxes and freezes all agents.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={onOpenEmergencyModal}
              disabled={isHalted}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white shadow-lg shadow-rose-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <OctagonAlert className="w-4 h-4" />
              <span>{isHalted ? 'SYSTEM IS HALTED' : 'EXECUTE EMERGENCY STOP'}</span>
            </button>
          </div>
        </div>

        {/* Pause / Resume Control Card */}
        <div className="rounded-2xl bg-[#0f131a] border border-slate-800 p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Execution Flow
              </span>
              {isRunning ? <Play className="w-5 h-5 text-emerald-400" /> : <Pause className="w-5 h-5" />}
            </div>
            <h3 className="text-base font-bold text-white">Pause / Resume</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Temporarily suspend training steps or resume autonomous optimization loop.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={onTogglePauseResume}
              disabled={isHalted}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-950/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>PAUSE EXPERIMENT</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>RESUME EXPERIMENT</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Git-Gated Rollback Card */}
        <div className="rounded-2xl bg-[#0f131a] border border-slate-800 p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-indigo-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Git-Gated Sandbox
              </span>
              <GitCommit className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-white">Rollback Checkpoint</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Revert <code className="text-indigo-300 font-mono">train.py</code> to baseline hash ({experiment.gitCommitHash}) if validation loss regresses.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={onRollback}
              disabled={isHalted}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-indigo-400" />
              <span>Rollback: git reset --hard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main What-If Interactive Engine */}
      <WhatIfInput onSubmit={onSubmitWhatIf} disabled={isHalted} />

      {/* Architectural Security & Evaluation Contract Banner */}
      <div className="p-4 rounded-2xl bg-[#0e1219] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-300">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white flex items-center gap-2">
              <span>Locked Evaluation Contract Enforced</span>
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </h4>
            <p className="text-slate-400 mt-0.5 leading-relaxed">
              <strong className="text-slate-200 font-mono">prepare.py</strong> is cryptographically locked and immutable across all agent modifications. Only <strong className="text-emerald-300 font-mono">train.py</strong> can be refactored by the Coding Agent inside the E2B sandbox.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-400">
            <Cpu className="w-3.5 h-3.5 inline mr-1 text-cyan-400" />
            {experiment.gpuDevice.split(' ')[1]}
          </div>
        </div>
      </div>
    </div>
  );
};
