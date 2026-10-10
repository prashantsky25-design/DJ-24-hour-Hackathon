import { AgentNodeData } from '../types/agent';
import { TerminalLogEntry, ReasoningStep } from '../types/log';
import { MetricPoint, ExperimentMetadata, MetricComparisonSummary } from '../types/metric';

export const INITIAL_AGENTS: AgentNodeData[] = [
  {
    id: 'orchestrator',
    name: 'Central Orchestrator',
    role: 'Central Agent & n8n Router',
    status: 'running',
    currentTask: 'Coordinating multi-agent loop & monitoring convergence',
    tokensUsed: 42180,
    runtimeSec: 342,
    toolCallsCount: 19,
    lastActive: 'Just now',
    details: {
      model: 'Claude-3.5-Sonnet / GPT-4o',
      description: 'Orchestrates scientific hypothesis loop, parses signals, delegates sub-tasks',
      subtasksCompleted: 4,
      totalSubtasks: 6,
    },
  },
  {
    id: 'paper-reader',
    name: 'Paper Reader / Vision',
    role: 'Literature & Visual Parser',
    status: 'retired',
    currentTask: 'Extracted Eq. 3-7 and Table 2 from FlashAttention-2 paper',
    tokensUsed: 28450,
    runtimeSec: 88,
    toolCallsCount: 7,
    lastActive: '4m ago',
    details: {
      model: 'GPT-4o Vision',
      description: 'Ingests PDF papers, OCRs architecture diagrams, outputs structured math specs',
      subtasksCompleted: 3,
      totalSubtasks: 3,
    },
  },
  {
    id: 'dynamic-spawner',
    name: 'Dynamic Spawner',
    role: 'Task Decomposer',
    status: 'idle',
    currentTask: 'Waiting for next hypothesis stage',
    tokensUsed: 12400,
    runtimeSec: 45,
    toolCallsCount: 5,
    lastActive: '2m ago',
    details: {
      model: 'Mistral-Large',
      description: 'Analyzes bottleneck and dynamically provisions sub-agents into memory',
      subtasksCompleted: 2,
      totalSubtasks: 2,
    },
  },
  {
    id: 'arxiv-radar',
    name: 'Proactive ArXiv Radar',
    role: 'Background Monitor',
    status: 'running',
    currentTask: 'Scanning cs.LG for kernel fusion & attention tiling papers',
    tokensUsed: 16900,
    runtimeSec: 410,
    toolCallsCount: 12,
    lastActive: 'Just now',
    details: {
      model: 'Llama-3.3-70B',
      description: 'Proactive literature watcher checking new preprints matching experiment topic',
      subtasksCompleted: 5,
      totalSubtasks: 8,
    },
  },
  {
    id: 'coding-agent',
    name: 'Coding Agent',
    role: 'Code Generator & Optimizer',
    status: 'running',
    currentTask: 'Refactoring train.py forward pass with tiled FlashAttention kernel',
    tokensUsed: 64200,
    runtimeSec: 215,
    toolCallsCount: 23,
    lastActive: 'Just now',
    details: {
      model: 'Claude-3.7-Sonnet-Thinking',
      description: 'Modifies train.py within locked prepare.py contract and enforces gradient clipping',
      activeFile: 'train.py',
      subtasksCompleted: 7,
      totalSubtasks: 9,
    },
  },
  {
    id: 'debugging-agent',
    name: 'Debugging & Self-Healing',
    role: 'Runtime Healer',
    status: 'idle',
    currentTask: 'Resolved CUDA out-of-memory error by chunking block size to 256',
    tokensUsed: 21100,
    runtimeSec: 62,
    toolCallsCount: 4,
    lastActive: '1m ago',
    details: {
      model: 'DeepSeek-R1',
      description: 'Catches tracebacks, inspects VRAM stack, executes rollback or git patch',
      subtasksCompleted: 1,
      totalSubtasks: 1,
    },
  },
  {
    id: 'drafter-agent',
    name: 'Drafter Agent',
    role: 'LaTeX Scientific Writer',
    status: 'spawning',
    currentTask: 'Compiling NeurIPS report sections: Abstract & Methodology',
    tokensUsed: 8900,
    runtimeSec: 30,
    toolCallsCount: 2,
    lastActive: '30s ago',
    details: {
      model: 'Claude-3.5-Sonnet',
      description: 'Turns quantitative findings, charts, and code diffs into clean LaTeX papers',
      subtasksCompleted: 1,
      totalSubtasks: 4,
    },
  },
  {
    id: 'sandbox-executor',
    name: 'E2B Sandbox Executor',
    role: 'Isolated Compute Node',
    status: 'running',
    currentTask: 'Executing PyTorch epoch 18/30 on A100 GPU (80GB VRAM)',
    tokensUsed: 0,
    runtimeSec: 360,
    toolCallsCount: 30,
    lastActive: 'Live',
    details: {
      model: 'E2B Python Core (CUDA 12.4)',
      description: 'Secure execution sandbox enforcing prepare.py evaluation integrity and git gating',
      activeFile: 'train.py',
      subtasksCompleted: 18,
      totalSubtasks: 30,
    },
  },
];

