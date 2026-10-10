import React, { useState } from 'react';
import { AgentNodeData } from '../../types/agent';
import { ExperimentMetadata, MetricPoint, MetricComparisonSummary } from '../../types/metric';
import { TerminalLogEntry, ReasoningStep } from '../../types/log';
import { ResearchSession } from '../../types/research';
import { QueryIntent } from '../../services/intentRouter';
import { AgentGraphPanel } from '../graph/AgentGraphPanel';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { ReasoningLogs } from '../terminal/ReasoningLogs';
import { LossCurvesChart } from '../comparison/LossCurvesChart';
import { WhatIfInput } from '../steering/WhatIfInput';
import { StatCard } from '../common/StatCard';
import { CockpitSessionBar } from '../cockpit/CockpitSessionBar';
import { LiveChatFeed } from '../cockpit/LiveChatFeed';
import { PipelineStatusTracker } from '../cockpit/PipelineStatusTracker';
import {
  TrendingDown,
  Layers,
  Cpu,
  Zap,
  Users,
  MessageSquare,
  Activity,
  Network,
  ChevronDown,
} from 'lucide-react';

interface OverviewCockpitProps {
  agents: AgentNodeData[];
  experiment: ExperimentMetadata;
  metrics: MetricPoint[];
  logs: TerminalLogEntry[];
  reasoning: ReasoningStep[];
  comparisons: MetricComparisonSummary[];
  onSelectAgent: (agentId: string) => void;
  selectedAgentId: string | null;
  onSubmitWhatIf: (prompt: string) => void;
  onClearLogs: () => void;
  // real-time chat data
  activeSession: ResearchSession;
  isProcessing: boolean;
  pipelineStepMessage: string;
  intent?: QueryIntent | null;
}

type CockpitView = 'overview' | 'pipeline' | 'chat';

const TAB_CONFIG: { id: CockpitView; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Live Overview',    icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'pipeline', label: 'Pipeline Tracker', icon: <Network className="w-3.5 h-3.5" /> },
  { id: 'chat',     label: 'Chat Feed',         icon: <MessageSquare className="w-3.5 h-3.5" /> },
];

