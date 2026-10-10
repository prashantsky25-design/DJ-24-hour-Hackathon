"""
benchmarks/kan_baseline/model.py
==================================
Reusable KAN-style model components for the ARES research baseline.

This module is imported by both ``smoke_test.py`` and ``research/train.py``.
It keeps the architecture in one place so both scripts stay in sync.

IMPORTANT DISCLAIMERS
---------------------
This is a **simplified educational implementation** of Kolmogorov-Arnold
Networks, inspired by:

    Liu et al. (2024) "KAN: Kolmogorov-Arnold Networks"
    arXiv:2404.19756  https://arxiv.org/abs/2404.19756

It is NOT an exact reproduction of that paper. The following features
from the original paper are NOT implemented here:

    - Adaptive grid refinement during training (paper Section 2.4)
    - Entropy-based regularisation for sparsity (paper Section 2.5)
    - Pruning and symbolic regression (paper Section 3)
    - Sample-by-sample B-spline normalisation (paper Eq. 2.5)

What IS implemented:
    - Learnable univariate functions on each edge (the KAN core idea)
    - B-spline basis approximation via Cox-de Boor recursion
    - SiLU residual base activation
    - Configurable depth (arbitrary list of layer widths)
    - Layer normalisation for training stability
    - CPU-first design; no GPU dependency

Use this module as a research starting point, not as a benchmark claim.

Classes
-------
KANEdge   : one learnable phi: R -> R per network edge
KANLayer  : one full KAN layer (in_dim inputs, out_dim outputs)
KAN       : full KAN network with configurable layer sizes

Factory
-------
build_kan(in_features, hidden_sizes, out_features, grid_size, degree) -> KAN
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


# ════════════════════════════════════════════════════════════════════════════
# B-spline basis
# ════════════════════════════════════════════════════════════════════════════

def b_spline_basis(
    x: torch.Tensor,
    grid: torch.Tensor,
    degree: int,
) -> torch.Tensor:
    """
    Evaluate B-spline basis functions at points *x* using Cox-de Boor
    recursion on a pre-extended uniform knot grid.

    Parameters
    ----------
    x      : (batch,) — input values, clamped to [grid[0], grid[-1]]
    grid   : (G + 2*degree + 1,) — extended knot vector
    degree : polynomial degree k (cubic = 3)

    Returns
    -------
    basis : (batch, n_basis) where n_basis shrinks by 1 at each degree step,
            ending at (batch, G + degree).
    """
    x = x.clamp(grid[0], grid[-1]).unsqueeze(1)   # (batch, 1)

    # Degree-0 basis: indicator for each knot interval
    basis = ((x >= grid[:-1]) & (x < grid[1:])).float()
    # Close the right boundary of the last interval
    basis[:, -1] += (x.squeeze(1) == grid[-1]).float()

    # Degree-k Cox-de Boor recursion
    for k in range(1, degree + 1):
        n_b = basis.shape[1] - 1
        if n_b <= 0:
            break
        left  = (x - grid[:n_b]) / (
            grid[k : n_b + k] - grid[:n_b] + 1e-8
        )
        right = (grid[k + 1 : n_b + k + 1] - x) / (
            grid[k + 1 : n_b + k + 1] - grid[1 : n_b + 1] + 1e-8
        )
        basis = left * basis[:, :n_b] + right * basis[:, 1 : n_b + 1]

    return basis   # (batch, G + degree)


# ════════════════════════════════════════════════════════════════════════════
# KANEdge — one learnable univariate function phi: R -> R
# ════════════════════════════════════════════════════════════════════════════

class KANEdge(nn.Module):
    """
    One learnable univariate function approximated as:

        phi(x) = w_base * SiLU(x) + sum_i( c_i * B_i(x) )

    where:
        - SiLU(x) = x * sigmoid(x) is a smooth residual base activation
        - B_i are B-spline basis functions on a uniform fixed grid
        - c_i are learnable spline coefficients
        - w_base is a learnable scalar weight on the residual term

    Parameters
    ----------
    grid_size : number of intervals in the B-spline grid (G)
    degree    : polynomial degree of the B-splines (k); cubic (3) is default
    grid_range: (lo, hi) extent of the input grid (default -1 to 1)
    """

    def __init__(
        self,
        grid_size:  int   = 5,
        degree:     int   = 3,
        grid_range: tuple[float, float] = (-1.0, 1.0),
    ) -> None:
        super().__init__()
        self.degree = degree

        lo, hi = grid_range
        base_grid = torch.linspace(lo, hi, grid_size + 1)
        step = base_grid[1] - base_grid[0]
        left_ext  = base_grid[0]  - torch.arange(degree, 0, -1) * step
        right_ext = base_grid[-1] + torch.arange(1, degree + 1)  * step
        grid = torch.cat([left_ext, base_grid, right_ext])
        # grid shape: (grid_size + 2*degree + 1,)
        self.register_buffer("grid", grid)

        n_coeff = grid_size + degree   # number of B-spline basis functions
        self.coeff  = nn.Parameter(torch.empty(n_coeff))
        self.w_base = nn.Parameter(torch.tensor(0.1))
        nn.init.normal_(self.coeff, std=0.1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : (batch,)

        Returns
        -------
        out : (batch,)
        """
        base   = F.silu(x)
        basis  = b_spline_basis(x, self.grid, self.degree)
        n      = min(basis.shape[1], self.coeff.shape[0])
        spline = (basis[:, :n] * self.coeff[:n]).sum(dim=1)
        return self.w_base * base + spline


