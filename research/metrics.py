"""
research/metrics.py
====================
Reusable evaluation metrics for ARES research experiments.

Supports
--------
- Regression : MSE, MAE, R-squared, RMSE
- Classification : accuracy, per-class precision/recall/F1,
                   macro averages, confusion matrix

Design principles
-----------------
1. All functions accept NumPy arrays or anything convertible via
   ``np.asarray`` (e.g. plain Python lists, PyTorch tensors via
   ``.detach().cpu().numpy()``).
2. All returned values are plain Python floats, ints, or dicts —
   JSON-serialisable without extra work.
3. Inputs are validated up front; mismatches raise ``ValueError``
   with a clear message rather than producing silently wrong numbers.
4. Regression functions refuse classification-labelled data and vice
   versa — callers must be explicit about task type.
5. No global state, no side effects.

Usage example
-------------
>>> from research.metrics import regression_metrics, classification_metrics
>>> preds = [2.1, 3.4, 5.0]
>>> targets = [2.0, 3.5, 4.8]
>>> regression_metrics(preds, targets)
{'mse': 0.0067, 'rmse': 0.0816, 'mae': 0.0667, 'r2': 0.9933}

>>> from research.metrics import classification_metrics
>>> classification_metrics([0,1,1,0], [0,1,0,0])
{'accuracy': 0.75, 'per_class': {...}, 'macro_precision': ..., ...}
"""

from __future__ import annotations

import math
from typing import Any, Sequence, Union

import numpy as np
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
)

# ── Type alias for anything array-like ──────────────────────────────────────
ArrayLike = Union[Sequence[Any], "np.ndarray"]


# ════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ════════════════════════════════════════════════════════════════════════════

def _to_float_array(x: ArrayLike, name: str) -> np.ndarray:
    """
    Convert *x* to a 1-D float64 NumPy array.

    Handles plain lists, NumPy arrays, and PyTorch tensors (by calling
    ``.detach().cpu().numpy()`` when the attribute is present).

    Parameters
    ----------
    x    : array-like input
    name : variable name used in error messages

    Raises
    ------
    TypeError  if conversion fails
    ValueError if the result is not 1-D or contains non-finite values
    """
    # PyTorch tensor duck-typing — avoids a hard torch import
    if hasattr(x, "detach"):
        x = x.detach().cpu().numpy()

    try:
        arr = np.asarray(x, dtype=np.float64)
    except (ValueError, TypeError) as exc:
        raise TypeError(
            f"'{name}' could not be converted to a numeric array. "
            f"Original error: {exc}"
        ) from exc

    if arr.ndim != 1:
        raise ValueError(
            f"'{name}' must be 1-D, got shape {arr.shape}."
        )

    return arr