export const OverviewCockpit: React.FC<OverviewCockpitProps> = ({
  agents,
  experiment,
  metrics,
  logs,
  reasoning,
  comparisons,
  onSelectAgent,
  selectedAgentId,
  onSubmitWhatIf,
  onClearLogs,
  activeSession,
  isProcessing,
  pipelineStepMessage,
  intent,
}) => {
  const [activeView, setActiveView] = useState<CockpitView>('overview');
  const [kpiCollapsed, setKpiCollapsed] = useState(false);

  const activeCount = agents.filter(
    (a) => a.status === 'running' || a.status === 'spawning',
  ).length;
  const valLossComp   = comparisons.find((c) => c.metricName === 'Validation Loss');
  const throughputComp = comparisons.find((c) => c.metricName === 'Training Throughput');

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 pt-4 pb-6 space-y-3">

      {/* ── Session context bar ─────────────────────────── */}
      <CockpitSessionBar
        session={activeSession}
        isProcessing={isProcessing}
        pipelineStepMessage={pipelineStepMessage}
        intent={intent}
      />

      {/* ── KPI bar (collapsible) ───────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setKpiCollapsed((p) => !p)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold mb-2 select-none transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${kpiCollapsed ? '-rotate-90' : ''}`}
          />
          Telemetry KPIs
        </button>

        {!kpiCollapsed && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="Validation Loss"
              value={valLossComp ? valLossComp.experimentValue.toFixed(3) : '—'}
              subValue={valLossComp ? `Base: ${valLossComp.baselineValue.toFixed(2)}` : undefined}
              trend={
                valLossComp
                  ? { positive: true, text: `${valLossComp.deltaPercent.toFixed(1)}% ↓` }
                  : undefined
              }
              icon={<TrendingDown className="w-4 h-4 text-emerald-500" />}
            />
            <StatCard
              label="Current Epoch"
              value={`${experiment.currentEpoch}/${experiment.totalEpochs}`}
              subValue={experiment.status}
              trend={{ positive: experiment.status !== 'halted', text: 'Git-gated ✓' }}
              icon={<Layers className="w-4 h-4 text-indigo-500" />}
            />
            <StatCard
              label="GPU VRAM"
              value={`${(experiment.gpuMemoryUsageMb / 1024).toFixed(1)} GB`}
              subValue={`Peak: ${(experiment.gpuMemoryPeakMb / 1024).toFixed(1)} GB`}
              trend={{ positive: true, text: 'Within budget' }}
              icon={<Cpu className="w-4 h-4 text-cyan-500" />}
            />
            <StatCard
              label="Throughput"
              value={throughputComp ? `${throughputComp.experimentValue}` : '—'}
              subValue="smp/sec"
              trend={
                throughputComp
                  ? { positive: true, text: `+${throughputComp.deltaPercent.toFixed(0)}% vs base` }
                  : undefined
              }
              icon={<Zap className="w-4 h-4 text-amber-500" />}
            />
            <StatCard
              label="Active Agents"
              value={`${activeCount}/${agents.length}`}
              subValue={isProcessing ? 'Running pipeline' : 'Ecosystem ready'}
              trend={{
                positive: true,
                text: isProcessing ? 'Live ●' : 'Standby',
              }}
              icon={<Users className="w-4 h-4 text-purple-500" />}
            />
          </div>
        )}
      </div>

      {/* ── View-switcher tabs ──────────────────────────── */}
      <div
        className="flex items-center gap-1 rounded-lg p-0.5 border self-start w-fit"
        style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
      >
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveView(tab.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
            style={{
              backgroundColor: activeView === tab.id ? 'var(--accent)' : 'transparent',
              color: activeView === tab.id ? '#fff' : 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              if (activeView !== tab.id) e.currentTarget.style.backgroundColor = 'var(--hover)';
            }}
            onMouseLeave={(e) => {
              if (activeView !== tab.id) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.id === 'chat' && activeSession.messages.length > 0 && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  backgroundColor: activeView === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: activeView === tab.id ? '#fff' : 'var(--text-muted)',
                }}
              >
                {activeSession.messages.length}
              </span>
            )}
            {tab.id === 'pipeline' && isProcessing && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          VIEWS
      ══════════════════════════════════════════════════ */}

      {/* ── VIEW: Live Overview ─────────────────────────── */}
      {activeView === 'overview' && (
        <div className="space-y-4">
          {/* Row 1: Agent graph + Pipeline Tracker + Chat Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5" style={{ minHeight: 380 }}>
              <AgentGraphPanel
                agents={agents}
                onSelectAgent={onSelectAgent}
                selectedAgentId={selectedAgentId}
              />
            </div>
            <div className="lg:col-span-3" style={{ minHeight: 380 }}>
              <PipelineStatusTracker
                agents={agents}
                isProcessing={isProcessing}
                pipelineStepMessage={pipelineStepMessage}
                onSelectAgent={onSelectAgent}
                selectedAgentId={selectedAgentId}
              />
            </div>
            <div className="lg:col-span-4" style={{ minHeight: 380 }}>
              <LiveChatFeed
                session={activeSession}
                isProcessing={isProcessing}
                pipelineStepMessage={pipelineStepMessage}
              />
            </div>
          </div>

          {/* Row 2: Loss curves + What-If */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <LossCurvesChart metrics={metrics} />
            </div>
            <div className="lg:col-span-4">
              <WhatIfInput
                onSubmit={onSubmitWhatIf}
                disabled={experiment.status === 'halted'}
              />
            </div>
          </div>

          {/* Row 3: Terminal + Reasoning */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TerminalPanel logs={logs} onClearLogs={onClearLogs} />
            <ReasoningLogs reasoningSteps={reasoning} />
          </div>
        </div>
      )}

      {/* ── VIEW: Pipeline Tracker (full) ───────────────── */}
      {activeView === 'pipeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5" style={{ minHeight: 520 }}>
            <PipelineStatusTracker
              agents={agents}
              isProcessing={isProcessing}
              pipelineStepMessage={pipelineStepMessage}
              onSelectAgent={onSelectAgent}
              selectedAgentId={selectedAgentId}
            />
          </div>
          <div className="lg:col-span-7 space-y-4">
            <LossCurvesChart metrics={metrics} />
            <WhatIfInput
              onSubmit={onSubmitWhatIf}
              disabled={experiment.status === 'halted'}
            />
          </div>
        </div>
      )}

      {/* ── VIEW: Chat Feed (full) ───────────────────────── */}
      {activeView === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5" style={{ minHeight: 520 }}>
            <LiveChatFeed
              session={activeSession}
              isProcessing={isProcessing}
              pipelineStepMessage={pipelineStepMessage}
            />
          </div>
          <div className="lg:col-span-7 space-y-4">
            <TerminalPanel logs={logs} onClearLogs={onClearLogs} />
            <ReasoningLogs reasoningSteps={reasoning} />
          </div>
        </div>
      )}
    </div>
  );
};
