"""
research/train.py
==================
KAN baseline training pipeline for ARES Member 4.

IMPORTANT DISCLAIMERS
---------------------
This pipeline trains a **simplified KAN-style model** that is architecturally
inspired by, but NOT an exact reproduction of:

    Liu et al. (2024) "KAN: Kolmogorov-Arnold Networks"
    arXiv:2404.19756  https://arxiv.org/abs/2404.19756

Features intentionally omitted (to keep the baseline tractable on CPU):
    - Adaptive grid refinement (paper Section 2.4)
    - Entropy-based regularisation / sparsity (paper Section 2.5)
    - Pruning and symbolic regression (paper Section 3)

Results produced by this pipeline are labelled "pipeline_test" in their
status field and must not be presented as a reproduction of the paper.

Usage — CLI
-----------
    python research/train.py \\
        --csv       data/synthetic.csv \\
        --target    y \\
        --task      regression \\
        --seed      42 \\
        --test-size 0.2 \\
        --hidden    8 8 \\
        --grid-size 5 \\
        --degree    3 \\
        --epochs    100 \\
        --lr        0.01 \\
        --batch     64 \\
        --out-dir   benchmarks/kan_baseline/experiments

Usage — as a library
--------------------
    from research.train import run_experiment, TrainConfig
    cfg = TrainConfig(csv_path="...", target_col="y", task_type="regression")
    result = run_experiment(cfg)

Output files (all under ``--out-dir/<experiment_id>/``)
---------------------------------------------------------
    config.json    — all hyperparameters and dataset provenance
    results.json   — metrics, runtime, status, artefact paths
    training.log   — per-epoch loss log
    loss_curve.png — training loss plot (if matplotlib succeeds)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
import traceback
from dataclasses import dataclass, field, asdict
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import matplotlib
matplotlib.use("Agg")   # non-interactive: safe on all systems
import matplotlib.pyplot as plt

# ── Repo root on path so we can import sibling packages ────────────────────
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from research.prepare import prepare_dataset, PrepResult
from research.metrics import regression_metrics, classification_metrics
from benchmarks.kan_baseline.model import build_kan, KAN


# ════════════════════════════════════════════════════════════════════════════
# Configuration dataclass
# ════════════════════════════════════════════════════════════════════════════

@dataclass
class TrainConfig:
    """
    All configuration needed for one training run.

    Every field has a default so callers need only override what they care
    about.  The CLI maps directly to this dataclass.
    """
    # ── Dataset ──────────────────────────────────────────────────────────────
    csv_path:    str   = ""
    target_col:  str   = "y"
    task_type:   str   = "regression"   # "regression" | "classification"
    seed:        int   = 42
    test_size:   float = 0.2

    # ── Model ─────────────────────────────────────────────────────────────────
    hidden_sizes: list[int] = field(default_factory=lambda: [8, 8])
    grid_size:    int       = 5
    degree:       int       = 3

    # ── Training ──────────────────────────────────────────────────────────────
    epochs:     int   = 100
    lr:         float = 0.01
    batch_size: int   = 64

    # ── Output ────────────────────────────────────────────────────────────────
    out_dir: str = os.path.join(
        os.path.dirname(__file__), "..",
        "benchmarks", "kan_baseline", "experiments"
    )

    def validate(self) -> None:
        """
        Validate all fields up front.

        Raises
        ------
        ValueError : any argument is out of range or missing
        """
        if not self.csv_path:
            raise ValueError("csv_path must not be empty.")
        if self.task_type not in ("regression", "classification"):
            raise ValueError(
                f"task_type must be 'regression' or 'classification', "
                f"got '{self.task_type}'."
            )
        if not (0.0 < self.test_size < 1.0):
            raise ValueError(
                f"test_size must be in (0, 1), got {self.test_size}."
            )
        if self.seed < 0:
            raise ValueError(f"seed must be >= 0, got {self.seed}.")
        if not self.hidden_sizes or any(h < 1 for h in self.hidden_sizes):
            raise ValueError(
                f"hidden_sizes must be a non-empty list of positive ints, "
                f"got {self.hidden_sizes}."
            )
        if self.grid_size < 1:
            raise ValueError(f"grid_size must be >= 1, got {self.grid_size}.")
        if self.degree < 1:
            raise ValueError(f"degree must be >= 1, got {self.degree}.")
        if self.epochs < 1:
            raise ValueError(f"epochs must be >= 1, got {self.epochs}.")
        if self.lr <= 0:
            raise ValueError(f"lr must be > 0, got {self.lr}.")
        if self.batch_size < 1:
            raise ValueError(f"batch_size must be >= 1, got {self.batch_size}.")


# ════════════════════════════════════════════════════════════════════════════
# Training loop (pure function — no side effects, testable)
# ════════════════════════════════════════════════════════════════════════════

def _train_loop(
    model:      KAN,
    X_tr:       torch.Tensor,
    y_tr:       torch.Tensor,
    cfg:        TrainConfig,
    log_fh,
) -> list[float]:
    """
    Run the mini-batch training loop and return per-epoch loss history.

    Parameters
    ----------
    model   : initialised KAN
    X_tr    : (n_train, n_features) float32 tensor
    y_tr    : (n_train,) float32 (regression) or int64 (classification) tensor
    cfg     : TrainConfig
    log_fh  : open file handle for the training log (text mode)

    Returns
    -------
    history : list of mean per-epoch losses (float)
    """
    is_clf  = cfg.task_type == "classification"
    opt     = torch.optim.Adam(model.parameters(), lr=cfg.lr)
    loss_fn = nn.CrossEntropyLoss() if is_clf else nn.MSELoss()
    n       = X_tr.shape[0]
    history: list[float] = []

    model.train()
    for epoch in range(1, cfg.epochs + 1):
        idx   = torch.randperm(n)
        X_sh  = X_tr[idx]
        y_sh  = y_tr[idx]

        epoch_loss, steps = 0.0, 0
        for start in range(0, n, cfg.batch_size):
            xb = X_sh[start : start + cfg.batch_size]
            yb = y_sh[start : start + cfg.batch_size]

            opt.zero_grad()
            out  = model(xb)         # (batch, out_features)

            if is_clf:
                loss = loss_fn(out, yb.long())
            else:
                loss = loss_fn(out.squeeze(1), yb)

            loss.backward()
            # Gradient clipping — prevents exploding gradients with B-splines
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            opt.step()

            epoch_loss += loss.item()
            steps      += 1

        avg = epoch_loss / steps
        history.append(avg)

        line = f"epoch={epoch:04d}  loss={avg:.8f}"
        log_fh.write(line + "\n")
        if epoch % max(1, cfg.epochs // 5) == 0 or epoch == 1:
            print(f"  {line}")

    return history


# ════════════════════════════════════════════════════════════════════════════
# Evaluate — returns metrics dict
# ════════════════════════════════════════════════════════════════════════════

def _evaluate(
    model:     KAN,
    X_te:      torch.Tensor,
    y_te:      torch.Tensor,
    task_type: str,
) -> dict:
    """
    Run inference on the test set and return a metrics dict.

    Returns a JSON-serialisable dict from research.metrics.
    """
    model.eval()
    with torch.no_grad():
        out = model(X_te)   # (n_test, out_features)

    if task_type == "regression":
        preds = out.squeeze(1).cpu().numpy()
        targs = y_te.cpu().numpy()
        return regression_metrics(preds, targs)
    else:
        preds_cls = out.argmax(dim=1).cpu().numpy()
        targs_cls = y_te.cpu().numpy()
        return classification_metrics(
            preds_cls, targs_cls, include_confusion_matrix=True
        )


# ════════════════════════════════════════════════════════════════════════════
# Plot helper
# ════════════════════════════════════════════════════════════════════════════

def _save_loss_plot(history: list[float], path: str) -> bool:
    """
    Save a loss-curve PNG.  Returns True on success, False on any failure.
    Never raises — plotting failures must not abort a training run.
    """
    try:
        fig, ax = plt.subplots(figsize=(8, 4))
        ax.plot(range(1, len(history) + 1), history,
                linewidth=1.5, color="#2563eb")
        ax.set_xlabel("Epoch")
        ax.set_ylabel("Loss")
        ax.set_title("KAN Baseline — Training Loss")
        ax.set_yscale("log")
        ax.grid(True, alpha=0.3)
        fig.tight_layout()
        fig.savefig(path, dpi=120)
        plt.close(fig)
        return True
    except Exception:
        return False


# ════════════════════════════════════════════════════════════════════════════
# Main public API
# ════════════════════════════════════════════════════════════════════════════

def run_experiment(cfg: TrainConfig) -> dict:
    """
    Execute one full training run and return the results dict.

    This function:
      1. Validates cfg.
      2. Calls prepare_dataset to load and split the data.
      3. Builds the KAN model.
      4. Runs the training loop.
      5. Evaluates on the test set.
      6. Saves config.json, results.json, training.log, loss_curve.png.
      7. Returns the results dict (same as results.json content).

    On any unhandled error:
      - status is set to "failed"
      - error_message and traceback are recorded
      - results.json is still written with status="failed"
      - The exception is re-raised so callers can react

    Parameters
    ----------
    cfg : TrainConfig — all hyperparameters and dataset paths

    Returns
    -------
    dict — the full results record (JSON-serialisable)
    """
    experiment_id = str(uuid.uuid4())[:8]
    t_start       = time.time()

    # ── 1. Validate ─────────────────────────────────────────────────────────
    cfg.validate()

    # ── 2. Output directory ─────────────────────────────────────────────────
    exp_dir = os.path.join(
        os.path.abspath(cfg.out_dir),
        experiment_id,
    )
    os.makedirs(exp_dir, exist_ok=True)

    log_path     = os.path.join(exp_dir, "training.log")
    plot_path    = os.path.join(exp_dir, "loss_curve.png")
    config_path  = os.path.join(exp_dir, "config.json")
    results_path = os.path.join(exp_dir, "results.json")

    # ── 3. Write config immediately so it survives a crash ──────────────────
    config_record = {
        "experiment_id":  experiment_id,
        "csv_path":       cfg.csv_path,
        "target_col":     cfg.target_col,
        "task_type":      cfg.task_type,
        "seed":           cfg.seed,
        "test_size":      cfg.test_size,
        "hidden_sizes":   cfg.hidden_sizes,
        "grid_size":      cfg.grid_size,
        "degree":         cfg.degree,
        "epochs":         cfg.epochs,
        "lr":             cfg.lr,
        "batch_size":     cfg.batch_size,
    }
    with open(config_path, "w") as f:
        json.dump(config_record, f, indent=2)

    print(f"\n{'='*60}")
    print(f"ARES KAN Baseline — Experiment {experiment_id}")
    print(f"{'='*60}")
    print(f"  out_dir : {exp_dir}")

    # Initialise a failure-safe results skeleton
    results: dict = {
        "experiment_id":    experiment_id,
        "status":           "failed",
        "error_message":    None,
        "dataset_provenance": os.path.basename(cfg.csv_path),
        "task_type":        cfg.task_type,
        "seed":             cfg.seed,
        "model_description": None,
        "n_parameters":     None,
        "metrics":          None,
        "final_train_loss": None,
        "elapsed_seconds":  None,
        "artefacts": {
            "config":    config_path,
            "results":   results_path,
            "log":       log_path,
            "loss_plot": None,
        },
        "disclaimer": (
            "SIMPLIFIED KAN IMPLEMENTATION — not an exact reproduction of "
            "Liu et al. (2024) arXiv:2404.19756. "
            "Missing: adaptive grid refinement, entropy regularisation, "
            "pruning, and symbolic regression."
        ),
    }

    try:
        # ── 4. Prepare data ─────────────────────────────────────────────────
        print("\n[1/5] Loading and preparing dataset...")
        data: PrepResult = prepare_dataset(
            csv_path   = cfg.csv_path,
            target_col = cfg.target_col,
            task_type  = cfg.task_type,
            seed       = cfg.seed,
            test_size  = cfg.test_size,
        )

        # ── 5. Build model ───────────────────────────────────────────────────
        print("\n[2/5] Building KAN model...")
        out_features = (
            data.n_classes if cfg.task_type == "classification" else 1
        )
        model = build_kan(
            in_features  = data.n_features,
            hidden_sizes = cfg.hidden_sizes,
            out_features = out_features,
            grid_size    = cfg.grid_size,
            degree       = cfg.degree,
        )
        results["model_description"] = model.description()
        results["n_parameters"]      = model.n_parameters
        print(f"  architecture : {model.description()}")
        print(f"  parameters   : {model.n_parameters}")

        # ── 6. Convert to tensors ────────────────────────────────────────────
        X_tr = torch.from_numpy(data.X_train)
        y_tr = torch.from_numpy(data.y_train)
        X_te = torch.from_numpy(data.X_test)
        y_te = torch.from_numpy(data.y_test)

        # ── 7. Train ─────────────────────────────────────────────────────────
        print(f"\n[3/5] Training for {cfg.epochs} epochs on CPU...")
        with open(log_path, "w") as log_fh:
            history = _train_loop(model, X_tr, y_tr, cfg, log_fh)

        results["final_train_loss"] = round(history[-1], 8)

        # ── 8. Evaluate ──────────────────────────────────────────────────────
        print("\n[4/5] Evaluating on test set...")
        metrics = _evaluate(model, X_te, y_te, cfg.task_type)
        results["metrics"] = metrics

        if cfg.task_type == "regression":
            print(f"  test_mse  = {metrics['mse']:.6f}")
            print(f"  test_rmse = {metrics['rmse']:.6f}")
            print(f"  test_mae  = {metrics['mae']:.6f}")
            print(f"  test_r2   = {metrics['r2']:.6f}")
        else:
            print(f"  accuracy  = {metrics['accuracy']:.6f}")
            print(f"  macro_f1  = {metrics['macro_f1']:.6f}")

        # ── 9. Plot ──────────────────────────────────────────────────────────
        print("\n[5/5] Saving artefacts...")
        plot_ok = _save_loss_plot(history, plot_path)
        if plot_ok:
            results["artefacts"]["loss_plot"] = plot_path
            print(f"  loss plot : {plot_path}")
        else:
            print("  loss plot : FAILED (non-fatal)")

        print(f"  log       : {log_path}")

        # ── 10. Finalise ──────────────────────────────────────────────────────
        results["elapsed_seconds"] = round(time.time() - t_start, 2)
        results["status"]          = "pipeline_test_completed"

    except Exception as exc:
        results["error_message"]   = str(exc)
        results["elapsed_seconds"] = round(time.time() - t_start, 2)
        # Keep status = "failed"
        tb = traceback.format_exc()
        print(f"\nERROR: {exc}", file=sys.stderr)
        print(tb, file=sys.stderr)
        with open(results_path, "w") as f:
            json.dump(results, f, indent=2)
        raise

    # ── Write results regardless of success ──────────────────────────────────
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)

    elapsed = results["elapsed_seconds"]
    print(f"\n{'='*60}")
    print(f"STATUS  : {results['status']}")
    print(f"Elapsed : {elapsed}s")
    print(f"Results : {results_path}")
    print(f"{'='*60}\n")

    return results


# ════════════════════════════════════════════════════════════════════════════
# CLI
# ════════════════════════════════════════════════════════════════════════════

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description=(
            "ARES KAN baseline training pipeline. "
            "Trains a simplified KAN-style model on a CSV dataset."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--csv",       required=True,
                   help="Path to the CSV dataset")
    p.add_argument("--target",    required=True,
                   help="Target column name")
    p.add_argument("--task",      required=True,
                   choices=["regression", "classification"],
                   help="Task type")
    p.add_argument("--seed",      type=int, default=42)
    p.add_argument("--test-size", type=float, default=0.2)
    p.add_argument("--hidden",    type=int, nargs="+", default=[8, 8],
                   metavar="N",
                   help="Hidden layer widths, e.g. --hidden 8 8")
    p.add_argument("--grid-size", type=int, default=5)
    p.add_argument("--degree",    type=int, default=3)
    p.add_argument("--epochs",    type=int, default=100)
    p.add_argument("--lr",        type=float, default=0.01)
    p.add_argument("--batch",     type=int, default=64)
    p.add_argument("--out-dir",
                   default=os.path.join(
                       os.path.dirname(__file__), "..",
                       "benchmarks", "kan_baseline", "experiments"
                   ),
                   help="Root directory for experiment output")
    return p


def main() -> None:
    args = _build_parser().parse_args()
    cfg  = TrainConfig(
        csv_path     = args.csv,
        target_col   = args.target,
        task_type    = args.task,
        seed         = args.seed,
        test_size    = args.test_size,
        hidden_sizes = args.hidden,
        grid_size    = args.grid_size,
        degree       = args.degree,
        epochs       = args.epochs,
        lr           = args.lr,
        batch_size   = args.batch,
        out_dir      = args.out_dir,
    )
    run_experiment(cfg)


if __name__ == "__main__":
    main()