export const INITIAL_EXPERIMENT: ExperimentMetadata = {
  id: 'exp-flashattn-04',
  name: 'FlashAttention-2 Kernel Fusion & Lion Optimizer',
  hypothesis: 'Replacing standard multi-head scaled dot-product attention with block-tiled SRAM-aware attention reduces VRAM footprint by 40% and speeds up epoch throughput by 1.8x without validation loss regression.',
  targetPaper: 'Dao et al. - FlashAttention-2: Faster Attention with Better Work Partitioning',
  dataset: 'WikiText-103 (Locked via prepare.py)',
  status: 'running',
  currentEpoch: 18,
  totalEpochs: 30,
  startTime: '2026-10-10 11:22:15',
  gpuDevice: 'NVIDIA A100-SXM4-80GB (PCIe 4.0)',
  gpuMemoryUsageMb: 8740,
  gpuMemoryPeakMb: 9120,
  gitCommitHash: 'a7f3b89e',
  gitRollbackPossible: true,
};

export const INITIAL_METRICS: MetricPoint[] = [
  { epoch: 1, step: 100, baselineTrainLoss: 3.82, baselineValLoss: 3.91, experimentTrainLoss: 3.79, experimentValLoss: 3.87, baselineAccuracy: 22.4, experimentAccuracy: 23.1, learningRate: 0.0005 },
  { epoch: 2, step: 200, baselineTrainLoss: 3.12, baselineValLoss: 3.25, experimentTrainLoss: 3.01, experimentValLoss: 3.11, baselineAccuracy: 31.8, experimentAccuracy: 34.2, learningRate: 0.00049 },
  { epoch: 3, step: 300, baselineTrainLoss: 2.64, baselineValLoss: 2.82, experimentTrainLoss: 2.45, experimentValLoss: 2.60, baselineAccuracy: 42.1, experimentAccuracy: 46.5, learningRate: 0.00047 },
  { epoch: 4, step: 400, baselineTrainLoss: 2.21, baselineValLoss: 2.45, experimentTrainLoss: 1.98, experimentValLoss: 2.18, baselineAccuracy: 51.0, experimentAccuracy: 56.4, learningRate: 0.00044 },
  { epoch: 5, step: 500, baselineTrainLoss: 1.89, baselineValLoss: 2.15, experimentTrainLoss: 1.62, experimentValLoss: 1.84, baselineAccuracy: 58.7, experimentAccuracy: 64.2, learningRate: 0.00040 },
  { epoch: 6, step: 600, baselineTrainLoss: 1.65, baselineValLoss: 1.92, experimentTrainLoss: 1.34, experimentValLoss: 1.57, baselineAccuracy: 64.3, experimentAccuracy: 70.8, learningRate: 0.00035 },
  { epoch: 7, step: 700, baselineTrainLoss: 1.48, baselineValLoss: 1.76, experimentTrainLoss: 1.12, experimentValLoss: 1.36, baselineAccuracy: 68.2, experimentAccuracy: 75.3, learningRate: 0.00030 },
  { epoch: 8, step: 800, baselineTrainLoss: 1.34, baselineValLoss: 1.62, experimentTrainLoss: 0.96, experimentValLoss: 1.19, baselineAccuracy: 71.5, experimentAccuracy: 79.1, learningRate: 0.00025 },
  { epoch: 9, step: 900, baselineTrainLoss: 1.22, baselineValLoss: 1.51, experimentTrainLoss: 0.83, experimentValLoss: 1.05, baselineAccuracy: 73.9, experimentAccuracy: 82.0, learningRate: 0.00020 },
  { epoch: 10, step: 1000, baselineTrainLoss: 1.12, baselineValLoss: 1.42, experimentTrainLoss: 0.72, experimentValLoss: 0.94, baselineAccuracy: 75.8, experimentAccuracy: 84.2, learningRate: 0.00016 },
  { epoch: 11, step: 1100, baselineTrainLoss: 1.04, baselineValLoss: 1.35, experimentTrainLoss: 0.63, experimentValLoss: 0.85, baselineAccuracy: 77.3, experimentAccuracy: 85.9, learningRate: 0.00012 },
  { epoch: 12, step: 1200, baselineTrainLoss: 0.97, baselineValLoss: 1.29, experimentTrainLoss: 0.55, experimentValLoss: 0.77, baselineAccuracy: 78.6, experimentAccuracy: 87.1, learningRate: 0.00009 },
  { epoch: 13, step: 1300, baselineTrainLoss: 0.91, baselineValLoss: 1.24, experimentTrainLoss: 0.49, experimentValLoss: 0.71, baselineAccuracy: 79.7, experimentAccuracy: 88.0, learningRate: 0.00007 },
  { epoch: 14, step: 1400, baselineTrainLoss: 0.86, baselineValLoss: 1.19, experimentTrainLoss: 0.44, experimentValLoss: 0.65, baselineAccuracy: 80.5, experimentAccuracy: 88.9, learningRate: 0.00005 },
  { epoch: 15, step: 1500, baselineTrainLoss: 0.82, baselineValLoss: 1.16, experimentTrainLoss: 0.39, experimentValLoss: 0.60, baselineAccuracy: 81.2, experimentAccuracy: 89.6, learningRate: 0.00003 },
  { epoch: 16, step: 1600, baselineTrainLoss: 0.78, baselineValLoss: 1.13, experimentTrainLoss: 0.36, experimentValLoss: 0.56, baselineAccuracy: 81.9, experimentAccuracy: 90.1, learningRate: 0.00002 },
  { epoch: 17, step: 1700, baselineTrainLoss: 0.75, baselineValLoss: 1.11, experimentTrainLoss: 0.33, experimentValLoss: 0.53, baselineAccuracy: 82.4, experimentAccuracy: 90.5, learningRate: 0.00001 },
  { epoch: 18, step: 1800, baselineTrainLoss: 0.73, baselineValLoss: 1.09, experimentTrainLoss: 0.31, experimentValLoss: 0.50, baselineAccuracy: 82.8, experimentAccuracy: 90.9, learningRate: 0.000008 },
];

