import React from 'react';
import { MetricComparisonSummary, MetricPoint, ExperimentMetadata } from '../../types/metric';
import { MetricsKpiCards } from './MetricsKpiCards';
import { LossCurvesChart } from './LossCurvesChart';
import { CodeDiffViewer } from './CodeDiffViewer';
import { FileText, Download, CheckCircle2 } from 'lucide-react';

interface ComparisonPanelProps {
  comparisons: MetricComparisonSummary[];
  metrics: MetricPoint[];
  experiment: ExperimentMetadata;
  baselineCode: string;
  experimentCode: string;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  comparisons,
  metrics,
  experiment,
  baselineCode,
  experimentCode,
}) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* KPI Cards */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Quantitative Baseline vs Experiment Scorecard
          </h3>
          <span className="text-xs text-emerald-400 font-mono font-semibold">
            All criteria passed regression gating
          </span>
        </div>
        <MetricsKpiCards comparisons={comparisons} />
      </div>

      {/* Loss Curves */}
      <LossCurvesChart metrics={metrics} />

      {/* Code Diff Viewer */}
      <CodeDiffViewer baselineCode={baselineCode} experimentCode={experimentCode} />

      {/* LaTeX Publication Artifact Readiness Banner */}
      <div className="p-4 rounded-2xl bg-[#0f131a] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-800/40 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Publication-Ready LaTeX Report (NeurIPS Format)</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Drafter Agent has assembled Sections 1–4 with auto-embedded vector charts and bibliography from ArXiv.
            </p>
          </div>
        </div>
        <button
          onClick={() => alert('Downloading LaTeX bundle: ares_neurips_report.tar.gz')}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 text-purple-400" />
          <span>Export LaTeX Bundle (.tar.gz)</span>
        </button>
      </div>
    </div>
  );
};
