import React, { useState } from 'react';
import { Send, Sparkles, Wand2 } from 'lucide-react';

interface WhatIfInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

export const WhatIfInput: React.FC<WhatIfInputProps> = ({ onSubmit, disabled }) => {
  const [prompt, setPrompt] = useState('');

  const suggestions = [
    'What if we replace AdamW with Lion optimizer (lr=1e-4, weight_decay=0.1)?',
    'What if we tile attention block size to Br=128, Bc=64 to maximize SRAM usage?',
    'What if we enable bfloat16 mixed precision and gradient clipping to 1.0?',
    'What if we incorporate rotary positional embeddings (RoPE) instead of absolute?',
    'What if we double batch size to 64 since VRAM dropped by 40%?',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || disabled) return;
    onSubmit(prompt.trim());
    setPrompt('');
  };

  const handleChipClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  return (
    <div className="rounded-2xl bg-[#0f131a] border border-slate-800 p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/40">
            <Wand2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              "What-If" Human Steering Engine
            </h3>
            <p className="text-xs text-slate-400">
              Steer autonomous multi-agents mid-run with research hypotheses
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
          Interactive Steering Contract
        </span>
      </div>

      {/* Suggested Prompt Chips */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Quick Hypothesis Presets:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChipClick(s)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#151a23] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors text-left"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={disabled}
          placeholder="Type hypothesis... (e.g. What if we replace AdamW with Lion optimizer and increase batch size to 64?)"
          className="w-full p-3.5 pr-28 rounded-xl bg-[#0a0c10] border border-slate-700 text-slate-100 placeholder:text-slate-500 text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-all resize-none disabled:opacity-50"
        />
        <div className="absolute right-3 bottom-3">
          <button
            type="submit"
            disabled={!prompt.trim() || disabled}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-900/40 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Inject</span>
          </button>
        </div>
      </form>
    </div>
  );
};
