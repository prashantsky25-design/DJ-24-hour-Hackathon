"""
tests/test_model.py
====================
Tests for ``benchmarks/kan_baseline/model.py``.

Covers
------
- b_spline_basis  : shape, boundary clamping, degree-0 partition-of-unity
- KANEdge         : output shape, gradient flow, grid registration
- KANLayer        : output shape, parameter count, LayerNorm applied
- KAN             : forward pass shapes, multi-layer depth, description string
- build_kan       : valid construction, all error paths
- Determinism     : same seed → same forward pass output
- Regression fit  : tiny dataset, loss decreases over a few steps

Runner (no extra install needed):
    python -m unittest tests/test_model.py -v
    python -m unittest discover tests -v      # runs everything
"""

import os
import sys
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import torch
import torch.nn as nn
import numpy as np

from benchmarks.kan_baseline.model import (
    b_spline_basis,
    KANEdge,
    KANLayer,
    KAN,
    build_kan,
)


# ════════════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════════════

def _make_grid(grid_size: int = 5, degree: int = 3) -> torch.Tensor:
    """Return the extended knot grid the same way KANEdge builds it."""
    base  = torch.linspace(-1.0, 1.0, grid_size + 1)
    step  = base[1] - base[0]
    left  = base[0]  - torch.arange(degree, 0, -1) * step
    right = base[-1] + torch.arange(1, degree + 1) * step
    return torch.cat([left, base, right])


# ════════════════════════════════════════════════════════════════════════════
# Tests: b_spline_basis
# ════════════════════════════════════════════════════════════════════════════

class TestBSplineBasis(unittest.TestCase):

    def setUp(self):
        self.grid   = _make_grid(grid_size=5, degree=3)
        self.degree = 3
        self.batch  = 16
        self.x      = torch.linspace(-1.0, 1.0, self.batch)

    # ── Shape ────────────────────────────────────────────────────────────────
    def test_output_shape(self):
        basis = b_spline_basis(self.x, self.grid, self.degree)
        # Expected: (batch, grid_size + degree) = (16, 8)
        self.assertEqual(basis.shape[0], self.batch)
        self.assertGreater(basis.shape[1], 0)

    # ── All values non-negative (B-spline basis >= 0) ────────────────────────
    def test_non_negative(self):
        basis = b_spline_basis(self.x, self.grid, self.degree)
        self.assertTrue((basis >= -1e-6).all().item(),
                        "B-spline basis should be non-negative")

    # ── Boundary clamping: out-of-range x should not raise ───────────────────
    def test_boundary_clamping_no_error(self):
        x_oob = torch.tensor([-5.0, -1.0, 0.0, 1.0, 5.0])
        basis  = b_spline_basis(x_oob, self.grid, self.degree)
        self.assertEqual(basis.shape[0], 5)

    # ── Degree-0 basis sums to 1 (partition of unity) ────────────────────────
    def test_degree0_partition_of_unity(self):
        grid  = _make_grid(grid_size=5, degree=0)
        x     = torch.linspace(-0.99, 0.99, 50)
        basis = b_spline_basis(x, grid, degree=0)
        row_sums = basis.sum(dim=1)
        # Each row should sum to exactly 1 (one interval is active)
        self.assertTrue(
            torch.allclose(row_sums, torch.ones(50), atol=1e-5),
            f"Degree-0 basis rows should sum to 1; got min={row_sums.min():.4f}"
        )

    # ── Single-point batch ───────────────────────────────────────────────────
    def test_single_point(self):
        x     = torch.tensor([0.5])
        basis = b_spline_basis(x, self.grid, self.degree)
        self.assertEqual(basis.shape[0], 1)

    # ── Different grid sizes produce different widths ────────────────────────
    def test_grid_size_affects_width(self):
        g4 = _make_grid(grid_size=4, degree=3)
        g8 = _make_grid(grid_size=8, degree=3)
        x  = torch.zeros(4)
        w4 = b_spline_basis(x, g4, 3).shape[1]
        w8 = b_spline_basis(x, g8, 3).shape[1]
        self.assertGreater(w8, w4,
                           "Larger grid_size should produce wider basis")


# ════════════════════════════════════════════════════════════════════════════
# Tests: KANEdge
# ════════════════════════════════════════════════════════════════════════════