# ════════════════════════════════════════════════════════════════════════════
# KANLayer — one complete layer
# ════════════════════════════════════════════════════════════════════════════

class KANLayer(nn.Module):
    """
    A KAN layer mapping ``in_dim`` inputs to ``out_dim`` outputs.

    Each of the ``in_dim * out_dim`` input-output pairs has its own
    ``KANEdge``, making the total number of learnable functions equal to
    the product of the two dimensions.

    A ``LayerNorm`` is applied to the output to stabilise training.
    """

    def __init__(
        self,
        in_dim:     int,
        out_dim:    int,
        grid_size:  int   = 5,
        degree:     int   = 3,
        grid_range: tuple[float, float] = (-1.0, 1.0),
    ) -> None:
        super().__init__()
        self.in_dim  = in_dim
        self.out_dim = out_dim
        self.edges   = nn.ModuleList([
            KANEdge(grid_size, degree, grid_range)
            for _ in range(in_dim * out_dim)
        ])
        self.layer_norm = nn.LayerNorm(out_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : (batch, in_dim)

        Returns
        -------
        out : (batch, out_dim)
        """
        batch = x.shape[0]
        out   = torch.zeros(batch, self.out_dim, device=x.device)

        for j in range(self.out_dim):
            acc = torch.zeros(batch, device=x.device)
            for i in range(self.in_dim):
                acc = acc + self.edges[i * self.out_dim + j](x[:, i])
            out[:, j] = acc

        return self.layer_norm(out)


# ════════════════════════════════════════════════════════════════════════════
# KAN — full configurable network
# ════════════════════════════════════════════════════════════════════════════

class KAN(nn.Module):
    """
    Configurable KAN network with an arbitrary number of layers.

    Architecture
    ------------
    Input(in_features) -> KANLayer -> ... -> KANLayer -> output(out_features)

    The last layer is a standard ``nn.Linear`` projection so the network
    can produce any number of output values cleanly.  This is a pragmatic
    choice: the paper's original formulation has a KAN layer at every step,
    but using a linear output head avoids dimension mismatches without
    additional output-normalisation tricks.

    Parameters
    ----------
    in_features   : number of input features
    hidden_sizes  : list of hidden layer widths, e.g. [8, 8]
    out_features  : output dimension (1 for regression; n_classes for clf)
    grid_size     : B-spline grid intervals per edge
    degree        : B-spline polynomial degree
    grid_range    : input range for the B-spline grid
    """

    def __init__(
        self,
        in_features:  int,
        hidden_sizes: list[int],
        out_features: int,
        grid_size:    int   = 5,
        degree:       int   = 3,
        grid_range:   tuple[float, float] = (-1.0, 1.0),
    ) -> None:
        super().__init__()

        if not hidden_sizes:
            raise ValueError("hidden_sizes must contain at least one element.")

        dims = [in_features] + hidden_sizes
        self.kan_layers = nn.ModuleList()
        for i in range(len(dims) - 1):
            self.kan_layers.append(
                KANLayer(dims[i], dims[i + 1], grid_size, degree, grid_range)
            )
        # Final linear projection: no splines on the output layer
        self.output_head = nn.Linear(hidden_sizes[-1], out_features)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : (batch, in_features)

        Returns
        -------
        out : (batch, out_features)
        """
        h = x
        for layer in self.kan_layers:
            h = layer(h)
        return self.output_head(h)

    @property
    def n_parameters(self) -> int:
        """Total number of learnable parameters."""
        return sum(p.numel() for p in self.parameters())

    def description(self) -> str:
        """Human-readable architecture string."""
        dims = []
        for layer in self.kan_layers:
            dims.append(layer.in_dim)
        dims.append(self.kan_layers[-1].out_dim)
        dims.append(self.output_head.out_features)
        return "KAN[" + "->".join(str(d) for d in dims) + "]"


# ════════════════════════════════════════════════════════════════════════════
# Factory helper
# ════════════════════════════════════════════════════════════════════════════

def build_kan(
    in_features:  int,
    hidden_sizes: list[int],
    out_features: int,
    grid_size:    int   = 5,
    degree:       int   = 3,
    grid_range:   tuple[float, float] = (-1.0, 1.0),
) -> KAN:
    """
    Convenience factory that validates arguments and returns a ``KAN``.

    Parameters
    ----------
    in_features  : number of input features (must be >= 1)
    hidden_sizes : list of hidden layer widths (must be non-empty, all >= 1)
    out_features : output dimension (must be >= 1)
    grid_size    : B-spline grid intervals per edge (must be >= 1)
    degree       : B-spline polynomial degree (must be >= 1)
    grid_range   : (lo, hi) extent of the B-spline input grid

    Raises
    ------
    ValueError : any argument is out of range
    """
    if in_features < 1:
        raise ValueError(f"in_features must be >= 1, got {in_features}.")
    if not hidden_sizes or any(h < 1 for h in hidden_sizes):
        raise ValueError(
            f"hidden_sizes must be a non-empty list of positive ints, "
            f"got {hidden_sizes}."
        )
    if out_features < 1:
        raise ValueError(f"out_features must be >= 1, got {out_features}.")
    if grid_size < 1:
        raise ValueError(f"grid_size must be >= 1, got {grid_size}.")
    if degree < 1:
        raise ValueError(f"degree must be >= 1, got {degree}.")

    return KAN(in_features, hidden_sizes, out_features, grid_size, degree, grid_range)
