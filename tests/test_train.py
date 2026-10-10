"""
tests/test_train.py
====================
Unit and integration tests for ``research/train.py`` and
``benchmarks/kan_baseline/model.py``.

What these tests verify
-----------------------
- TrainConfig argument validation (bad values raise ValueError)
- KAN model factory argument validation
- End-to-end pipeline on a tiny synthetic CSV (regression + classification)
- results.json is written, parseable, and contains all required keys
- results.json status is "pipeline_test_completed" on success
- results.json status is "failed" when the pipeline errors
- loss_curve.png exists after a successful run
- training.log exists and has content
- Metrics are real numbers (not placeholders)
- Smoke-test results directory is never touched by train.py

Runner: Python standard-library ``unittest``.

    python -m unittest tests/test_train.py -v
    python -m unittest discover tests -v
"""

import json
import os
import sys
import tempfile
import time
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from research.train import TrainConfig, run_experiment
from benchmarks.kan_baseline.model import build_kan


# ════════════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════════════

def _synthetic_regression_csv(tmp_dir: str, n: int = 60) -> str:
    """
    Write a small synthetic regression CSV.
    f(x1, x2) = sin(pi*x1) + x2^2  (same function as the KAN paper Fig 2.3).
    Labelled 'SYNTHETIC' in the filename so it can never be confused with
    real experimental data.
    """
    import numpy as np
    rng = np.random.default_rng(0)
    X   = rng.uniform(-1.0, 1.0, size=(n, 2)).astype(np.float32)
    y   = (np.sin(np.pi * X[:, 0]) + X[:, 1] ** 2).astype(np.float32)
    path = os.path.join(tmp_dir, "SYNTHETIC_regression.csv")
    with open(path, "w") as f:
        f.write("x1,x2,y\n")
        for i in range(n):
            f.write(f"{X[i,0]:.6f},{X[i,1]:.6f},{y[i]:.6f}\n")
    return path


def _synthetic_classification_csv(tmp_dir: str, n_per_class: int = 20) -> str:
    """
    Write a small synthetic classification CSV (3 classes).
    """
    import numpy as np
    rng  = np.random.default_rng(1)
    path = os.path.join(tmp_dir, "SYNTHETIC_classification.csv")
    with open(path, "w") as f:
        f.write("feat_a,feat_b,label\n")
        for cls in range(3):
            X = rng.uniform(float(cls), float(cls) + 1.0, size=(n_per_class, 2))
            for row in X:
                f.write(f"{row[0]:.6f},{row[1]:.6f},{cls}\n")
    return path


def _minimal_cfg(tmp_dir: str, csv_path: str, **overrides) -> TrainConfig:
    """Return a TrainConfig tuned for fast unit-test execution."""
    cfg = TrainConfig(
        csv_path     = csv_path,
        target_col   = "y",
        task_type    = "regression",
        seed         = 0,
        test_size    = 0.2,
        hidden_sizes = [4],       # tiny: 1 hidden layer, 4 nodes
        grid_size    = 3,
        degree       = 2,
        epochs       = 5,         # 5 epochs is enough to verify the pipeline
        lr           = 0.01,
        batch_size   = 16,
        out_dir      = tmp_dir,
    )
    for k, v in overrides.items():
        setattr(cfg, k, v)
    return cfg


# ════════════════════════════════════════════════════════════════════════════
# Tests: TrainConfig validation
# ════════════════════════════════════════════════════════════════════════════

class TestTrainConfigValidation(unittest.TestCase):

    def _base_cfg(self) -> TrainConfig:
        return TrainConfig(
            csv_path="dummy.csv", target_col="y",
            task_type="regression", seed=0,
        )

    # T1 — empty csv_path
    def test_empty_csv_raises(self):
        cfg = self._base_cfg(); cfg.csv_path = ""
        with self.assertRaises(ValueError):
            cfg.validate()

    # T2 — bad task_type
    def test_bad_task_type_raises(self):
        cfg = self._base_cfg(); cfg.task_type = "clustering"
        with self.assertRaises(ValueError):
            cfg.validate()

    # T3 — test_size out of range
    def test_bad_test_size_raises(self):
        cfg = self._base_cfg(); cfg.test_size = 1.1
        with self.assertRaises(ValueError):
            cfg.validate()
        cfg.test_size = 0.0
        with self.assertRaises(ValueError):
            cfg.validate()

    # T4 — negative seed
    def test_negative_seed_raises(self):
        cfg = self._base_cfg(); cfg.seed = -1
        with self.assertRaises(ValueError):
            cfg.validate()

    # T5 — empty hidden_sizes
    def test_empty_hidden_raises(self):
        cfg = self._base_cfg(); cfg.hidden_sizes = []
        with self.assertRaises(ValueError):
            cfg.validate()

    # T6 — zero hidden unit
    def test_zero_hidden_unit_raises(self):
        cfg = self._base_cfg(); cfg.hidden_sizes = [0]
        with self.assertRaises(ValueError):
            cfg.validate()

    # T7 — bad epochs
    def test_zero_epochs_raises(self):
        cfg = self._base_cfg(); cfg.epochs = 0
        with self.assertRaises(ValueError):
            cfg.validate()

    # T8 — non-positive lr
    def test_zero_lr_raises(self):
        cfg = self._base_cfg(); cfg.lr = 0.0
        with self.assertRaises(ValueError):
            cfg.validate()

    # T9 — valid config does not raise
    def test_valid_config_ok(self):
        cfg = self._base_cfg()
        cfg.validate()   # must not raise