class TestKANEdge(unittest.TestCase):

    def setUp(self):
        torch.manual_seed(0)
        self.edge  = KANEdge(grid_size=5, degree=3)
        self.batch = 32
        self.x     = torch.randn(self.batch)

    # ── Output shape ─────────────────────────────────────────────────────────
    def test_output_shape(self):
        out = self.edge(self.x)
        self.assertEqual(out.shape, (self.batch,))

    # ── Gradient flows back through edge ─────────────────────────────────────
    def test_gradient_flows(self):
        x   = torch.randn(16, requires_grad=True)
        out = self.edge(x)
        loss = out.mean()
        loss.backward()
        self.assertIsNotNone(x.grad)
        self.assertFalse(
            torch.all(x.grad == 0),
            "Gradient should not be all-zeros"
        )

    # ── Grid is registered as a buffer (not a parameter) ─────────────────────
    def test_grid_is_buffer_not_parameter(self):
        param_names  = {n for n, _ in self.edge.named_parameters()}
        buffer_names = {n for n, _ in self.edge.named_buffers()}
        self.assertIn("grid",  buffer_names)
        self.assertNotIn("grid", param_names)

    # ── coeff and w_base are learnable parameters ─────────────────────────────
    def test_learnable_params_exist(self):
        param_names = {n for n, _ in self.edge.named_parameters()}
        self.assertIn("coeff",  param_names)
        self.assertIn("w_base", param_names)

    # ── Output is deterministic given same seed ───────────────────────────────
    def test_deterministic_output(self):
        torch.manual_seed(7)
        edge1 = KANEdge(grid_size=5, degree=3)
        torch.manual_seed(7)
        edge2 = KANEdge(grid_size=5, degree=3)
        x = torch.linspace(-1, 1, 20)
        self.assertTrue(
            torch.allclose(edge1(x), edge2(x)),
            "Same seed should produce identical outputs"
        )

    # ── Works with batch size = 1 ─────────────────────────────────────────────
    def test_single_sample(self):
        out = self.edge(torch.tensor([0.0]))
        self.assertEqual(out.shape, (1,))

    # ── Custom grid_range ─────────────────────────────────────────────────────
    def test_custom_grid_range(self):
        edge = KANEdge(grid_size=4, degree=2, grid_range=(0.0, 10.0))
        x    = torch.tensor([0.0, 5.0, 10.0])
        out  = edge(x)
        self.assertEqual(out.shape, (3,))


# ════════════════════════════════════════════════════════════════════════════
# Tests: KANLayer
# ════════════════════════════════════════════════════════════════════════════

class TestKANLayer(unittest.TestCase):

    def setUp(self):
        torch.manual_seed(1)
        self.layer = KANLayer(in_dim=3, out_dim=4, grid_size=5, degree=3)
        self.batch  = 8
        self.x      = torch.randn(self.batch, 3)

    # ── Output shape ─────────────────────────────────────────────────────────
    def test_output_shape(self):
        out = self.layer(self.x)
        self.assertEqual(out.shape, (self.batch, 4))

    # ── Correct number of edges ───────────────────────────────────────────────
    def test_edge_count(self):
        # in_dim * out_dim = 3 * 4 = 12
        self.assertEqual(len(self.layer.edges), 12)

    # ── LayerNorm is applied: verify via per-sample normalisation ───────────
    def test_layer_norm_applied(self):
        """
        PyTorch LayerNorm normalises across the *feature dimension* for each
        sample independently (not across the batch).  The per-sample output
        therefore has mean ~0 and std ~1 across features.

        We verify this property directly rather than checking batch statistics,
        which are not controlled by LayerNorm.
        """
        torch.manual_seed(2)
        layer = KANLayer(in_dim=2, out_dim=8, grid_size=5, degree=3)
        x     = torch.randn(64, 2)
        with torch.no_grad():
            out = layer(x)   # (64, 8)

        # Per-sample mean across the 8 features should be near 0
        per_sample_mean = out.mean(dim=1).abs()   # (64,)
        self.assertTrue(
            (per_sample_mean < 0.3).all(),
            f"LayerNorm per-sample means should be near 0; "
            f"max={per_sample_mean.max():.4f}"
        )
        # Per-sample std across the 8 features should be near 1
        per_sample_std = out.std(dim=1)            # (64,)
        self.assertTrue(
            ((per_sample_std - 1.0).abs() < 0.5).all(),
            f"LayerNorm per-sample stds should be near 1; "
            f"min={per_sample_std.min():.4f}, max={per_sample_std.max():.4f}"
        )

    # ── Gradient flows ────────────────────────────────────────────────────────
    def test_gradient_flows(self):
        x   = torch.randn(8, 3, requires_grad=True)
        out = self.layer(x)
        out.sum().backward()
        self.assertIsNotNone(x.grad)

    # ── Different in/out dims ─────────────────────────────────────────────────
    def test_various_dims(self):
        for in_d, out_d in [(1, 1), (2, 8), (10, 3)]:
            layer = KANLayer(in_d, out_d, grid_size=3, degree=2)
            x     = torch.randn(4, in_d)
            out   = layer(x)
            self.assertEqual(out.shape, (4, out_d),
                             f"Failed for in={in_d}, out={out_d}")


