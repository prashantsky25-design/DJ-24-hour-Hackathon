export interface MetricPoint {
  epoch: number;
  step: number;
  baselineTrainLoss: number;
  baselineValLoss: number;
  experimentTrainLoss: number;
  experimentValLoss: number;
  baselineAccuracy?: number;
  experimentAccuracy?: number;
  learningRate?: number;
  timestamp?: string;
}

export interface MetricComparisonSummary {
  metricName: string;
  baselineValue: number;
  experimentValue: number;
  unit: string;
  isHigherBetter: boolean;
  deltaPercent: number;
}

export interface ExperimentMetadata {
  id: string;
  name: string;
  hypothesis: string;
  targetPaper: string;
  dataset: string;
  status: 'idle' | 'running' | 'paused' | 'evaluating' | 'completed' | 'halted';
  currentEpoch: number;
  totalEpochs: number;
  startTime: string;
  gpuDevice: string;
  gpuMemoryUsageMb: number;
  gpuMemoryPeakMb: number;
  gitCommitHash: string;
  gitRollbackPossible: boolean;
}