# ════════════════════════════════════════════════════════════════════════════
# Tests: KAN model factory
# ════════════════════════════════════════════════════════════════════════════

class TestBuildKAN(unittest.TestCase):

    # T10 — basic construction
    def test_builds_and_forward_pass(self):
        import torch
        model = build_kan(in_features=2, hidden_sizes=[4], out_features=1)
        x     = torch.randn(8, 2)
        out   = model(x)
        self.assertEqual(out.shape, (8, 1))

    # T11 — n_parameters is positive
    def test_n_parameters_positive(self):
        model = build_kan(in_features=3, hidden_sizes=[4, 4], out_features=2)
        self.assertGreater(model.n_parameters, 0)

    # T12 — description string contains layer widths
    def test_description_contains_dims(self):
        model = build_kan(in_features=2, hidden_sizes=[8], out_features=1)
        desc  = model.description()
        self.assertIn("2",  desc)
        self.assertIn("8",  desc)
        self.assertIn("1",  desc)

    # T13 — bad in_features raises
    def test_bad_in_features_raises(self):
        with self.assertRaises(ValueError):
            build_kan(in_features=0, hidden_sizes=[4], out_features=1)

    # T14 — empty hidden raises
    def test_empty_hidden_raises(self):
        with self.assertRaises(ValueError):
            build_kan(in_features=2, hidden_sizes=[], out_features=1)


# ════════════════════════════════════════════════════════════════════════════
# Tests: run_experiment — regression pipeline
# ════════════════════════════════════════════════════════════════════════════

