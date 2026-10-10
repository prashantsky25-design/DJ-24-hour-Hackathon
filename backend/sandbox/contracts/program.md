# ARES Experiment Program Specification

## Experiment ID
`exp_baseline_kan_001`

## Title
KAN Baseline — Kolmogorov–Arnold Networks on MNIST

## Objective
Reproduce and validate the KAN architecture (Liu et al., 2024) on MNIST as
the primary ARES baseline. Compare classification loss and accuracy against
the locked MLP reference in `prepare.py`.

## Paper Reference
- **Title**: KAN: Kolmogorov–Arnold Networks
- **Authors**: Ziming Liu et al.
- **ArXiv**: https://arxiv.org/abs/2404.19756
- **Year**: 2024

## Dataset
- **Name**: MNIST Handwritten Digits
- **Train samples**: 60,000
- **Test samples**: 10,000
- **Input shape**: 28×28 grayscale → flattened to 784
- **Classes**: 10 (digits 0–9)

## Model Architecture
```
Input (784) → KANLayer(784→64, grid=5) → BN → ReLU → KANLayer(64→10, grid=5)
```

## Hyperparameters
| Parameter      | Value             |
|----------------|-------------------|
| Epochs         | 5                 |
| Batch Size     | 64                |
| Optimizer      | AdamW             |
| Learning Rate  | 1e-3              |
| Weight Decay   | 1e-4              |
| LR Schedule    | CosineAnnealingLR |
| Grid Size      | 5 (Fourier basis) |
| Grad Clip      | 1.0               |
| Seed           | 42                |

## Dependencies

```requirements
torch==2.2.2
torchvision==0.17.2
numpy==1.26.4
```

## Success Criteria
The experiment is considered successful if:
- `metrics_experiment.json` is written to the working directory
- `experiment_loss < baseline_loss` (improvement over MLP reference)
- No uncaught exceptions during training

## What-If Extensions (for Coding Agent)
Suggested modifications to explore in future iterations:
1. Increase grid size to 10 for higher-resolution splines
2. Add a third KAN layer: 784 → 128 → 64 → 10
3. Replace Fourier basis with B-spline basis
4. Apply dropout (p=0.1) between KAN layers
5. Use label smoothing (ε=0.1) in the loss function

## Output Files
| File                      | Writer       | Consumer          |
|---------------------------|--------------|-------------------|
| `metrics_baseline.json`   | `prepare.py` | Git-Gated Runner  |
| `metrics_experiment.json` | `train.py`   | Git-Gated Runner  |
| `data/`                   | `prepare.py` | `train.py`        |

## Notes for Coding Agent
- **DO NOT** modify `prepare.py` — it is the locked evaluation contract.
- Always write `metrics_experiment.json` at the end of `train.py`.
- Keep the random seed = 42 for reproducible comparisons.
- The sandbox runs CPU-only PyTorch — avoid CUDA-specific ops.
