import React from 'react';
import { AgentNodeData } from '../../types/agent';
import { ExperimentMetadata, MetricPoint, MetricComparisonSummary } from '../../types/metric';
import { TerminalLogEntry, ReasoningStep } from '../../types/log';
import { AgentGraphPanel } from '../graph/AgentGraphPanel';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { ReasoningLogs } from '../terminal/ReasoningLogs';
import { LossCurvesChart } from '../comparison/LossCurvesChart';
import { WhatIfInput } from '../steering/WhatIfInput';
import { StatCard } from '../common/StatCard';
import {
  TrendingDown,
  Layers,
  Cpu,
  Zap,
  Users,
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
}

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
}) => {
  const activeCount = agents.filter((a) => a.status === 'running' || a.status === 'spawning').length;
  const valLossComp = comparisons.find((c) => c.metricName === 'Validation Loss');
  const throughputComp = comparisons.find((c) => c.metricName === 'Training Throughput');

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Telemetry KPIs Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Validation Loss"
          value={valLossComp ? valLossComp.experimentValue.toFixed(2) : '0.50'}
          subValue={valLossComp ? `Base: ${valLossComp.baselineValue.toFixed(2)}` : '1.09'}
          trend={{
            positive: true,
            text: valLossComp ? `${valLossComp.deltaPercent.toFixed(1)}% (Better)` : '-54.1%',
          }}
          icon={<TrendingDown className="w-4 h-4 text-emerald-400" />}
        />

        <StatCard
          label="Current Epoch"
          value={`${experiment.currentEpoch}/${experiment.totalEpochs}`}
          subValue="Step 1800"
          trend={{ positive: true, text: 'Gated Safe' }}
          icon={<Layers className="w-4 h-4 text-indigo-400" />}
        />

        <StatCard
          label="GPU VRAM"
          value={`${(experiment.gpuMemoryUsageMb / 1024).toFixed(1)} GB`}
          subValue="Peak: 9.1 GB"
          trend={{ positive: true, text: '-40.9% vs Base' }}
          icon={<Cpu className="w-4 h-4 text-cyan-400" />}
        />

        <StatCard
          label="Throughput"
          value={throughputComp ? `${throughputComp.experimentValue}` : '798'}
          subValue="smp/sec"
          trend={{ positive: true, text: '+93.7% Speedup' }}
          icon={<Zap className="w-4 h-4 text-amber-400" />}
        />

        <StatCard
          label="Active Agents"
          value={`${activeCount}/${agents.length}`}
          subValue="Ecosystem"
          trend={{ positive: true, text: 'Self-Organizing' }}
          icon={<Users className="w-4 h-4 text-purple-400" />}
        />
      </div>

      {/* Main Grid: Live Agent Graph (Left/Top) + Live Loss Curves (Right/Top) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Live Agent Graph Panel (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <AgentGraphPanel
            agents={agents}
            onSelectAgent={onSelectAgent}
            selectedAgentId={selectedAgentId}
          />
        </div>

        {/* Right Column: Loss Curves & Steering Input (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex-1">
            <LossCurvesChart metrics={metrics} />
          </div>
          <WhatIfInput
            onSubmit={onSubmitWhatIf}
            disabled={experiment.status === 'halted'}
          />
        </div>
      </div>

      {/* Bottom Row: Live Terminal & Agent Reasoning Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TerminalPanel logs={logs} onClearLogs={onClearLogs} />
        <ReasoningLogs reasoningSteps={reasoning} />
      </div>
    </div>
  );
};