class TestRunExperimentRegression(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.csv = _synthetic_regression_csv(self.tmp)

    # T15 — returns a dict
    def test_returns_dict(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        self.assertIsInstance(result, dict)

    # T16 — status is pipeline_test_completed
    def test_status_completed(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        self.assertEqual(result["status"], "pipeline_test_completed")

    # T17 — required top-level keys present
    def test_required_keys(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        required = [
            "experiment_id", "status", "task_type", "seed",
            "model_description", "n_parameters", "metrics",
            "final_train_loss", "elapsed_seconds", "artefacts",
            "dataset_provenance", "disclaimer",
        ]
        for key in required:
            self.assertIn(key, result, f"Missing key: '{key}'")

    # T18 — metrics contain regression keys with real numbers
    def test_regression_metric_values(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        m = result["metrics"]
        for key in ("mse", "rmse", "mae", "r2"):
            self.assertIn(key, m)
            self.assertIsInstance(m[key], float)
            self.assertFalse(
                m[key] != m[key],   # NaN check
                f"Metric '{key}' is NaN"
            )

    # T19 — final_train_loss is a finite positive float
    def test_final_train_loss_finite(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        loss   = result["final_train_loss"]
        self.assertIsInstance(loss, float)
        self.assertGreater(loss, 0.0)

    # T20 — results.json exists and is parseable
    def test_results_json_parseable(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        path   = result["artefacts"]["results"]
        self.assertTrue(os.path.exists(path))
        with open(path) as f:
            loaded = json.load(f)
        self.assertEqual(loaded["experiment_id"], result["experiment_id"])

    # T21 — results.json content matches returned dict
    def test_results_json_matches_return(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        with open(result["artefacts"]["results"]) as f:
            on_disk = json.load(f)
        self.assertEqual(on_disk["status"],        result["status"])
        self.assertEqual(on_disk["experiment_id"], result["experiment_id"])

    # T22 — loss_curve.png exists
    def test_loss_plot_exists(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        plot   = result["artefacts"]["loss_plot"]
        self.assertIsNotNone(plot)
        self.assertTrue(os.path.exists(plot),
                        f"Expected plot at: {plot}")

    # T23 — training.log exists and has content
    def test_training_log_exists(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        log    = result["artefacts"]["log"]
        self.assertTrue(os.path.exists(log))
        with open(log) as f:
            lines = f.readlines()
        self.assertGreater(len(lines), 0)

    # T24 — config.json exists and has correct keys
    def test_config_json_exists(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        cfg_path = result["artefacts"]["config"]
        self.assertTrue(os.path.exists(cfg_path))
        with open(cfg_path) as f:
            cfg_data = json.load(f)
        for key in ("experiment_id", "csv_path", "task_type", "seed",
                    "hidden_sizes", "epochs", "lr"):
            self.assertIn(key, cfg_data)

    # T25 — elapsed_seconds is a positive float
    def test_elapsed_positive(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        self.assertIsInstance(result["elapsed_seconds"], float)
        self.assertGreater(result["elapsed_seconds"], 0.0)

    # T26 — disclaimer key is present and non-empty
    def test_disclaimer_present(self):
        cfg    = _minimal_cfg(self.tmp, self.csv)
        result = run_experiment(cfg)
        self.assertIn("disclaimer", result)
        self.assertGreater(len(result["disclaimer"]), 0)

    # T27 — smoke_test_results directory is not modified
    def test_smoke_test_results_untouched(self):
        smoke_dir = os.path.join(
            REPO_ROOT, "benchmarks", "kan_baseline", "smoke_test_results"
        )
        mtime_before = (
            os.path.getmtime(smoke_dir) if os.path.exists(smoke_dir) else None
        )
        cfg = _minimal_cfg(self.tmp, self.csv)
        run_experiment(cfg)
        if mtime_before is not None:
            self.assertAlmostEqual(
                os.path.getmtime(smoke_dir), mtime_before, delta=1.0,
                msg="smoke_test_results was modified during run_experiment",
            )


# ════════════════════════════════════════════════════════════════════════════
# Tests: run_experiment — classification pipeline
# ════════════════════════════════════════════════════════════════════════════

class TestRunExperimentClassification(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.csv = _synthetic_classification_csv(self.tmp)

    # T28 — classification status completed
    def test_classification_completed(self):
        cfg = _minimal_cfg(
            self.tmp, self.csv,
            target_col="label",
            task_type="classification",
        )
        result = run_experiment(cfg)
        self.assertEqual(result["status"], "pipeline_test_completed")

    # T29 — classification metrics contain accuracy
    def test_classification_metrics_keys(self):
        cfg = _minimal_cfg(
            self.tmp, self.csv,
            target_col="label",
            task_type="classification",
        )
        result = run_experiment(cfg)
        m = result["metrics"]
        for key in ("accuracy", "macro_f1", "per_class"):
            self.assertIn(key, m, f"Missing classification metric: '{key}'")

    # T30 — accuracy is in [0, 1]
    def test_accuracy_range(self):
        cfg = _minimal_cfg(
            self.tmp, self.csv,
            target_col="label",
            task_type="classification",
        )
        result = run_experiment(cfg)
        acc = result["metrics"]["accuracy"]
        self.assertGreaterEqual(acc, 0.0)
        self.assertLessEqual(acc, 1.0)


# ════════════════════════════════════════════════════════════════════════════
# Tests: failure recording
# ════════════════════════════════════════════════════════════════════════════

class TestFailureRecording(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # T31 — bad csv path raises FileNotFoundError AND writes failed results.json
    def test_failed_run_writes_results_json(self):
        cfg = TrainConfig(
            csv_path     = os.path.join(self.tmp, "no_such_file.csv"),
            target_col   = "y",
            task_type    = "regression",
            hidden_sizes = [4],
            epochs       = 2,
            out_dir      = self.tmp,
        )
        with self.assertRaises(FileNotFoundError):
            run_experiment(cfg)

        # results.json must still have been written with status=failed
        # Find it in any subdirectory of tmp
        found = []
        for root, dirs, files in os.walk(self.tmp):
            if "results.json" in files:
                found.append(os.path.join(root, "results.json"))

        self.assertGreater(len(found), 0,
                           "results.json not written for failed run")
        with open(found[0]) as f:
            data = json.load(f)
        self.assertEqual(data["status"], "failed")
        self.assertIsNotNone(data["error_message"])


# ════════════════════════════════════════════════════════════════════════════
# Runner
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    unittest.main(verbosity=2)
