"""
train.py — EDITABLE Baseline Training Script
═══════════════════════════════════════════════════════════════════════════════
This file IS the target that the Coding Agent modifies each iteration.
The version here is the KAN (Kolmogorov–Arnold Networks) baseline for MNIST.

Coding Agent rules:
  1. You MAY change model architecture, optimiser, LR schedule, epochs.
  2. You MUST NOT modify prepare.py or import from it in a way that changes
     the evaluation logic.
  3. You MUST write final metrics to metrics_experiment.json in this format:
       {"loss": float, "accuracy": float, "execution_time_s": float}
  4. Loss must be a cross-entropy loss value (lower = better).

Reference: Liu et al., 2024 — "KAN: Kolmogorov–Arnold Networks"
           https://arxiv.org/abs/2404.19756
═══════════════════════════════════════════════════════════════════════════════
"""

import json
import random
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

# ── Re-use the locked seed & data loaders from prepare.py context ─────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

BATCH_SIZE = 64
DATA_DIR   = "./data"
DEVICE     = torch.device("cpu")

_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,)),
])

train_loader = DataLoader(
    datasets.MNIST(DATA_DIR, train=True,  download=False, transform=_transform),
    batch_size=BATCH_SIZE, shuffle=True,  num_workers=0,
)
test_loader  = DataLoader(
    datasets.MNIST(DATA_DIR, train=False, download=False, transform=_transform),
    batch_size=BATCH_SIZE, shuffle=False, num_workers=0,
)


# ── KAN Layer Implementation ───────────────────────────────────────────────────

class KANLayer(nn.Module):
    """
    Simplified KAN layer using B-spline-inspired learnable activation.

    Each input–output pair has its own trainable univariate function
    implemented as a learnable linear combination of basis functions.
    This CPU-friendly version uses Fourier basis for tractability.

    Parameters:
        in_features  : input dimension
        out_features : output dimension
        grid_size    : number of basis functions per activation
    """

    def __init__(self, in_features: int, out_features: int, grid_size: int = 5):
        super().__init__()
        self.in_features  = in_features
        self.out_features = out_features
        self.grid_size    = grid_size

        # Learnable coefficients: shape (out, in, grid_size)
        self.coefficients = nn.Parameter(
            torch.randn(out_features, in_features, grid_size) * 0.1
        )
        # Residual linear connection (φ(x) = silu(x) * w + spline)
        self.residual_weight = nn.Parameter(
            torch.randn(out_features, in_features) * 0.1
        )
        # Frequencies for Fourier basis: 1, 2, ..., grid_size//2 cos + sin
        k = torch.arange(1, grid_size // 2 + 2, dtype=torch.float32)
        self.register_buffer("frequencies", k)

    def _basis(self, x: torch.Tensor) -> torch.Tensor:
        """
        Compute Fourier basis features for input x.
        x shape: (batch, in_features)
        Returns: (batch, in_features, grid_size)
        """
        # x: (B, in) → (B, in, 1)
        x_exp = x.unsqueeze(-1)
        # frequencies: (k,) → (1, 1, k)
        freqs  = self.frequencies.view(1, 1, -1)
        cosines = torch.cos(x_exp * freqs * torch.pi)
        sines   = torch.sin(x_exp * freqs * torch.pi)

        # Interleave cos/sin and truncate to grid_size
        basis = torch.cat([cosines, sines], dim=-1)[..., : self.grid_size]
        return basis   # (B, in, grid_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Normalise x to [-1, 1] for stable Fourier basis
        x_norm = torch.tanh(x)

        # Spline part: (B, in, grid_size) × (out, in, grid_size) → (B, out)
        basis  = self._basis(x_norm)                         # (B, in, G)
        # einsum: batch b, input i, grid g → output o
        spline = torch.einsum("big,oig->bo", basis, self.coefficients)

        # Residual SiLU part
        residual = F.silu(x_norm) @ self.residual_weight.T   # (B, out)

        return spline + residual


# ── KAN Network ───────────────────────────────────────────────────────────────

class KANNet(nn.Module):
    """
    2-layer KAN for MNIST classification.
    Architecture: 784 → 64 → 10
    """

    def __init__(self, grid_size: int = 5):
        super().__init__()
        self.flatten = nn.Flatten()
        self.kan1    = KANLayer(784, 64,  grid_size=grid_size)
        self.kan2    = KANLayer(64,  10,  grid_size=grid_size)
        self.bn1     = nn.BatchNorm1d(64)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.flatten(x)
        x = self.kan1(x)
        x = self.bn1(x)
        x = F.relu(x)
        x = self.kan2(x)
        return x


# ── Training Loop ─────────────────────────────────────────────────────────────

def train_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
) -> float:
    """Run one training epoch; return average loss."""
    model.train()
    total_loss = 0.0
    for images, labels in loader:
        images, labels = images.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        loss = criterion(model(images), labels)
        loss.backward()
        # Gradient clipping — KAN coefficients can blow up early
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        total_loss += loss.item()
    return total_loss / len(loader)


def evaluate(model: nn.Module) -> dict:
    """Evaluate on test set; return {"loss": float, "accuracy": float}."""
    model.eval()
    criterion  = nn.CrossEntropyLoss()
    total_loss = 0.0
    correct = total = 0
    with torch.no_grad():
        for images, labels in test_loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            out  = model(images)
            loss = criterion(out, labels)
            total_loss += loss.item() * images.size(0)
            _, pred = out.max(1)
            correct += pred.eq(labels).sum().item()
            total   += images.size(0)
    return {
        "loss":     round(total_loss / total, 6),
        "accuracy": round(correct / total * 100, 4),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    EPOCHS    = 5
    LR        = 1e-3
    GRID_SIZE = 5

    print("=" * 60)
    print("ARES train.py — KAN Baseline (Liu et al., 2024)")
    print("=" * 60)
    print(f"Epochs    : {EPOCHS}")
    print(f"LR        : {LR}")
    print(f"Grid size : {GRID_SIZE}")
    print(f"Device    : {DEVICE}\n")

    model     = KANNet(grid_size=GRID_SIZE).to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
    criterion = nn.CrossEntropyLoss()

    t0 = time.time()

    for epoch in range(1, EPOCHS + 1):
        train_loss = train_epoch(model, train_loader, optimizer, criterion)
        scheduler.step()
        metrics    = evaluate(model)
        print(
            f"Epoch {epoch:2d}/{EPOCHS} | "
            f"Train Loss: {train_loss:.4f} | "
            f"Test  Loss: {metrics['loss']:.4f} | "
            f"Accuracy: {metrics['accuracy']:.2f}%"
        )

    elapsed = time.time() - t0
    final   = evaluate(model)
    final["execution_time_s"] = round(elapsed, 2)

    # ── Write experiment metrics (required by Git-Gated Runner) ────────────────
    with open("metrics_experiment.json", "w") as f:
        json.dump(final, f, indent=2)

    print("\n" + "=" * 60)
    print(f"Final Test Loss     : {final['loss']}")
    print(f"Final Test Accuracy : {final['accuracy']}%")
    print(f"Total Time          : {elapsed:.1f}s")
    print("metrics_experiment.json written ✓")
    print("=" * 60)
