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
    <div
      className="rounded-xl p-4 flex flex-col justify-between border transition-all shadow-sm"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div className="flex items-center justify-between text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        <span>{label}</span>
        {icon && <span style={{ color: 'var(--text-muted)' }}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight font-mono" style={{ color: 'var(--text-primary)' }}>
          {value}
        </span>
        {subValue && (
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {subValue}
          </span>
        )}
      </div>
      {trend && (
        <div className="mt-2 flex items-center text-xs">
          <span
            className="font-semibold"
            style={{ color: trend.positive ? 'var(--success)' : 'var(--error)' }}
          >
            {trend.text}
          </span>
        </div>
      )}
    </div>
  );
};
