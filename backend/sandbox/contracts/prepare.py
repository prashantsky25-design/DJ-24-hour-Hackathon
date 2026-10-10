"""
prepare.py — LOCKED Evaluation Contract (DO NOT MODIFY)
═══════════════════════════════════════════════════════════════════════════════
This file is immutable. It is owned by Module 2 (Sandbox Engine) and must
never be patched by the Coding Agent or any other automated process.

Responsibilities:
  1. Download / cache the MNIST dataset deterministically.
  2. Define the shared DataLoaders that train.py must import.
  3. Define the canonical evaluate() function used to score every run.
  4. Write baseline metrics to metrics_baseline.json so the Git-Gated Runner
     can compare experiment results against a stable reference.

Contract guarantees:
  - Random seed is fixed (SEED = 42) for reproducibility.
  - evaluate() always returns {"loss": float, "accuracy": float}.
  - metrics_baseline.json is written to the working directory.
═══════════════════════════════════════════════════════════════════════════════
"""

import json
import random
import time

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

# ── Determinism ───────────────────────────────────────────────────────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark     = False

# ── Config ────────────────────────────────────────────────────────────────────
BATCH_SIZE   = 64
DATA_DIR     = "./data"
DEVICE       = torch.device("cpu")   # E2B sandbox — CPU only

# ── Transforms ────────────────────────────────────────────────────────────────
_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,)),   # MNIST mean / std
])

# ── Datasets & DataLoaders ────────────────────────────────────────────────────
train_dataset = datasets.MNIST(
    root=DATA_DIR, train=True,  download=True, transform=_transform
)
test_dataset  = datasets.MNIST(
    root=DATA_DIR, train=False, download=True, transform=_transform
)

train_loader = DataLoader(
    train_dataset, batch_size=BATCH_SIZE, shuffle=True,
    num_workers=0, pin_memory=False,
)
test_loader  = DataLoader(
    test_dataset,  batch_size=BATCH_SIZE, shuffle=False,
    num_workers=0, pin_memory=False,
)


# ── Canonical Evaluation Function ─────────────────────────────────────────────

def evaluate(model: nn.Module, loader: DataLoader = test_loader) -> dict:
    """
    Score a model on the test set.

    Returns:
        {"loss": float, "accuracy": float}

    This function is the single source of truth for all metric comparisons
    in the Git-Gated Runner. It must not be changed.
    """
    model.eval()
    criterion  = nn.CrossEntropyLoss()
    total_loss = 0.0
    correct    = 0
    total      = 0

    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            outputs = model(images)
            loss    = criterion(outputs, labels)

            total_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total   += images.size(0)

    avg_loss = total_loss / total if total > 0 else float("inf")
    accuracy = correct / total    if total > 0 else 0.0

    return {"loss": round(avg_loss, 6), "accuracy": round(accuracy * 100, 4)}


# ── Baseline Reference Model ───────────────────────────────────────────────────

class _BaselineMLP(nn.Module):
    """
    Minimal 2-layer MLP used ONLY to compute the baseline reference metrics
    written to metrics_baseline.json. The Coding Agent replaces train.py
    with more sophisticated architectures; this baseline never changes.
    """

    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(28 * 28, 128),
            nn.ReLU(),
            nn.Linear(128, 10),
        )

    def forward(self, x):
        return self.net(x)


# ── Main: compute & persist baseline metrics ──────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("ARES prepare.py — Locked Evaluation Contract")
    print("=" * 60)

    # Download check
    print(f"[prepare] Train samples : {len(train_dataset):,}")
    print(f"[prepare] Test  samples : {len(test_dataset):,}")
    print(f"[prepare] Batch size    : {BATCH_SIZE}")
    print(f"[prepare] Device        : {DEVICE}")

    # Quick sanity pass: 1-epoch baseline to establish reference metrics
    print("\n[prepare] Training 1-epoch baseline MLP for reference metrics...")
    t0    = time.time()
    model = _BaselineMLP().to(DEVICE)
    opt   = torch.optim.Adam(model.parameters(), lr=1e-3)
    crit  = nn.CrossEntropyLoss()

    model.train()
    for images, labels in train_loader:
        images, labels = images.to(DEVICE), labels.to(DEVICE)
        opt.zero_grad()
        loss = crit(model(images), labels)
        loss.backward()
        opt.step()

    elapsed        = time.time() - t0
    baseline_metrics = evaluate(model)
    baseline_metrics["execution_time_s"] = round(elapsed, 2)

    # Persist for git-gated comparison
    with open("metrics_baseline.json", "w") as f:
        json.dump(baseline_metrics, f, indent=2)

    print(f"[prepare] Baseline loss     : {baseline_metrics['loss']}")
    print(f"[prepare] Baseline accuracy : {baseline_metrics['accuracy']}%")
    print(f"[prepare] Time              : {elapsed:.1f}s")
    print("[prepare] metrics_baseline.json written ✓")
    print("=" * 60)
