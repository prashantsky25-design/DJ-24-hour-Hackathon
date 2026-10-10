"""
tests/test_prepare.py
======================
Unit tests for ``research/prepare.py`` and ``research/metrics.py``.

Test runner : Python standard-library ``unittest`` (no extra install needed).

Run all tests:
    python -m pytest tests/           (if pytest is installed)
    python -m unittest discover tests (always works)
    python tests/test_prepare.py      (direct execution)

All tests use small synthetic CSV files written to a temporary directory.
No real datasets are downloaded or used. No benchmark artefacts are created.
"""

import math
import os
import sys
import tempfile
import unittest

# ── Make sure the repo root is on sys.path regardless of where tests run ──
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from research.prepare import prepare_dataset, set_seed
from research.metrics import (
    mse, mae, rmse, r_squared, regression_metrics,
    accuracy, classification_metrics,
)


# ════════════════════════════════════════════════════════════════════════════
# Helpers — tiny CSV writers
# ════════════════════════════════════════════════════════════════════════════

def _write_csv(tmp_dir: str, filename: str, lines: list[str]) -> str:
    """Write *lines* to a file in *tmp_dir* and return the full path."""
    path = os.path.join(tmp_dir, filename)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    return path


def _regression_csv(tmp_dir: str, n: int = 20) -> str:
    """
    Simple two-feature regression CSV.
    f(x1, x2) = x1 + x2  (exact, no noise).
    """
    rows = ["x1,x2,target"]
    for i in range(n):
        x1 = float(i)
        x2 = float(i * 2)
        y  = x1 + x2
        rows.append(f"{x1},{x2},{y}")
    return _write_csv(tmp_dir, "regression.csv", rows)