# ════════════════════════════════════════════════════════════════════════════
# Tests: KAN (full network)
# ════════════════════════════════════════════════════════════════════════════

class TestKAN(unittest.TestCase):

    def setUp(self):
        torch.manual_seed(42)

    # ── Single hidden layer, regression ──────────────────────────────────────
    def test_single_hidden_regression(self):
        model = KAN(in_features=2, hidden_sizes=[4], out_features=1)
        x     = torch.randn(16, 2)
        out   = model(x)
        self.assertEqual(out.shape, (16, 1))

    # ── Two hidden layers ─────────────────────────────────────────────────────
    def test_two_hidden_layers(self):
        model = KAN(in_features=3, hidden_sizes=[8, 8], out_features=2)
        x     = torch.randn(10, 3)
        out   = model(x)
        self.assertEqual(out.shape, (10, 2))

    # ── Multi-class classification output ─────────────────────────────────────
    def test_multiclass_output(self):
        model = KAN(in_features=4, hidden_sizes=[16], out_features=5)
        x     = torch.randn(32, 4)
        out   = model(x)
        self.assertEqual(out.shape, (32, 5))

    # ── n_parameters is correct and positive ──────────────────────────────────
    def test_n_parameters_matches_manual_count(self):
        model    = KAN(in_features=2, hidden_sizes=[4], out_features=1)
        expected = sum(p.numel() for p in model.parameters())
        self.assertEqual(model.n_parameters, expected)
        self.assertGreater(model.n_parameters, 0)

    # ── description() contains all widths ─────────────────────────────────────
    def test_description_format(self):
        model = KAN(in_features=2, hidden_sizes=[8, 4], out_features=1)
        desc  = model.description()
        self.assertIn("KAN[", desc)
        self.assertIn("2",    desc)
        self.assertIn("8",    desc)
        self.assertIn("4",    desc)
        self.assertIn("1",    desc)

    # ── Empty hidden_sizes raises ValueError ──────────────────────────────────
    def test_empty_hidden_raises(self):
        with self.assertRaises(ValueError):
            KAN(in_features=2, hidden_sizes=[], out_features=1)

    # ── Gradient flows end-to-end ─────────────────────────────────────────────
    def test_gradient_end_to_end(self):
        model = KAN(in_features=2, hidden_sizes=[4], out_features=1)
        x     = torch.randn(8, 2, requires_grad=True)
        loss  = model(x).sum()
        loss.backward()
        self.assertIsNotNone(x.grad)
        # At least some parameter gradients should be non-zero
        total_grad = sum(
            p.grad.abs().sum().item()
            for p in model.parameters()
            if p.grad is not None
        )
        self.assertGreater(total_grad, 0.0)

    # ── Determinism with same seed ────────────────────────────────────────────
    def test_deterministic_forward(self):
        torch.manual_seed(99)
        m1 = KAN(in_features=2, hidden_sizes=[4], out_features=1)
        torch.manual_seed(99)
        m2 = KAN(in_features=2, hidden_sizes=[4], out_features=1)
        x  = torch.ones(4, 2)
        self.assertTrue(
            torch.allclose(m1(x), m2(x)),
            "Same seed should give identical output"
        )

    # ── Batch size = 1 ────────────────────────────────────────────────────────
    def test_single_sample_batch(self):
        model = KAN(in_features=3, hidden_sizes=[4], out_features=1)
        x     = torch.randn(1, 3)
        out   = model(x)
        self.assertEqual(out.shape, (1, 1))

    # ── Large batch does not crash ────────────────────────────────────────────
    def test_large_batch(self):
        model = KAN(in_features=2, hidden_sizes=[4], out_features=1)
        x     = torch.randn(512, 2)
        out   = model(x)
        self.assertEqual(out.shape, (512, 1))


# ════════════════════════════════════════════════════════════════════════════
# Tests: build_kan factory
# ════════════════════════════════════════════════════════════════════════════

