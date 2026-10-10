import React from 'react';
import { MetricComparisonSummary } from '../../types/metric';
import { formatNumber, formatPercent } from '../../utils/formatters';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface MetricsKpiCardsProps {
  comparisons: MetricComparisonSummary[];
}

export const MetricsKpiCards: React.FC<MetricsKpiCardsProps> = ({ comparisons }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {comparisons.map((c) => {
        const isBetter = c.isHigherBetter ? c.deltaPercent > 0 : c.deltaPercent < 0;
        const absDelta = Math.abs(c.deltaPercent);

        return (
          <div
            key={c.metricName}
            className="p-3.5 rounded-xl bg-[#0f131a] border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div className="text-[11px] font-medium text-slate-400 truncate">
              {c.metricName}
            </div>

            <div className="my-2 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-slate-500 font-mono">Baseline</span>
                <span className="text-xs text-slate-400 font-mono font-semibold">
                  {formatNumber(c.baselineValue, c.unit === '%' || c.unit === 'MB' ? 1 : 2)}
                  {c.unit && ` ${c.unit}`}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-indigo-400 font-mono font-semibold">
                  Experiment
                </span>
                <span className="text-sm text-white font-mono font-bold">
                  {formatNumber(c.experimentValue, c.unit === '%' || c.unit === 'MB' ? 1 : 2)}
                  {c.unit && ` ${c.unit}`}
                </span>
              </div>
            </div>

            {/* Delta pill */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Delta</span>
              <span
                className={`inline-flex items-center text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                  isBetter
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                }`}
              >
                {c.deltaPercent > 0 ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                )}
                {formatPercent(c.deltaPercent, false)}
                {isBetter && ' (Better)'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
