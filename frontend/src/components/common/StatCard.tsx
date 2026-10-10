import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: {
    positive: boolean;
    text: string;
  };
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  trend,
  icon,
}) => {
  return (
    <div className="bg-[#0f131a] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-sm">
      <div className="flex items-center justify-between text-xs font-medium text-slate-400">
        <span>{label}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-white font-mono">{value}</span>
        {subValue && <span className="text-xs text-slate-400 font-mono">{subValue}</span>}
      </div>
      {trend && (
        <div className="mt-2 flex items-center text-xs">
          <span
            className={`font-semibold ${
              trend.positive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trend.text}
          </span>
        </div>
      )}
    </div>
  );
};
