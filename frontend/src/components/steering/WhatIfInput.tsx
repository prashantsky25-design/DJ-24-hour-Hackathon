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

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg border"
            style={{ backgroundColor: 'var(--accent-subtle)', borderColor: 'var(--border)' }}
          >
            <Wand2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              "What-If" Human Steering Engine
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Steer autonomous multi-agents mid-run with research hypotheses
            </p>
          </div>
        </div>
        <span
          className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full border shrink-0"
          style={{
            backgroundColor: 'var(--surface-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          Steering Contract
        </span>
      </div>

      {/* Suggestion chips */}
      <div>
        <div
          className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
          style={{ color: 'var(--text-muted)' }}
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Quick Hypothesis Presets:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPrompt(s)}
              className="text-[11px] px-2.5 py-1 rounded-lg border text-left transition-colors"
              style={{
                backgroundColor: 'var(--surface-secondary)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-strong)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-secondary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={disabled}
          placeholder="Type hypothesis… (e.g. What if we replace AdamW with Lion optimizer and increase batch size to 64?)"
          className="w-full p-3.5 pr-28 rounded-xl text-xs sm:text-sm focus:outline-none font-mono resize-none border transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'var(--input-bg)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <div className="absolute right-3 bottom-3">
          <button
            type="submit"
            disabled={!prompt.trim() || disabled}
            className="px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)' }}
            onMouseEnter={(e) => !prompt.trim() || disabled || (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Inject</span>
          </button>
        </div>
      </form>
    </div>
  );
};
