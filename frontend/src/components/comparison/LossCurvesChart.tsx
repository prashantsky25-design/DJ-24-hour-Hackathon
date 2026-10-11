import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { MetricPoint } from '../../types/metric';
import { TrendingDown, Activity, Layers } from 'lucide-react';

interface LossCurvesChartProps {
  metrics: MetricPoint[];
}

export const LossCurvesChart: React.FC<LossCurvesChartProps> = ({ metrics }) => {
  const [chartMode, setChartMode] = useState<'loss' | 'accuracy' | 'all'>('loss');
  const [showBaseline, setShowBaseline] = useState(true);

  return (
    <div
      className="rounded-xl border p-5 flex flex-col"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header & Controls */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="p-1.5 rounded-lg border"
            style={{ backgroundColor: 'var(--accent-subtle)', borderColor: 'var(--border)' }}
          >
            {chartMode === 'loss' ? (
              <TrendingDown className="w-4 h-4 text-emerald-500" />
            ) : (
              <Activity className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {chartMode === 'loss'
                ? 'Empirical Loss Convergence Curves'
                : chartMode === 'accuracy'
                ? 'Evaluation Accuracy Progression'
                : 'Combined Convergence & Accuracy'}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Real-time validation tracking (Baseline vs Autonomous Experiment)
            </p>
          </div>
        </div>

        {/* Chart View Mode Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center rounded-lg p-0.5 border text-xs"
            style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }}
          >
            {(['loss', 'accuracy', 'all'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className="px-3 py-1 rounded-md transition-all"
                style={{
                  backgroundColor: chartMode === mode ? 'var(--accent)' : 'transparent',
                  color: chartMode === mode ? '#fff' : 'var(--text-secondary)',
                  fontWeight: chartMode === mode ? 600 : 400,
                }}
              >
                {mode === 'loss' ? 'Loss Curves' : mode === 'accuracy' ? 'Accuracy (%)' : 'Dual Axis'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowBaseline(!showBaseline)}
            className="px-2.5 py-1 rounded-lg border text-xs transition-colors flex items-center gap-1.5"
            style={{
              backgroundColor: showBaseline ? 'var(--surface-secondary)' : 'transparent',
              borderColor: 'var(--border)',
              color: showBaseline ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <Layers className="w-3 h-3" />
            <span>{showBaseline ? 'Baseline Visible' : 'Baseline Hidden'}</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-80 sm:h-96 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={metrics} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="epoch"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) => `Ep ${v}`}
            />
            <YAxis
              yAxisId="loss"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              domain={[0, 'auto']}
              label={
                chartMode !== 'accuracy'
                  ? { value: 'Cross-Entropy Loss', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 15 }
                  : undefined
              }
            />
            {(chartMode === 'accuracy' || chartMode === 'all') && (
              <YAxis
                yAxisId="acc"
                orientation="right"
                stroke="#818cf8"
                fontSize={11}
                tickLine={false}
                domain={[0, 100]}
                unit="%"
                label={{ value: 'Accuracy (%)', angle: 90, position: 'insideRight', fill: '#818cf8', fontSize: 10, offset: 15 }}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                borderRadius: '0.75rem',
                fontSize: '11px',
                color: 'var(--text-primary)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
              formatter={(value: any, name: any) => [
                typeof value === 'number' ? value.toFixed(3) : value,
                name,
              ]}
              labelFormatter={(label) => `Epoch ${label}`}
            />
            <Legend
              wrapperStyle={{ paddingTop: '15px', fontSize: '11px' }}
              iconType="circle"
            />

            {/* Loss Curves */}
            {chartMode !== 'accuracy' && (
              <>
                {showBaseline && (
                  <Line
                    yAxisId="loss"
                    type="monotone"
                    dataKey="baselineValLoss"
                    name="Baseline Val Loss"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                )}
                {showBaseline && (
                  <Line
                    yAxisId="loss"
                    type="monotone"
                    dataKey="baselineTrainLoss"
                    name="Baseline Train Loss"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                )}
                <Line
                  yAxisId="loss"
                  type="monotone"
                  dataKey="experimentValLoss"
                  name="Experiment Val Loss"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="loss"
                  type="monotone"
                  dataKey="experimentTrainLoss"
                  name="Experiment Train Loss"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                />
              </>
            )}

            {/* Accuracy Curves */}
            {(chartMode === 'accuracy' || chartMode === 'all') && (
              <>
                {showBaseline && (
                  <Line
                    yAxisId="acc"
                    type="monotone"
                    dataKey="baselineAccuracy"
                    name="Baseline Top-1 Acc (%)"
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                )}
                <Line
                  yAxisId="acc"
                  type="monotone"
                  dataKey="experimentAccuracy"
                  name="Experiment Top-1 Acc (%)"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 6 }}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
