import React, { useState } from 'react';
import { FileCode, Check, Copy, ArrowRightLeft } from 'lucide-react';

interface CodeDiffViewerProps {
  baselineCode: string;
  experimentCode: string;
}

export const CodeDiffViewer: React.FC<CodeDiffViewerProps> = ({
  baselineCode,
  experimentCode,
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'experiment-only'>('side-by-side');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(experimentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-[#0f131a] border border-slate-800 p-5 shadow-xl flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">
            Sandbox Code Diff: <code className="text-emerald-300 font-mono">train.py</code>
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
            Git Commit: a7f3b89e
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setViewMode(viewMode === 'side-by-side' ? 'experiment-only' : 'side-by-side')
            }
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
            <span>{viewMode === 'side-by-side' ? 'Single View' : 'Side-by-Side'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Copy experiment train.py"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {viewMode === 'side-by-side' && (
          <div className="flex flex-col">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Baseline Checkpoint (Standard PyTorch)</span>
              <span className="text-[10px] text-slate-500 font-mono">pre-evolution</span>
            </div>
            <pre className="flex-1 p-3.5 rounded-xl bg-[#090b10] border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed selection:bg-slate-700">
              <code>{baselineCode}</code>
            </pre>
          </div>
        )}

        <div className={`flex flex-col ${viewMode === 'experiment-only' ? 'lg:col-span-2' : ''}`}>
          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Experiment Candidate (Coding Agent Refactored)</span>
            <span className="text-[10px] text-emerald-500 font-mono font-bold">+54.1% Val Loss</span>
          </div>
          <pre className="flex-1 p-3.5 rounded-xl bg-[#090b10] border border-emerald-900/40 text-xs font-mono text-emerald-200/90 overflow-x-auto max-h-72 leading-relaxed selection:bg-emerald-900/60">
            <code>{experimentCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