def _classification_csv(tmp_dir: str, n_per_class: int = 15) -> str:
    """
    Two-feature, three-class classification CSV.
    Class label is determined by which third of [0, n) the sample falls in.
    """
    rows = ["feat_a,feat_b,label"]
    n = n_per_class * 3
    for i in range(n):
        fa = float(i)
        fb = float(i) * 0.5
        label = ["cat", "dog", "fish"][i // n_per_class]
        rows.append(f"{fa},{fb},{label}")
    return _write_csv(tmp_dir, "classification.csv", rows)


# ════════════════════════════════════════════════════════════════════════════
# Tests: prepare.set_seed
# ════════════════════════════════════════════════════════════════════════════

class TestSetSeed(unittest.TestCase):

    def test_valid_seed(self):
        """set_seed must not raise for a valid non-negative integer."""
        set_seed(0)
        set_seed(42)
        set_seed(99999)

    def test_negative_seed_raises(self):
        with self.assertRaises(ValueError):
            set_seed(-1)

    def test_non_integer_seed_raises(self):
        with self.assertRaises((ValueError, TypeError)):
            set_seed(3.14)  # type: ignore[arg-type]


# ════════════════════════════════════════════════════════════════════════════
# Tests: prepare_dataset — loading and basic splitting
# ════════════════════════════════════════════════════════════════════════════

class TestPrepareLoad(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # ── T1: Successful load and split ───────────────────────────────────────
    def test_successful_regression_load(self):
        path   = _regression_csv(self.tmp, n=50)
        result = prepare_dataset(path, "target", "regression", seed=0)

        self.assertEqual(result.task_type, "regression")
        self.assertIn("x1", result.feature_names)
        self.assertIn("x2", result.feature_names)
        self.assertNotIn("target", result.feature_names)  # no leakage
        self.assertEqual(result.n_features, 2)
        self.assertGreater(result.n_train, 0)
        self.assertGreater(result.n_test,  0)
        self.assertEqual(result.n_train + result.n_test, 50)

    # ── T2: Missing dataset path ────────────────────────────────────────────
    def test_missing_path_raises(self):
        with self.assertRaises(FileNotFoundError):
            prepare_dataset(
                os.path.join(self.tmp, "does_not_exist.csv"),
                "target", "regression",
            )

    # ── T3: Missing target column ───────────────────────────────────────────
    def test_missing_target_column_raises(self):
        path = _regression_csv(self.tmp)
        with self.assertRaises(ValueError) as ctx:
            prepare_dataset(path, "nonexistent_col", "regression")
        self.assertIn("nonexistent_col", str(ctx.exception))

    # ── T4: Empty dataset (header only) ─────────────────────────────────────
    def test_empty_dataset_raises(self):
        path = _write_csv(self.tmp, "empty.csv", ["x1,x2,target"])
        with self.assertRaises(ValueError):
            prepare_dataset(path, "target", "regression")

    # ── T5: Zero-byte file ──────────────────────────────────────────────────
    def test_zero_byte_file_raises(self):
        path = _write_csv(self.tmp, "zero.csv", [])
        with self.assertRaises(ValueError):
            prepare_dataset(path, "target", "regression")

    # ── T6: Invalid task_type ────────────────────────────────────────────────
    def test_invalid_task_type_raises(self):
        path = _regression_csv(self.tmp)
        with self.assertRaises(ValueError):
            prepare_dataset(path, "target", "unsupported")  # type: ignore

    # ── T7: test_size out of range ───────────────────────────────────────────
    def test_bad_test_size_raises(self):
        path = _regression_csv(self.tmp)
        with self.assertRaises(ValueError):
            prepare_dataset(path, "target", "regression", test_size=1.5)
        with self.assertRaises(ValueError):
            prepare_dataset(path, "target", "regression", test_size=0.0)


# ════════════════════════════════════════════════════════════════════════════
# Tests: reproducibility
# ════════════════════════════════════════════════════════════════════════════

class TestReproducibility(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # ── T8: Same seed → identical splits ────────────────────────────────────
    def test_reproducible_split(self):
        path    = _regression_csv(self.tmp, n=40)
        result1 = prepare_dataset(path, "target", "regression", seed=7)
        result2 = prepare_dataset(path, "target", "regression", seed=7)

        import numpy as np
        np.testing.assert_array_equal(result1.X_train, result2.X_train)
        np.testing.assert_array_equal(result1.y_test,  result2.y_test)

    # ── T9: Different seeds → different splits ───────────────────────────────
    def test_different_seeds_differ(self):
        path    = _regression_csv(self.tmp, n=40)
        result1 = prepare_dataset(path, "target", "regression", seed=1)
        result2 = prepare_dataset(path, "target", "regression", seed=999)

        import numpy as np
        # With 40 samples it is astronomically unlikely both splits match
        self.assertFalse(
            np.array_equal(result1.y_train, result2.y_train),
            "Different seeds produced identical splits — unexpected.",
        )


# ════════════════════════════════════════════════════════════════════════════
# Tests: target leakage prevention
# ════════════════════════════════════════════════════════════════════════════

class TestNoLeakage(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # ── T10: Target column must not appear in feature_names ──────────────────
    def test_target_not_in_features(self):
        path   = _regression_csv(self.tmp)
        result = prepare_dataset(path, "target", "regression")
        self.assertNotIn("target", result.feature_names)

    # ── T11: X arrays have correct shape (no extra target column) ───────────
    def test_x_shape_excludes_target(self):
        path   = _regression_csv(self.tmp, n=20)
        result = prepare_dataset(path, "target", "regression")
        # CSV has 3 columns: x1, x2, target → 2 features
        self.assertEqual(result.X_train.shape[1], 2)
        self.assertEqual(result.X_test.shape[1],  2)


# ════════════════════════════════════════════════════════════════════════════
# Tests: classification
# ════════════════════════════════════════════════════════════════════════════

class TestClassification(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # ── T12: Classification result metadata ──────────────────────────────────
    def test_classification_metadata(self):
        path   = _classification_csv(self.tmp, n_per_class=20)
        result = prepare_dataset(path, "label", "classification", seed=0)

        self.assertEqual(result.task_type, "classification")
        self.assertEqual(result.n_classes, 3)
        # class_labels must contain all three original string labels
        labels_set = set(result.class_labels)
        self.assertIn("cat",  labels_set)
        self.assertIn("dog",  labels_set)
        self.assertIn("fish", labels_set)

    # ── T13: y_train is integer-encoded for classification ──────────────────
    def test_y_dtype_classification(self):
        import numpy as np
        path   = _classification_csv(self.tmp)
        result = prepare_dataset(path, "label", "classification", seed=0)
        self.assertEqual(result.y_train.dtype, np.int64)
        self.assertEqual(result.y_test.dtype,  np.int64)

    # ── T14: Stratified split — all classes present in both partitions ───────
    def test_stratified_split_all_classes_present(self):
        import numpy as np
        # 30 samples per class → plenty for stratification
        path   = _classification_csv(self.tmp, n_per_class=30)
        result = prepare_dataset(
            path, "label", "classification", seed=0, test_size=0.2
        )
        train_classes = set(np.unique(result.y_train).tolist())
        test_classes  = set(np.unique(result.y_test).tolist())
        self.assertEqual(
            train_classes, test_classes,
            "Stratified split should preserve all classes in both partitions.",
        )

    # ── T15: Invalid target value in regression ──────────────────────────────
    def test_non_numeric_regression_target_raises(self):
        path = _write_csv(self.tmp, "bad_target.csv", [
            "x1,x2,target",
            "1.0,2.0,good",   # non-numeric target for regression
            "3.0,4.0,1.5",
        ])
        with self.assertRaises(ValueError) as ctx:
            prepare_dataset(path, "target", "regression")
        self.assertIn("non-numeric", str(ctx.exception).lower())

    # ── T16: Empty target value raises ───────────────────────────────────────
    def test_empty_target_value_raises(self):
        path = _write_csv(self.tmp, "empty_target.csv", [
            "x1,x2,target",
            "1.0,2.0,",       # empty target
            "3.0,4.0,1.5",
        ])
        with self.assertRaises(ValueError):
            prepare_dataset(path, "target", "regression")


# ════════════════════════════════════════════════════════════════════════════
# Tests: missing feature values
# ════════════════════════════════════════════════════════════════════════════

class TestMissingFeatures(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # ── T17: Rows with missing features are dropped ──────────────────────────
    def test_missing_feature_rows_dropped(self):
        path = _write_csv(self.tmp, "missing.csv", [
            "x1,x2,target",
            "1.0,2.0,3.0",
            "4.0,,6.0",       # missing x2 — should be dropped
            "7.0,8.0,9.0",
            "10.0,11.0,12.0",
        ])
        result = prepare_dataset(path, "target", "regression", seed=0)
        self.assertEqual(result.missing_dropped, 1)
        self.assertEqual(result.n_train + result.n_test, 3)

    # ── T18: All rows missing → raises ───────────────────────────────────────
    def test_all_rows_missing_raises(self):
        path = _write_csv(self.tmp, "all_missing.csv", [
            "x1,x2,target",
            ",,3.0",
            ",,6.0",
        ])
        with self.assertRaises(ValueError):
            prepare_dataset(path, "target", "regression")


# ════════════════════════════════════════════════════════════════════════════
# Tests: metrics — regression
# ════════════════════════════════════════════════════════════════════════════

class TestRegressionMetrics(unittest.TestCase):

    # ── T19: Perfect prediction → MSE = 0, MAE = 0, R2 = 1 ──────────────────
    def test_perfect_prediction(self):
        y = [1.0, 2.0, 3.0, 4.0]
        result = regression_metrics(y, y)
        self.assertAlmostEqual(result["mse"],  0.0, places=10)
        self.assertAlmostEqual(result["mae"],  0.0, places=10)
        self.assertAlmostEqual(result["rmse"], 0.0, places=10)
        self.assertAlmostEqual(result["r2"],   1.0, places=6)

    # ── T20: Known values ────────────────────────────────────────────────────
    def test_known_mse(self):
        preds   = [2.0, 4.0]
        targets = [1.0, 3.0]
        # MSE = ((2-1)^2 + (4-3)^2) / 2 = 1.0
        self.assertAlmostEqual(mse(preds, targets), 1.0, places=8)

    def test_known_mae(self):
        preds   = [3.0, 5.0]
        targets = [1.0, 2.0]
        # MAE = (|3-1| + |5-2|) / 2 = 2.5
        self.assertAlmostEqual(mae(preds, targets), 2.5, places=8)

    def test_known_rmse(self):
        preds   = [2.0, 4.0]
        targets = [1.0, 3.0]
        # RMSE = sqrt(1.0) = 1.0
        self.assertAlmostEqual(rmse(preds, targets), 1.0, places=8)

    def test_r_squared_constant_target(self):
        # When target is constant, SS_tot = 0; r2 should be 0.0, not an error
        preds   = [5.0, 5.0, 5.0]
        targets = [5.0, 5.0, 5.0]
        self.assertEqual(r_squared(preds, targets), 0.0)

    # ── T21: Mismatched lengths raise ValueError ──────────────────────────────
    def test_mismatched_lengths_raise(self):
        with self.assertRaises(ValueError):
            mse([1.0, 2.0], [1.0])
        with self.assertRaises(ValueError):
            mae([1.0], [1.0, 2.0])
        with self.assertRaises(ValueError):
            regression_metrics([1.0, 2.0], [1.0])

    # ── T22: Empty arrays raise ValueError ──────────────────────────────────
    def test_empty_arrays_raise(self):
        with self.assertRaises(ValueError):
            mse([], [])
        with self.assertRaises(ValueError):
            regression_metrics([], [])

    # ── T23: Return types are plain Python floats (JSON-serialisable) ─────────
    def test_return_types_are_floats(self):
        result = regression_metrics([1.0, 2.0], [1.5, 2.5])
        for key in ("mse", "rmse", "mae", "r2"):
            self.assertIsInstance(result[key], float,
                                  f"Expected float for '{key}'")

    # ── T24: regression_metrics keys ────────────────────────────────────────
    def test_regression_metrics_keys(self):
        result = regression_metrics([1.0, 2.0, 3.0], [1.1, 2.1, 2.9])
        self.assertIn("mse",  result)
        self.assertIn("rmse", result)
        self.assertIn("mae",  result)
        self.assertIn("r2",   result)


# ════════════════════════════════════════════════════════════════════════════
# Tests: metrics — classification
# ════════════════════════════════════════════════════════════════════════════

class TestClassificationMetrics(unittest.TestCase):

    # ── T25: Perfect classification ──────────────────────────────────────────
    def test_perfect_accuracy(self):
        labels = [0, 1, 2, 0, 1, 2]
        self.assertAlmostEqual(accuracy(labels, labels), 1.0, places=8)

    # ── T26: Known accuracy ──────────────────────────────────────────────────
    def test_known_accuracy(self):
        preds   = [0, 1, 1, 0]
        targets = [0, 1, 0, 0]
        # 3 correct out of 4
        self.assertAlmostEqual(accuracy(preds, targets), 0.75, places=8)

    # ── T27: classification_metrics keys ────────────────────────────────────
    def test_classification_metrics_keys(self):
        preds   = [0, 1, 1, 0, 2, 2]
        targets = [0, 1, 0, 0, 2, 1]
        result  = classification_metrics(preds, targets)
        for key in ("accuracy", "macro_precision", "macro_recall",
                    "macro_f1", "per_class"):
            self.assertIn(key, result)

    # ── T28: confusion_matrix included when requested ────────────────────────
    def test_confusion_matrix_included(self):
        preds   = [0, 1, 1, 0]
        targets = [0, 1, 0, 0]
        result  = classification_metrics(
            preds, targets, include_confusion_matrix=True
        )
        self.assertIn("confusion_matrix", result)
        cm = result["confusion_matrix"]
        # Must be a list-of-lists (JSON-serialisable)
        self.assertIsInstance(cm, list)
        self.assertIsInstance(cm[0], list)

    # ── T29: Non-integer float labels raise ValueError ───────────────────────
    def test_non_integer_float_labels_raise(self):
        with self.assertRaises(ValueError):
            accuracy([0.5, 1.5], [0, 1])

    # ── T30: Mismatched lengths raise ValueError ────────────────────────────
    def test_mismatched_lengths_raise(self):
        with self.assertRaises(ValueError):
            accuracy([0, 1, 2], [0, 1])
        with self.assertRaises(ValueError):
            classification_metrics([0, 1, 2], [0, 1])

    # ── T31: Return values are JSON-serialisable ────────────────────────────
    def test_return_values_json_serialisable(self):
        import json
        preds  = [0, 1, 2, 0, 1, 2]
        result = classification_metrics(
            preds, preds, include_confusion_matrix=True
        )
        # Should not raise
        json.dumps(result)


# ════════════════════════════════════════════════════════════════════════════
# Runner
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    unittest.main(verbosity=2)
