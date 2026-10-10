import React from 'react';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface EmergencyStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const EmergencyStopModal: React.FC<EmergencyStopModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-[#120d11] border border-rose-900/60 p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-rose-950">
          <div className="flex items-center gap-2.5 text-rose-400">
            <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800/60">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <h2 className="text-base font-bold text-white tracking-wide uppercase">
              Emergency Stop Confirmation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            Are you sure you want to trigger the <span className="text-rose-400 font-semibold">Emergency Stop</span>?
          </p>
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-200/90 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                Immediately transmits <strong>SIGKILL</strong> to the isolated E2B Python sandbox.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                Halts all active orchestrator reasoning loops and transitions sub-agents to Retired state.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                Existing checkpoints are preserved. Rollback to baseline remains available.
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-rose-950">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancel (Keep Running)
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-900/50 transition-all flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            CONFIRM EMERGENCY STOP
          </button>
        </div>
      </div>
    </div>
  );
};
