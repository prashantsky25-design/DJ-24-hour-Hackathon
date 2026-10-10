export function formatNumber(val: number, decimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return val.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(val: number, includeSign = true): string {
  if (val === undefined || val === null || isNaN(val)) return '0%';
  const prefix = includeSign && val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
}

export function formatBytes(megabytes: number): string {
  if (megabytes >= 1024) {
    return `${(megabytes / 1024).toFixed(1)} GB`;
  }
  return `${megabytes} MB`;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}