export const COMPARISON_SUMMARIES: MetricComparisonSummary[] = [
  {
    metricName: 'Validation Loss',
    baselineValue: 1.09,
    experimentValue: 0.50,
    unit: '',
    isHigherBetter: false,
    deltaPercent: -54.1,
  },
  {
    metricName: 'Top-1 Accuracy',
    baselineValue: 82.8,
    experimentValue: 90.9,
    unit: '%',
    isHigherBetter: true,
    deltaPercent: 9.8,
  },
  {
    metricName: 'Training Throughput',
    baselineValue: 412,
    experimentValue: 798,
    unit: 'samples/sec',
    isHigherBetter: true,
    deltaPercent: 93.7,
  },
  {
    metricName: 'Peak VRAM Footprint',
    baselineValue: 14800,
    experimentValue: 8740,
    unit: 'MB',
    isHigherBetter: false,
    deltaPercent: -40.9,
  },
  {
    metricName: 'Epoch Latency',
    baselineValue: 24.5,
    experimentValue: 12.8,
    unit: 'sec/epoch',
    isHigherBetter: false,
    deltaPercent: -47.8,
  },
];

export const INITIAL_LOGS: TerminalLogEntry[] = [
  { id: '1', timestamp: '11:22:15', source: 'system', level: 'info', message: 'ARES Multi-Agent System initialized. n8n orchestrator connected.' },
  { id: '2', timestamp: '11:22:16', source: 'sandbox', level: 'info', message: 'E2B Sandbox initialized: template="pytorch-cuda12.4-a100", id="sbx-e2b-99042".' },
  { id: '3', timestamp: '11:22:18', source: 'system', level: 'info', message: 'Checking evaluation contract: "prepare.py" verified hash sha256:d8a2... [IMMUTABLE]' },
  { id: '4', timestamp: '11:22:20', source: 'agent', level: 'info', message: '[Paper Reader] Parsed Dao et al. (2023) Section 3: Tiling block size Br=128, Bc=64.', agentId: 'paper-reader' },
  { id: '5', timestamp: '11:22:25', source: 'agent', level: 'info', message: '[Coding Agent] Generating optimized FlashAttention tiled module in train.py...', agentId: 'coding-agent' },
  { id: '6', timestamp: '11:22:30', source: 'sandbox', level: 'info', message: 'Git pre-run commit created: commit a7f3b89e ("experiment: flashattention-2 lion opt")' },
  { id: '7', timestamp: '11:22:34', source: 'pytorch', level: 'info', message: 'PyTorch 2.4.0+cu124 initialized. Device: NVIDIA A100-SXM4-80GB. Mixed precision: bfloat16.' },
  { id: '8', timestamp: '11:23:01', source: 'stdout', level: 'info', message: 'Epoch 01/30 | Train Loss: 3.79 | Val Loss: 3.87 | Acc: 23.1% | Throughput: 792 smp/s | 12.9s' },
  { id: '9', timestamp: '11:24:12', source: 'stdout', level: 'info', message: 'Epoch 05/30 | Train Loss: 1.62 | Val Loss: 1.84 | Acc: 64.2% | Throughput: 796 smp/s | 12.7s' },
  { id: '10', timestamp: '11:25:22', source: 'stdout', level: 'info', message: 'Epoch 10/30 | Train Loss: 0.72 | Val Loss: 0.94 | Acc: 84.2% | Throughput: 798 smp/s | 12.8s' },
  { id: '11', timestamp: '11:26:45', source: 'stdout', level: 'info', message: 'Epoch 15/30 | Train Loss: 0.39 | Val Loss: 0.60 | Acc: 89.6% | Throughput: 801 smp/s | 12.8s' },
  { id: '12', timestamp: '11:27:32', source: 'agent', level: 'info', message: '[ArXiv Radar] Found preprint arXiv:2409.11293 "Tile-Level Softmax Fusion" - logging for reference.', agentId: 'arxiv-radar' },
  { id: '13', timestamp: '11:28:10', source: 'stdout', level: 'info', message: 'Epoch 18/30 | Train Loss: 0.31 | Val Loss: 0.50 | Acc: 90.9% | Throughput: 804 smp/s | 12.8s' },
  { id: '14', timestamp: '11:28:11', source: 'system', level: 'info', message: 'Evaluation gate passed: val_loss (0.50) < baseline (1.09). Rollback criteria: SAFE.' },
];

