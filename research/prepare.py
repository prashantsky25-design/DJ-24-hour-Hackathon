"""
research/prepare.py
====================
Data preparation utility for ARES research experiments.

Responsibilities
----------------
- Set a reproducible global random seed (Python, NumPy, PyTorch).
- Load a CSV dataset from a caller-supplied path.
- Validate the dataset (exists, non-empty, correct columns, valid targets).
- Separate features from the target column, preventing target leakage.
- Perform a reproducible train/test split.
- Support both ``regression`` and ``classification`` task types.
- Handle missing feature values with a documented strategy.
- Return a structured ``PrepResult`` dataclass ready to pass to
  ``research/train.py``.

Relationship to the sandbox contract
-------------------------------------
The ARES sandbox (Member 2) may use a separate locked three-file contract
consisting of ``prepare.py``, ``train.py``, and ``program.md`` placed in a
temporary execution directory managed by E2B.  That contract is **distinct**
from this module.

This file (``research/prepare.py``) is a reusable *research utility* that
``research/train.py`` imports to load and split real experiment data.  It is
not the sandbox entry-point script.  If the sandbox contract is later
formalised, Member 4 will align the sandbox-facing ``prepare.py`` with this
module's return format without modifying this file's public interface.

Usage — as a library
--------------------
>>> from research.prepare import prepare_dataset
>>> result = prepare_dataset(
...     csv_path="data/iris.csv",
...     target_col="species",
...     task_type="classification",
...     seed=42,
...     test_size=0.2,
... )
>>> result.X_train.shape, result.y_train.shape
((120, 4), (120,))

Usage — as a CLI script
-----------------------
    python research/prepare.py \\
        --csv path/to/data.csv \\
        --target price \\
        --task regression \\
        --seed 42 \\
        --test-size 0.2
"""

from __future__ import annotations

import argparse
import os
import random
import sys
from dataclasses import dataclass, field
from typing import Literal, Optional

import numpy as np

# Pandas is intentionally NOT used — we keep the dependency footprint small
# and remain compatible with environments where pandas is absent.
# CSV loading uses only the Python stdlib + NumPy.

try:
    import torch
    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False


# ════════════════════════════════════════════════════════════════════════════
# Public types
# ════════════════════════════════════════════════════════════════════════════

TaskType = Literal["regression", "classification"]


@dataclass
class PrepResult:
    """
    Container returned by :func:`prepare_dataset`.

    Attributes
    ----------
    X_train : float32 NumPy array, shape (n_train, n_features)
    X_test  : float32 NumPy array, shape (n_test,  n_features)
    y_train : NumPy array, shape (n_train,)
              float32 for regression, int64 for classification
    y_test  : NumPy array, shape (n_test,)
              float32 for regression, int64 for classification
    feature_names  : list of column names that became features
    target_col     : name of the target column
    task_type      : ``"regression"`` or ``"classification"``
    n_classes      : number of unique classes (None for regression)
    class_labels   : sorted list of class labels (None for regression)
    n_train        : number of training samples
    n_test         : number of test samples
    n_features     : number of feature columns
    missing_dropped: number of rows dropped because of missing feature values
    seed           : random seed used for the split
    """

    X_train: np.ndarray
    X_test:  np.ndarray
    y_train: np.ndarray
    y_test:  np.ndarray

    feature_names:   list[str]
    target_col:      str
    task_type:       TaskType

    n_classes:       Optional[int]
    class_labels:    Optional[list]

    n_train:         int
    n_test:          int
    n_features:      int
    missing_dropped: int
    seed:            int


# ════════════════════════════════════════════════════════════════════════════
# Seed helper
# ════════════════════════════════════════════════════════════════════════════

