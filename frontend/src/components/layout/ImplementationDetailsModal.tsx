import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  Layers,
  ShieldCheck,
  Terminal,
  GitBranch,
  Zap,
  CheckCircle2,
  Workflow,
  Sparkles,
  BookOpen,
  Code,
  FileText,
} from 'lucide-react';

interface ImplementationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'architecture' | 'agents' | 'sandbox' | 'workflow';

export const ImplementationDetailsModal: React.FC<ImplementationDetailsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('architecture');

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--surface, #0f131a)',
          borderColor: 'var(--border, #1e293b)',
          color: 'var(--text-primary, #f1f5f9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border, #1e293b)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl border"
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                color: '#818cf8',
              }}
            >
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">System Implementation & Architecture</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                  Production Grade
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                ARES Autonomous Scientific Discovery Engine · Technical Specifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-slate-800"
            style={{ color: 'var(--text-muted, #64748b)' }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Navigation Tabs ── */}
        <div
          className="flex items-center gap-1 px-6 pt-3 border-b shrink-0 bg-black/10"
          style={{ borderColor: 'var(--border, #1e293b)' }}
        >
          {[
            { id: 'architecture' as TabType, label: 'Architecture & Engine', icon: Layers },
            { id: 'agents' as TabType, label: 'Multi-Agent Topology', icon: Workflow },
            { id: 'sandbox' as TabType, label: 'Isolated Sandbox & Security', icon: ShieldCheck },
            { id: 'workflow' as TabType, label: 'Autonomous Research Cycle', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium border-b-2 transition-all -mb-px"
                style={{
                  borderColor: active ? 'var(--accent, #6366f1)' : 'transparent',
                  color: active ? 'var(--accent, #818cf8)' : 'var(--text-secondary, #94a3b8)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Content Viewport ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs select-text">
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="p-4 rounded-xl border space-y-2.5"
                  style={{ backgroundColor: 'var(--surface-secondary, #131822)', borderColor: 'var(--border, #1e293b)' }}
                >
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                    <Workflow className="w-4 h-4" />
                    Shared Blackboard Orchestration
                  </div>
                  <p style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                    Agents collaborate through a centralized blackboard memory model. State mutations, intermediate
                    hypotheses, empirical metrics, and critic assessments are published asynchronously to ensure seamless coordination without point-to-point coupling.
                  </p>
                  <ul className="space-y-1 pt-1 font-mono text-[11px] text-slate-300">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Non-blocking event broadcast</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Critic & debate review loops</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Automated impasse escape safeguard</li>
                  </ul>
                </div>

                <div
                  className="p-4 rounded-xl border space-y-2.5"
                  style={{ backgroundColor: 'var(--surface-secondary, #131822)', borderColor: 'var(--border, #1e293b)' }}
                >
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                    <Terminal className="w-4 h-4" />
                    Bi-Directional Telemetry Stream
                  </div>
                  <p style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                    High-throughput WebSocket and SSE streaming pipeline connecting FastAPI backend to the React visualizer. Delivers real-time execution tokens, step progress, stdout/stderr streams, and loss/accuracy curves.
                  </p>
                  <ul className="space-y-1 pt-1 font-mono text-[11px] text-slate-300">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Sub-50ms latency telemetry</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Granular agent step tracking</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Auto-reconnection with backoff</li>
                  </ul>
                </div>
              </div>

              <div
                className="p-4 rounded-xl border space-y-2"
                style={{ backgroundColor: 'var(--surface-secondary, #131822)', borderColor: 'var(--border, #1e293b)' }}
              >
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <GitBranch className="w-4 h-4" />
                  Self-Healing Execution Loop
                </div>
                <p style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                  When synthesized code encounters runtime exceptions, syntax issues, or poor convergence metrics,
                  the Critic Agent evaluates the execution log, formulates actionable feedback, and triggers targeted
                  code repair cycles automatically without manual intervention.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {[
                {
                  role: 'Supervisor Agent',
                  icon: Cpu,
                  color: '#818cf8',
                  desc: 'Formulates task plans, orchestrates agent dependencies, and routes control flow.',
                },
                {
                  role: 'Literature Reviewer',
                  icon: BookOpen,
                  color: '#38bdf8',
                  desc: 'Queries academic databases (arXiv/Semantic Scholar) to ground hypotheses in prior literature.',
                },
                {
                  role: 'Hypothesis Generator',
                  icon: Sparkles,
                  color: '#a78bfa',
                  desc: 'Generates mathematically grounded, testable novel hypotheses and formal problem statements.',
                },
                {
                  role: 'Experiment Designer',
                  icon: Code,
                  color: '#fbbf24',
                  desc: 'Synthesizes clean PyTorch / JAX training scripts, loss formulations, and baselines.',
                },
                {
                  role: 'Sandbox Runner',
                  icon: Terminal,
                  color: '#34d399',
                  desc: 'Executes training scripts in isolated environments, capturing loss curves and system metrics.',
                },
                {
                  role: 'Critic & Reviewer',
                  icon: ShieldCheck,
                  color: '#f87171',
                  desc: 'Performs statistical rigor validation, checks convergence, and challenges unsupported claims.',
                },
                {
                  role: 'Report Drafter',
                  icon: FileText,
                  color: '#e879f9',
                  desc: 'Synthesizes full publication-style reports with KaTeX math, comparisons, and exportable PDFs.',
                },
              ].map((ag, idx) => {
                const Icon = ag.icon;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border flex items-start gap-3"
                    style={{ backgroundColor: 'var(--surface-secondary, #131822)', borderColor: 'var(--border, #1e293b)' }}
                  >
                    <div
                      className="p-2 rounded-lg shrink-0"
                      style={{ backgroundColor: `${ag.color}15`, color: ag.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-[13px]">{ag.role}</div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                        {ag.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              <div
                className="p-4 rounded-xl border space-y-3"
                style={{ backgroundColor: 'var(--surface-secondary, #131822)', borderColor: 'var(--border, #1e293b)' }}
              >
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  Isolation & Security Model
                </div>
                <p style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                  ARES enforces strict security policies on all synthesized code before and during execution:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-lg border bg-black/20" style={{ borderColor: 'var(--border, #1e293b)' }}>
                    <div className="font-semibold text-slate-200">AST Static Analysis</div>
                    <p className="text-[11px] mt-1 text-slate-400">
                      Disallows blacklisted system calls (`subprocess`, unauthorized sockets, file overrides).
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-black/20" style={{ borderColor: 'var(--border, #1e293b)' }}>
                    <div className="font-semibold text-slate-200">Hard Timeouts</div>
                    <p className="text-[11px] mt-1 text-slate-400">
                      Subprocesses are capped with strict wall-clock limits to prevent infinite loops and resource hogging.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-black/20" style={{ borderColor: 'var(--border, #1e293b)' }}>
                    <div className="font-semibold text-slate-200">Sandbox Isolation</div>
                    <p className="text-[11px] mt-1 text-slate-400">
                      Executed inside ephemeral virtual environments or E2B cloud containers with memory caps.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="p-4 rounded-xl border space-y-2"
                style={{ backgroundColor: 'var(--surface-secondary, #131822)', borderColor: 'var(--border, #1e293b)' }}
              >
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                  <Zap className="w-4 h-4" />
                  Execution Telemetry Extraction
                </div>
                <p style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                  Standard output streams are parsed in real time via structured regex extractors to capture training
                  loss, validation accuracy, gradient norms, and epoch runtimes, streaming them directly into client charts.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <div className="space-y-3">
              {[
                { step: '01', title: 'Intent Classification & Plan Formation', desc: 'Analyzes user prompts, classifies task scope (Quick Question, Full Discovery, Ablation), and spins up the agent DAG.' },
                { step: '02', title: 'Literature Search & Prior Art Retrieval', desc: 'Synthesizes domain papers, identifies empirical baselines, and outlines the theoretical gap.' },
                { step: '03', title: 'Novel Hypothesis & Experiment Formulation', desc: 'Proposes concrete architectural modifications with mathematical justifications and expected gains.' },
                { step: '04', title: 'Code Synthesis & Sandboxed Execution', desc: 'Generates self-contained PyTorch/JAX models, trains baselines vs proposed methods, and logs empirical metrics.' },
                { step: '05', title: 'Multi-Agent Critique & Verification', desc: 'The Critic and Reviewer stress-test the findings, assess statistical significance, and eliminate hallucinations.' },
                { step: '06', title: 'Academic Synthesis & Report Export', desc: 'Generates structured research papers with KaTeX equations, comparative performance tables, and PDF export.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-3.5 rounded-xl border"
                  style={{ backgroundColor: 'var(--surface-secondary, #131822)', borderColor: 'var(--border, #1e293b)' }}
                >
                  <span className="font-mono text-sm font-bold text-indigo-400 shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-200 text-xs">{item.title}</h4>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between px-6 py-3 border-t shrink-0 bg-black/10 text-[11px]"
          style={{ borderColor: 'var(--border, #1e293b)', color: 'var(--text-muted, #64748b)' }}
        >
          <span>ARES Autonomous Research Platform · Multi-Agent Discovery Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--accent, #6366f1)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