export const INITIAL_REASONING: ReasoningStep[] = [
  {
    id: 'r1',
    timestamp: '11:22:18',
    agentId: 'paper-reader',
    agentName: 'Paper Reader / Vision Agent',
    hypothesis: 'Can we adapt FlashAttention-2 tiling directly to the decoder architecture without breaking causal masks?',
    thought: 'The paper demonstrates that re-ordering outer loops over key/value blocks and inner loops over query blocks eliminates quadratic memory writes to HBM.',
    action: {
      tool: 'extract_paper_equations',
      params: { paperId: '2307.08691', sections: ['Algorithm 1', 'Section 3.2'] },
    },
    observation: 'Successfully retrieved causal masking kernel specification with online softmax renormalization factors.',
    decision: 'Pass math specification to Coding Agent with Br=128, Bc=64 constraint.',
    status: 'completed',
  },
  {
    id: 'r2',
    timestamp: '11:22:24',
    agentId: 'coding-agent',
    agentName: 'Coding Agent',
    hypothesis: 'Modifying train.py to replace torch.nn.MultiheadAttention with fused causal attention.',
    thought: 'Checking prepare.py evaluation contract to ensure input dimensions [B, S, H, D] and target labels remain untouched.',
    action: {
      tool: 'edit_train_code',
      params: { file: 'train.py', change: 'Add FlashAttention2CausalLayer', optimizer: 'Lion' },
    },
    observation: 'train.py updated cleanly. Syntax check passed. Git auto-commit recorded hash a7f3b89e.',
    decision: 'Submit execution job to E2B sandbox for 30 epochs with early-stop threshold delta=0.005.',
    status: 'completed',
  },
  {
    id: 'r3',
    timestamp: '11:25:30',
    agentId: 'debugging-agent',
    agentName: 'Debugging & Self-Healing Agent',
    hypothesis: 'Verify memory stability at batch_size=64 sequence_length=2048.',
    thought: 'Monitored VRAM peak at epoch 10: 8,740 MB out of 80,000 MB available. Zero CUDA OOM triggers detected.',
    action: {
      tool: 'check_vram_telemetry',
      params: { sampleRateHz: 10, thresholdMb: 70000 },
    },
    observation: 'Memory usage is stable and flat across all micro-batches. No fragmentation.',
    decision: 'No self-healing intervention required. Maintain training velocity.',
    status: 'completed',
  },
  {
    id: 'r4',
    timestamp: '11:28:10',
    agentId: 'orchestrator',
    agentName: 'Central Orchestrator',
    hypothesis: 'Evaluate milestone progression against baseline benchmark at epoch 18.',
    thought: 'Current experiment val_loss = 0.50 vs baseline = 1.09 (-54.1%). Top-1 accuracy reached 90.9% (+9.8%). Model is converging significantly faster than baseline.',
    action: {
      tool: 'compare_metrics_with_baseline',
      params: { epoch: 18, checkRollback: true },
    },
    observation: 'Regression check: Passed. Performance delta is strictly positive.',
    decision: 'Spawn Drafter Agent to begin preparing Section 4 (Empirical Evaluation) LaTeX tables.',
    status: 'in_progress',
  },
];