def set_seed(seed: int) -> None:
    """
    Set a reproducible random seed across Python, NumPy, and PyTorch (if
    available).

    Parameters
    ----------
    seed : non-negative integer

    Raises
    ------
    ValueError : seed is negative or not an integer
    """
    if not isinstance(seed, int) or seed < 0:
        raise ValueError(f"seed must be a non-negative integer, got {seed!r}.")

    random.seed(seed)
    np.random.seed(seed)
    if _TORCH_AVAILABLE:
        import torch
        torch.manual_seed(seed)
        # Deterministic cuDNN ops (no-op on CPU, safe to call)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark     = False


# ════════════════════════════════════════════════════════════════════════════
# CSV loader
# ════════════════════════════════════════════════════════════════════════════

def _load_csv(csv_path: str) -> tuple[list[str], list[list[str]]]:
    """
    Read a CSV file with a header row.

    Returns
    -------
    (header, rows) where *header* is a list of column names and *rows* is a
    list of string-value lists (one per data row).

    Raises
    ------
    FileNotFoundError : path does not exist
    ValueError        : file is empty or has no data rows
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Dataset not found: '{csv_path}'. "
            "Check the path and ensure the file exists."
        )

    with open(csv_path, newline="", encoding="utf-8") as fh:
        import csv as _csv
        reader = _csv.reader(fh)
        rows   = list(reader)

    if len(rows) == 0:
        raise ValueError(f"Dataset file is empty: '{csv_path}'.")
    if len(rows) == 1:
        raise ValueError(
            f"Dataset has a header but no data rows: '{csv_path}'."
        )

    header    = [col.strip() for col in rows[0]]
    data_rows = rows[1:]
    return header, data_rows


# ════════════════════════════════════════════════════════════════════════════
# Main public API
# ════════════════════════════════════════════════════════════════════════════

def prepare_dataset(
    csv_path:  str,
    target_col: str,
    task_type:  TaskType,
    *,
    seed:      int   = 42,
    test_size: float = 0.2,
) -> PrepResult:
    """
    Load, validate, and split a CSV dataset for research experiments.

    Parameters
    ----------
    csv_path   : path to the CSV file (must have a header row)
    target_col : name of the column to use as the prediction target
    task_type  : ``"regression"`` or ``"classification"``
    seed       : random seed for the train/test split (default 42)
    test_size  : fraction of data for the test set, in (0, 1) (default 0.2)

    Returns
    -------
    PrepResult dataclass — see class docstring for field descriptions.

    Raises
    ------
    FileNotFoundError : csv_path does not exist
    ValueError        : various validation failures (documented inline)

    Notes on missing-value strategy
    --------------------------------
    Rows where **any feature column** has a non-parseable or blank value
    are dropped before the split.  A warning is printed if more than 5 % of
    rows are dropped so the caller is aware of significant data loss.
    The target column is validated separately: rows with missing or
    non-numeric/non-parseable target values raise ``ValueError`` to prevent
    silent corruption of the label distribution.
    """
    # ── 1. Argument validation ──────────────────────────────────────────────
    if task_type not in ("regression", "classification"):
        raise ValueError(
            f"task_type must be 'regression' or 'classification', "
            f"got '{task_type}'."
        )
    if not (0.0 < test_size < 1.0):
        raise ValueError(
            f"test_size must be in (0, 1), got {test_size}."
        )

    # ── 2. Set seed ─────────────────────────────────────────────────────────
    set_seed(seed)

    # ── 3. Load CSV ─────────────────────────────────────────────────────────
    header, raw_rows = _load_csv(csv_path)

    # ── 4. Validate target column ───────────────────────────────────────────
    if target_col not in header:
        raise ValueError(
            f"Target column '{target_col}' not found in CSV. "
            f"Available columns: {header}."
        )
    target_idx = header.index(target_col)

    # ── 5. Separate feature columns (no target leakage) ────────────────────
    feature_names = [col for col in header if col != target_col]
    if len(feature_names) == 0:
        raise ValueError(
            "No feature columns remain after removing the target column. "
            "The dataset must have at least one feature."
        )
    feature_indices = [header.index(col) for col in feature_names]

    # ── 6. Parse rows — handle missing feature values ──────────────────────
    X_raw:      list[list[float]] = []
    y_raw:      list               = []
    n_dropped = 0

    for row_num, row in enumerate(raw_rows, start=2):  # row 1 is header
        # Pad or trim rows that don't match the header width
        if len(row) != len(header):
            n_dropped += 1
            continue

        # -- Parse target --
        raw_target = row[target_idx].strip()
        if raw_target == "":
            raise ValueError(
                f"Row {row_num}: target column '{target_col}' is empty. "
                "All target values must be present."
            )
        if task_type == "regression":
            try:
                y_val: float | str = float(raw_target)
            except ValueError:
                raise ValueError(
                    f"Row {row_num}: target column '{target_col}' contains "
                    f"non-numeric value '{raw_target}' for a regression task."
                )
            if not np.isfinite(y_val):
                raise ValueError(
                    f"Row {row_num}: target value {y_val} is not finite."
                )
        else:
            # Classification — labels can be strings or ints; keep as-is
            y_val = raw_target

        # -- Parse features: drop row if any feature is non-parseable --
        feature_vals: list[float] = []
        row_valid = True
        for fi in feature_indices:
            raw_feat = row[fi].strip()
            if raw_feat == "":
                row_valid = False
                break
            try:
                fval = float(raw_feat)
            except ValueError:
                row_valid = False
                break
            feature_vals.append(fval)

        if not row_valid:
            n_dropped += 1
            continue

        X_raw.append(feature_vals)
        y_raw.append(y_val)

    n_total = len(X_raw) + n_dropped
    if len(X_raw) == 0:
        raise ValueError(
            f"No valid rows remain after parsing '{csv_path}'. "
            f"All {n_total} rows had missing or invalid values."
        )

    # Warn loudly if we dropped more than 5 % of data
    drop_fraction = n_dropped / n_total if n_total > 0 else 0.0
    if drop_fraction > 0.05:
        print(
            f"[prepare_dataset] WARNING: dropped {n_dropped}/{n_total} rows "
            f"({drop_fraction:.1%}) due to missing feature values.",
            file=sys.stderr,
        )

    # ── 7. Build arrays ─────────────────────────────────────────────────────
    X = np.array(X_raw, dtype=np.float32)

    if task_type == "regression":
        y = np.array(y_raw, dtype=np.float32)
    else:
        # Encode string labels as integer indices; preserve original label list
        unique_labels = sorted(set(y_raw),
                               key=lambda v: (isinstance(v, str), str(v)))
        label_to_idx  = {lbl: i for i, lbl in enumerate(unique_labels)}
        y = np.array([label_to_idx[lbl] for lbl in y_raw], dtype=np.int64)

    # ── 8. Train/test split ─────────────────────────────────────────────────
    n_total_valid = len(X)
    n_test  = max(1, int(round(n_total_valid * test_size)))
    n_train = n_total_valid - n_test

    if n_train < 1:
        raise ValueError(
            f"Not enough data for a train/test split: "
            f"{n_total_valid} rows with test_size={test_size} "
            f"→ {n_train} train, {n_test} test."
        )

    if task_type == "classification":
        # Use stratified split when feasible
        unique_classes, counts = np.unique(y, return_counts=True)
        min_count = int(counts.min())
        n_classes = len(unique_classes)

        # Stratification is feasible only when each class has at least 2 samples
        # and the test set can hold at least 1 sample per class.
        n_test_needed = n_classes  # at minimum 1 test sample per class
        if min_count < 2 or n_test < n_test_needed:
            print(
                f"[prepare_dataset] WARNING: Stratified split not feasible "
                f"(min class count={min_count}, n_test={n_test}, "
                f"n_classes={n_classes}). Using random split instead.",
                file=sys.stderr,
            )
            stratify = False
        else:
            stratify = True
    else:
        stratify     = False
        unique_labels = None
        n_classes     = None

    # Perform the split via index shuffling
    rng      = np.random.default_rng(seed)
    indices  = np.arange(n_total_valid)
    rng.shuffle(indices)

    if task_type == "classification" and stratify:
        # Manual stratified split: sample proportionally per class
        train_idx: list[int] = []
        test_idx:  list[int] = []
        class_indices = {
            cls: indices[y[indices] == cls].tolist()
            for cls in unique_classes
        }
        for cls, cls_idx in class_indices.items():
            n_cls_test  = max(1, int(round(len(cls_idx) * test_size)))
            test_idx.extend(cls_idx[:n_cls_test])
            train_idx.extend(cls_idx[n_cls_test:])
        # Shuffle each partition to mix classes
        rng.shuffle(train_idx)
        rng.shuffle(test_idx)
        train_idx_arr = np.array(train_idx, dtype=np.int64)
        test_idx_arr  = np.array(test_idx,  dtype=np.int64)
    else:
        test_idx_arr  = indices[:n_test]
        train_idx_arr = indices[n_test:]

    X_train = X[train_idx_arr]
    X_test  = X[test_idx_arr]
    y_train = y[train_idx_arr]
    y_test  = y[test_idx_arr]

    # ── 9. Build classification label metadata ──────────────────────────────
    if task_type == "classification":
        unique_classes_final, counts = np.unique(y, return_counts=True)
        n_classes    = int(len(unique_classes_final))
        class_labels = unique_labels if unique_labels is not None else \
                       unique_classes_final.tolist()
    else:
        n_classes    = None
        class_labels = None

    # ── 10. Print preparation summary (no raw data values) ─────────────────
    print(f"[prepare_dataset] dataset  : {os.path.basename(csv_path)}")
    print(f"[prepare_dataset] task     : {task_type}")
    print(f"[prepare_dataset] features : {len(feature_names)} columns")
    print(f"[prepare_dataset] rows     : {n_total_valid} valid "
          f"(dropped {n_dropped})")
    print(f"[prepare_dataset] split    : {len(y_train)} train / "
          f"{len(y_test)} test  (seed={seed})")
    if task_type == "classification":
        print(f"[prepare_dataset] classes  : {n_classes}")
        strat_str = "stratified" if (task_type == "classification" and stratify) else "random"
        print(f"[prepare_dataset] split type: {strat_str}")

    return PrepResult(
        X_train=X_train,
        X_test=X_test,
        y_train=y_train,
        y_test=y_test,
        feature_names=feature_names,
        target_col=target_col,
        task_type=task_type,
        n_classes=n_classes,
        class_labels=class_labels,
        n_train=int(len(y_train)),
        n_test=int(len(y_test)),
        n_features=int(X.shape[1]),
        missing_dropped=n_dropped,
        seed=seed,
    )


# ════════════════════════════════════════════════════════════════════════════
# CLI entry point
# ════════════════════════════════════════════════════════════════════════════

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="ARES research data preparation utility",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--csv",       required=True, help="Path to the CSV file")
    p.add_argument("--target",    required=True, help="Target column name")
    p.add_argument("--task",      required=True,
                   choices=["regression", "classification"],
                   help="Task type")
    p.add_argument("--seed",      type=int, default=42,
                   help="Random seed for reproducibility")
    p.add_argument("--test-size", type=float, default=0.2,
                   help="Fraction of data for the test set")
    return p


def main() -> None:
    parser = _build_parser()
    args   = parser.parse_args()

    result = prepare_dataset(
        csv_path   = args.csv,
        target_col = args.target,
        task_type  = args.task,
        seed       = args.seed,
        test_size  = args.test_size,
    )

    print(f"\nX_train shape : {result.X_train.shape}")
    print(f"X_test  shape : {result.X_test.shape}")
    print(f"y_train dtype : {result.y_train.dtype}")
    if result.class_labels:
        print(f"Class labels  : {result.class_labels}")


if __name__ == "__main__":
    main()