class TestBuildKANFactory(unittest.TestCase):

    # ── Valid build ────────────────────────────────────────────────────────────
    def test_valid_minimal(self):
        model = build_kan(in_features=2, hidden_sizes=[4], out_features=1)
        self.assertIsInstance(model, KAN)

    # ── All error paths ───────────────────────────────────────────────────────
    def test_in_features_zero_raises(self):
        with self.assertRaises(ValueError):
            build_kan(in_features=0, hidden_sizes=[4], out_features=1)

    def test_in_features_negative_raises(self):
        with self.assertRaises(ValueError):
            build_kan(in_features=-1, hidden_sizes=[4], out_features=1)

    def test_empty_hidden_raises(self):
        with self.assertRaises(ValueError):
            build_kan(in_features=2, hidden_sizes=[], out_features=1)

    def test_zero_hidden_unit_raises(self):
        with self.assertRaises(ValueError):
            build_kan(in_features=2, hidden_sizes=[0], out_features=1)

    def test_out_features_zero_raises(self):
        with self.assertRaises(ValueError):
            build_kan(in_features=2, hidden_sizes=[4], out_features=0)

    def test_grid_size_zero_raises(self):
        with self.assertRaises(ValueError):
            build_kan(in_features=2, hidden_sizes=[4], out_features=1, grid_size=0)

    def test_degree_zero_raises(self):
        with self.assertRaises(ValueError):
            build_kan(in_features=2, hidden_sizes=[4], out_features=1, degree=0)

    # ── Deep multi-layer build works ─────────────────────────────────────────
    def test_deep_network(self):
        model = build_kan(
            in_features=4, hidden_sizes=[16, 16, 8], out_features=3
        )
        x   = torch.randn(8, 4)
        out = model(x)
        self.assertEqual(out.shape, (8, 3))


# ════════════════════════════════════════════════════════════════════════════
# Tests: training convergence (tiny dataset, few steps)
# ════════════════════════════════════════════════════════════════════════════

class TestTrainingConvergence(unittest.TestCase):
    """
    Verify that the KAN can actually learn on a tiny synthetic dataset.
    This is a functional sanity check, not a benchmark claim.
    The target function is f(x1, x2) = sin(pi*x1) + x2^2.
    """

    def setUp(self):
        torch.manual_seed(0)
        np.random.seed(0)
        rng  = np.random.default_rng(0)
        n    = 100
        X    = rng.uniform(-1.0, 1.0, size=(n, 2)).astype(np.float32)
        y    = (np.sin(np.pi * X[:, 0]) + X[:, 1] ** 2).astype(np.float32)
        self.X = torch.from_numpy(X)
        self.y = torch.from_numpy(y)

    # ── Loss decreases over 20 optimiser steps ────────────────────────────────
    def test_loss_decreases(self):
        torch.manual_seed(0)
        model = build_kan(in_features=2, hidden_sizes=[8], out_features=1,
                          grid_size=5, degree=3)
        opt   = torch.optim.Adam(model.parameters(), lr=0.01)
        crit  = nn.MSELoss()

        model.train()
        losses = []
        for _ in range(20):
            opt.zero_grad()
            pred = model(self.X).squeeze(1)
            loss = crit(pred, self.y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            opt.step()
            losses.append(loss.item())

        self.assertLess(
            losses[-1], losses[0],
            f"Loss did not decrease: {losses[0]:.4f} -> {losses[-1]:.4f}"
        )

    # ── Model predictions are finite (no NaN/Inf) ─────────────────────────────
    def test_predictions_finite(self):
        torch.manual_seed(0)
        model = build_kan(in_features=2, hidden_sizes=[4], out_features=1)
        model.eval()
        with torch.no_grad():
            out = model(self.X)
        self.assertTrue(
            torch.isfinite(out).all(),
            "Model produced NaN or Inf predictions"
        )

    # ── Regression: test MSE improves after training vs random init ───────────
    def test_trained_beats_random(self):
        torch.manual_seed(5)
        model = build_kan(in_features=2, hidden_sizes=[8], out_features=1,
                          grid_size=5, degree=3)
        crit  = nn.MSELoss()

        # MSE before training
        model.eval()
        with torch.no_grad():
            mse_before = crit(model(self.X).squeeze(1), self.y).item()

        # Train for 30 steps
        model.train()
        opt = torch.optim.Adam(model.parameters(), lr=0.01)
        for _ in range(30):
            opt.zero_grad()
            loss = crit(model(self.X).squeeze(1), self.y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            opt.step()

        model.eval()
        with torch.no_grad():
            mse_after = crit(model(self.X).squeeze(1), self.y).item()

        self.assertLess(
            mse_after, mse_before,
            f"MSE did not improve: before={mse_before:.4f}, after={mse_after:.4f}"
        )


# ════════════════════════════════════════════════════════════════════════════
# Runner
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    unittest.main(verbosity=2)