export const BASELINE_TRAIN_PY = `# === Baseline Model Architecture (train.py) ===
import torch
import torch.nn as nn
from prepare import get_dataloader, evaluate_model

class StandardAttention(nn.Module):
    def __init__(self, embed_dim=768, num_heads=12):
        super().__init__()
        self.mha = nn.MultiheadAttention(embed_dim, num_heads, batch_first=True)
    
    def forward(self, x, mask=None):
        out, _ = self.mha(x, x, x, attn_mask=mask)
        return out

# Training Loop
def train():
    loader = get_dataloader(batch_size=32)
    model = StandardAttention().cuda()
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-4, weight_decay=1e-2)
    # Standard quadratic attention: O(N^2) memory footprint
`;

export const EXPERIMENT_TRAIN_PY = `# === Experiment Model Architecture (train.py) [MODIFIED BY CODING AGENT] ===
import torch
import torch.nn as nn
from prepare import get_dataloader, evaluate_model  # Immutable contract
import flash_attn_interface  # Tiled SRAM-aware kernel

class FlashAttention2Block(nn.Module):
    def __init__(self, embed_dim=768, num_heads=12, block_size=128):
        super().__init__()
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.block_size = block_size
        self.qkv_proj = nn.Linear(embed_dim, 3 * embed_dim, bias=False)
        self.out_proj = nn.Linear(embed_dim, embed_dim, bias=False)
    
    def forward(self, x, causal=True):
        # Linear O(N) memory IO with SRAM kernel fusion
        qkv = self.qkv_proj(x)
        out = flash_attn_interface.fused_attention_v2(qkv, causal=causal)
        return self.out_proj(out)

# Training Loop - Enhanced with Lion Optimizer & Cosine Annealing
def train():
    loader = get_dataloader(batch_size=64)  # 2x batch size supported by VRAM savings
    model = FlashAttention2Block().cuda()
    # Autonomous hypothesis: Switched AdamW -> Lion optimizer (lr=1e-4)
    optimizer = torch.optim.Lion(model.parameters(), lr=1e-4, weight_decay=1e-1)
`;