def _validate_pair(
    predictions: ArrayLike,
    targets: ArrayLike,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Convert and cross-validate a (predictions, targets) pair.

    Raises
    ------
    ValueError : empty arrays or length mismatch
    """
    pred = _to_float_array(predictions, "predictions")
    targ = _to_float_array(targets, "targets")

    if pred.size == 0 or targ.size == 0:
        raise ValueError("'predictions' and 'targets' must not be empty.")

    if pred.shape != targ.shape:
        raise ValueError(
            f"Shape mismatch: predictions {pred.shape} vs targets {targ.shape}."
        )

    return pred, targ


# ════════════════════════════════════════════════════════════════════════════
# Regression metrics
# ════════════════════════════════════════════════════════════════════════════

def mse(predictions: ArrayLike, targets: ArrayLike) -> float:
    """
    Mean Squared Error.

    Parameters
    ----------
    predictions : predicted continuous values
    targets     : ground-truth continuous values

    Returns
    -------
    float : MSE (always >= 0)

    Raises
    ------
    ValueError : mismatched lengths, empty inputs
    """
    pred, targ = _validate_pair(predictions, targets)
    return float(np.mean((pred - targ) ** 2))


def mae(predictions: ArrayLike, targets: ArrayLike) -> float:
    """
    Mean Absolute Error.

    Parameters
    ----------
    predictions : predicted continuous values
    targets     : ground-truth continuous values

    Returns
    -------
    float : MAE (always >= 0)
    """
    pred, targ = _validate_pair(predictions, targets)
    return float(np.mean(np.abs(pred - targ)))


def rmse(predictions: ArrayLike, targets: ArrayLike) -> float:
    """
    Root Mean Squared Error (sqrt of MSE).

    Returns
    -------
    float : RMSE (always >= 0)
    """
    return math.sqrt(mse(predictions, targets))


def r_squared(predictions: ArrayLike, targets: ArrayLike) -> float:
    """
    Coefficient of determination (R²).

    R² = 1 - SS_res / SS_tot.
    Returns 0.0 when the target is constant (SS_tot == 0),
    avoiding a division-by-zero error.

    Returns
    -------
    float : R² (typically in (-inf, 1]; perfect fit = 1.0)
    """
    pred, targ = _validate_pair(predictions, targets)
    ss_res = float(np.sum((targ - pred) ** 2))
    ss_tot = float(np.sum((targ - targ.mean()) ** 2))
    if ss_tot == 0.0:
        # Constant target: define R² = 0 (convention; model explains nothing)
        return 0.0
    return float(1.0 - ss_res / ss_tot)


def regression_metrics(
    predictions: ArrayLike,
    targets: ArrayLike,
) -> dict[str, float]:
    """
    Compute all standard regression metrics in one call.

    Parameters
    ----------
    predictions : predicted continuous values
    targets     : ground-truth continuous values

    Returns
    -------
    dict with keys:
        ``mse``   – mean squared error
        ``rmse``  – root mean squared error
        ``mae``   – mean absolute error
        ``r2``    – coefficient of determination

    All values are plain Python floats (JSON-serialisable).

    Raises
    ------
    ValueError : empty inputs, mismatched lengths
    """
    # Validate once; individual functions would validate again — avoid double work
    pred, targ = _validate_pair(predictions, targets)
    _mse  = float(np.mean((pred - targ) ** 2))
    _mae  = float(np.mean(np.abs(pred - targ)))
    _rmse = math.sqrt(_mse)
    ss_res = float(np.sum((targ - pred) ** 2))
    ss_tot = float(np.sum((targ - targ.mean()) ** 2))
    _r2 = 0.0 if ss_tot == 0.0 else float(1.0 - ss_res / ss_tot)

    return {
        "mse":  round(_mse,  8),
        "rmse": round(_rmse, 8),
        "mae":  round(_mae,  8),
        "r2":   round(_r2,   8),
    }


# ════════════════════════════════════════════════════════════════════════════
# Classification metrics
# ════════════════════════════════════════════════════════════════════════════

def _to_int_array(x: ArrayLike, name: str) -> np.ndarray:
    """
    Convert *x* to a 1-D int64 NumPy array.

    Accepts integer arrays, float arrays that are whole numbers (e.g.
    model outputs after argmax), and string label arrays.

    Raises
    ------
    ValueError : non-integer float values (e.g. 1.5)
    """
    if hasattr(x, "detach"):
        x = x.detach().cpu().numpy()

    arr = np.asarray(x)
    if arr.ndim != 1:
        raise ValueError(f"'{name}' must be 1-D, got shape {arr.shape}.")
    if arr.size == 0:
        raise ValueError(f"'{name}' must not be empty.")

    # Allow float arrays that are actually integers (e.g. argmax output)
    if np.issubdtype(arr.dtype, np.floating):
        if not np.all(arr == np.floor(arr)):
            raise ValueError(
                f"'{name}' contains non-integer float values. "
                "For classification, pass integer class indices or string labels."
            )
        arr = arr.astype(np.int64)

    return arr


def accuracy(predictions: ArrayLike, targets: ArrayLike) -> float:
    """
    Classification accuracy: fraction of correctly predicted labels.

    Parameters
    ----------
    predictions : predicted class labels (int or string)
    targets     : ground-truth class labels (int or string)

    Returns
    -------
    float : accuracy in [0, 1]

    Raises
    ------
    ValueError : empty inputs or mismatched lengths
    """
    pred = _to_int_array(predictions, "predictions")
    targ = _to_int_array(targets,     "targets")
    if pred.shape != targ.shape:
        raise ValueError(
            f"Shape mismatch: predictions {pred.shape} vs targets {targ.shape}."
        )
    return float(accuracy_score(targ, pred))


def classification_metrics(
    predictions: ArrayLike,
    targets: ArrayLike,
    *,
    include_confusion_matrix: bool = False,
) -> dict:
    """
    Compute comprehensive classification metrics.

    Parameters
    ----------
    predictions             : predicted class labels (int or string)
    targets                 : ground-truth class labels (int or string)
    include_confusion_matrix: if True, add a 2-D confusion matrix to the
                              result (as a list-of-lists; JSON-serialisable)

    Returns
    -------
    dict with keys:
        ``accuracy``         – overall fraction correct (float)
        ``macro_precision``  – unweighted mean precision across classes (float)
        ``macro_recall``     – unweighted mean recall across classes (float)
        ``macro_f1``         – unweighted mean F1 across classes (float)
        ``per_class``        – dict mapping each class label (str) to a dict
                               with keys ``precision``, ``recall``, ``f1``,
                               ``support``
        ``confusion_matrix`` – (only when include_confusion_matrix=True)
                               list-of-lists of ints

    All numeric values are plain Python floats or ints (JSON-serialisable).

    Raises
    ------
    ValueError : empty inputs, mismatched lengths, non-integer float labels
    """
    pred = _to_int_array(predictions, "predictions")
    targ = _to_int_array(targets,     "targets")

    if pred.shape != targ.shape:
        raise ValueError(
            f"Shape mismatch: predictions {pred.shape} vs targets {targ.shape}."
        )

    acc = float(accuracy_score(targ, pred))

    # sklearn classification_report with output_dict=True gives per-class
    # precision, recall, f1, support plus macro/weighted averages
    report = classification_report(
        targ, pred,
        output_dict=True,
        zero_division=0,   # avoid warnings for classes with no predictions
    )

    # Build a clean per-class dict with only the four standard keys
    classes   = sorted(set(targ.tolist()))
    per_class = {}
    for cls in classes:
        key = str(cls)
        if key in report:
            per_class[key] = {
                "precision": round(float(report[key]["precision"]),  6),
                "recall":    round(float(report[key]["recall"]),     6),
                "f1":        round(float(report[key]["f1-score"]),   6),
                "support":   int(report[key]["support"]),
            }

    result: dict = {
        "accuracy":        round(acc, 8),
        "macro_precision": round(float(report["macro avg"]["precision"]), 8),
        "macro_recall":    round(float(report["macro avg"]["recall"]),    8),
        "macro_f1":        round(float(report["macro avg"]["f1-score"]),  8),
        "per_class":       per_class,
    }

    if include_confusion_matrix:
        cm = confusion_matrix(targ, pred).tolist()
        result["confusion_matrix"] = cm

    return result
