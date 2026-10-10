"""
drafter/agent.py
=================
Deterministic Drafter Agent for ARES Member 4.

Responsibilities
----------------
1. Accept a validated experiment results JSON path and paper metadata.
2. Validate the results schema and experiment status.
3. Read metrics, config, provenance, runtime, and artifact paths.
4. Select and populate the requested LaTeX template (``ieee`` or ``neurips``).
5. Render the metric table and loss-curve figure block.
6. Escape LaTeX special characters in all user-supplied text.
7. Detect unresolved ``{{ placeholder }}`` tokens before saving.
8. Write the generated ``.tex`` and a JSON validation/metadata report.
9. Return a structured ``DraftResult``.

This is a DETERMINISTIC agent — it requires no LLM API key.
AI-generated prose can be layered on top later by replacing the default
section-body strings before calling ``draft_paper``.

Scientific integrity
--------------------
- Synthetic pipeline-test results are explicitly labelled in the output.
- No reproduction claims for Liu et al. (2024) are inserted.
- Missing information produces a clearly marked ``[PLACEHOLDER: ...]``
  rather than invented content.
- No statistical significance claims are generated automatically.

Usage
-----
>>> from drafter.agent import draft_paper, DraftConfig
>>> cfg = DraftConfig(
...     results_json="benchmarks/kan_baseline/experiments/xxx/results.json",
...     template="ieee",
...     title="A Minimal KAN Baseline for ARES",
...     authors="Researcher A, Researcher B",
...     out_dir="drafter/output",
... )
>>> result = draft_paper(cfg)
>>> print(result.status, result.tex_path)
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

import jinja2

# ── Repo root ────────────────────────────────────────────────────────────────
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ── Template directory ────────────────────────────────────────────────────────
_TEMPLATES_DIR = os.path.join(_REPO_ROOT, "templates")

# ── Supported template names ─────────────────────────────────────────────────
SUPPORTED_TEMPLATES = ("ieee", "neurips")

# ── Required results.json top-level keys ─────────────────────────────────────
_REQUIRED_KEYS = {
    "experiment_id", "status", "dataset_provenance", "task_type",
    "seed", "model_description", "n_parameters", "metrics",
    "final_train_loss", "elapsed_seconds", "artefacts", "disclaimer",
}

# ── Required metrics keys (regression) ───────────────────────────────────────
_REGRESSION_METRIC_KEYS = {"mse", "rmse", "mae", "r2"}
_CLASSIFICATION_METRIC_KEYS = {"accuracy", "macro_f1", "macro_precision", "macro_recall"}

# ── Accepted statuses ─────────────────────────────────────────────────────────
_ACCEPTED_STATUSES = {"pipeline_test_completed", "completed"}

# ── Placeholder regex (Jinja2 blocks that were NOT filled) ───────────────────
# Templates use << variable_name >> delimiters (avoids conflict with LaTeX {})
_UNFILLED_PLACEHOLDER_RE = re.compile(r"<<\s*\w+\s*>>")

# ── LaTeX special characters that must be escaped ────────────────────────────
# NOTE: We use a sentinel-based two-pass approach for backslash so that
# the inserted command text (\textbackslash{}) is not itself re-escaped.
_LATEX_ESCAPE_SENTINEL = "\x00BSLASH\x00"   # never appears in real text
_LATEX_ESCAPE_MAP = [
    # Backslash first — replaced by sentinel, resolved after all other escapes
    ("\\",  _LATEX_ESCAPE_SENTINEL),
    ("&",   r"\&"),
    ("%",   r"\%"),
    ("$",   r"\$"),
    ("#",   r"\#"),
    ("_",   r"\_"),
    ("{",   r"\{"),
    ("}",   r"\}"),
    ("~",   r"\textasciitilde{}"),
    ("^",   r"\textasciicircum{}"),
]


# ════════════════════════════════════════════════════════════════════════════
# Public types
# ════════════════════════════════════════════════════════════════════════════

@dataclass
class DraftConfig:
    """
    All inputs needed to generate a draft paper.

    Parameters
    ----------
    results_json : path to the experiment results.json file
    template     : ``"ieee"`` or ``"neurips"``
    title        : paper title (will be LaTeX-escaped)
    authors      : author string, e.g. ``"Alice Smith, Bob Jones"``
    out_dir      : directory where output files are written
    affiliation  : author affiliation (default placeholder)
    abstract     : optional abstract text; placeholder used if empty
    introduction : optional introduction body; placeholder used if empty
    related_work : optional related-work body; placeholder used if empty
    methodology  : optional methodology body; placeholder used if empty
    experimental_setup : optional experimental-setup body
    results_discussion : optional results-discussion body
    limitations  : optional limitations body
    conclusion   : optional conclusion body
    """
    results_json:       str
    template:           str   = "ieee"
    title:              str   = "[PLACEHOLDER: paper title]"
    authors:            str   = "[PLACEHOLDER: author names]"
    out_dir:            str   = ""
    affiliation:        str   = "[PLACEHOLDER: affiliation]"
    abstract:           str   = ""
    introduction:       str   = ""
    related_work:       str   = ""
    methodology:        str   = ""
    experimental_setup: str   = ""
    results_discussion: str   = ""
    limitations:        str   = ""
    conclusion:         str   = ""

    def validate(self) -> None:
        """
        Validate all fields before running the agent.

        Raises
        ------
        ValueError : any required field is invalid
        FileNotFoundError : results_json path does not exist
        """
        if not self.results_json:
            raise ValueError("results_json must not be empty.")
        if not os.path.exists(self.results_json):
            raise FileNotFoundError(
                f"results_json not found: '{self.results_json}'"
            )
        if self.template not in SUPPORTED_TEMPLATES:
            raise ValueError(
                f"template must be one of {SUPPORTED_TEMPLATES}, "
                f"got '{self.template}'."
            )
        if not self.out_dir:
            raise ValueError("out_dir must not be empty.")


@dataclass
class DraftResult:
    """
    Structured result returned by :func:`draft_paper`.

    Attributes
    ----------
    status           : ``"success"``, ``"success_with_warnings"``, or ``"failed"``
    tex_path         : absolute path to the generated .tex file (or None)
    report_path      : absolute path to the JSON validation report (or None)
    warnings         : list of non-fatal issues found during drafting
    errors           : list of fatal errors (non-empty only when status="failed")
    unresolved_placeholders : list of ``{{ name }}`` tokens left unfilled
    neurips_sty_missing     : True if the NeurIPS .sty file is absent
    """
    status:                  str
    tex_path:                Optional[str]          = None
    report_path:             Optional[str]          = None
    warnings:                list[str]              = field(default_factory=list)
    errors:                  list[str]              = field(default_factory=list)
    unresolved_placeholders: list[str]              = field(default_factory=list)
    neurips_sty_missing:     bool                   = False


# ════════════════════════════════════════════════════════════════════════════
# LaTeX escaping
# ════════════════════════════════════════════════════════════════════════════

def escape_latex(text: str) -> str:
    r"""
    Escape LaTeX special characters in *text* using a sentinel-based approach.

    The backslash is replaced by a sentinel first, then all other special
    characters are escaped, then the sentinel is resolved to
    ``\textbackslash{}``.  This prevents double-escaping the backslash
    characters introduced by the other replacements.

    Characters escaped:  \ & % $ # _ { } ~ ^

    Parameters
    ----------
    text : raw string (e.g. user-supplied title or author name)

    Returns
    -------
    str : safe LaTeX string

    Examples
    --------
    >>> escape_latex("50% accuracy & loss < 0.01")
    '50\\% accuracy \\& loss < 0.01'
    >>> escape_latex("x_1 = $5")
    'x\\_1 = \\$5'
    """
    if not isinstance(text, str):
        text = str(text)
    for char, replacement in _LATEX_ESCAPE_MAP:
        text = text.replace(char, replacement)
    # Resolve the backslash sentinel last
    text = text.replace(_LATEX_ESCAPE_SENTINEL, r"\textbackslash{}")
    return text


def escape_latex_number(value) -> str:
    """
    Format a numeric value for LaTeX.  Floats are rounded to 6 significant
    figures; strings are passed through :func:`escape_latex`.
    """
    if isinstance(value, float):
        return f"{value:.6g}"
    return escape_latex(str(value))


# ════════════════════════════════════════════════════════════════════════════
# Results JSON validation
# ════════════════════════════════════════════════════════════════════════════

def _load_and_validate_results(path: str) -> tuple[dict, list[str]]:
    """
    Load and structurally validate a results.json file.

    Returns
    -------
    (data, warnings) where *data* is the parsed dict and *warnings* is a list
    of non-fatal issues.

    Raises
    ------
    ValueError : missing required keys, invalid status, or invalid metrics
    json.JSONDecodeError : file is not valid JSON
    """
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)

    warnings: list[str] = []

    # ── Required top-level keys ──────────────────────────────────────────────
    missing_keys = _REQUIRED_KEYS - set(data.keys())
    if missing_keys:
        raise ValueError(
            f"results.json is missing required keys: {sorted(missing_keys)}"
        )

    # ── Status check ─────────────────────────────────────────────────────────
    status = data.get("status", "")
    if status not in _ACCEPTED_STATUSES:
        raise ValueError(
            f"Experiment status is '{status}'. "
            f"Drafting requires one of {sorted(_ACCEPTED_STATUSES)}. "
            "Run the training pipeline to completion before drafting."
        )

    # ── Metrics ──────────────────────────────────────────────────────────────
    metrics = data.get("metrics") or {}
    if not metrics:
        raise ValueError("results.json 'metrics' field is empty or null.")

    task = data.get("task_type", "regression")
    if task == "regression":
        missing_m = _REGRESSION_METRIC_KEYS - set(metrics.keys())
        if missing_m:
            warnings.append(
                f"Regression metrics missing: {sorted(missing_m)}. "
                "Affected table rows will show [N/A]."
            )
    elif task == "classification":
        missing_m = _CLASSIFICATION_METRIC_KEYS - set(metrics.keys())
        if missing_m:
            warnings.append(
                f"Classification metrics missing: {sorted(missing_m)}."
            )

    # ── Artefact paths ────────────────────────────────────────────────────────
    arts = data.get("artefacts") or {}
    loss_plot = arts.get("loss_plot")
    if loss_plot and not os.path.exists(loss_plot):
        warnings.append(
            f"loss_plot path in results.json does not exist on disk: "
            f"'{loss_plot}'. Figure block will be omitted."
        )

    return data, warnings


# ════════════════════════════════════════════════════════════════════════════
# Template rendering helpers
# ════════════════════════════════════════════════════════════════════════════

def _build_metrics_table_rows(metrics: dict, task_type: str) -> str:
    """
    Build the LaTeX tabular rows for the metrics table.

    Returns a string of ``Name & Value \\\\`` lines, one per metric.
    """
    rows: list[str] = []

    if task_type == "regression":
        ordered = [
            ("MSE",  "mse"),
            ("RMSE", "rmse"),
            ("MAE",  "mae"),
            ("R\\textsuperscript{2}", "r2"),
        ]
        for label, key in ordered:
            val = metrics.get(key, "[N/A]")
            rows.append(
                f"{label} & {escape_latex_number(val)} \\\\"
            )
    else:
        ordered = [
            ("Accuracy",          "accuracy"),
            ("Macro Precision",   "macro_precision"),
            ("Macro Recall",      "macro_recall"),
            ("Macro F1",          "macro_f1"),
        ]
        for label, key in ordered:
            val = metrics.get(key, "[N/A]")
            rows.append(
                f"{escape_latex(label)} & {escape_latex_number(val)} \\\\"
            )

    # Append runtime
    return "\n".join(rows)


def _build_loss_figure(
    loss_plot_path: Optional[str],
    experiment_id: str,
    warnings: list[str],
) -> str:
    """
    Build the LaTeX figure block for the loss curve.

    Returns the full ``\\begin{figure}...\\end{figure}`` block as a string,
    or an empty string with a warning appended if the file is absent.
    """
    if not loss_plot_path or not os.path.exists(loss_plot_path):
        warnings.append(
            "Loss curve figure omitted: file not found at "
            f"'{loss_plot_path}'."
        )
        return (
            "% [NOTE: loss curve figure was omitted because the file was "
            "not found at the path recorded in results.json]"
        )

    # Use forward slashes — pdflatex requires them even on Windows
    safe_path = loss_plot_path.replace("\\", "/")

    return (
        "\\begin{figure}[h]\n"
        "  \\centering\n"
        f"  \\includegraphics[width=0.9\\linewidth]{{{safe_path}}}\n"
        f"  \\caption{{Training loss curve for experiment "
        f"\\texttt{{{escape_latex(experiment_id)}}}.}}\n"
        "  \\label{fig:loss_curve}\n"
        "\\end{figure}"
    )


def _default_section(placeholder_name: str) -> str:
    """Return a clearly-marked placeholder for an empty section body."""
    return f"[PLACEHOLDER: {placeholder_name}]"


def _check_neurips_sty(template_dir: str) -> bool:
    """Return True if at least one neurips*.sty file exists in *template_dir*."""
    for fname in os.listdir(template_dir):
        if fname.startswith("neurips") and fname.endswith(".sty"):
            return True
    return False


# ════════════════════════════════════════════════════════════════════════════
# Unresolved placeholder detection
# ════════════════════════════════════════════════════════════════════════════

def detect_unresolved_placeholders(tex_content: str) -> list[str]:
    """
    Return a sorted list of unique ``{{ name }}`` tokens still present in
    *tex_content* after template rendering.

    These indicate placeholders the Jinja2 renderer did not fill because the
    corresponding variable was not provided.

    Parameters
    ----------
    tex_content : rendered .tex file content as a string

    Returns
    -------
    list[str] : sorted unique placeholder tokens, e.g. ``['{{ title }}']``
    """
    found = _UNFILLED_PLACEHOLDER_RE.findall(tex_content)
    return sorted(set(found))


# ════════════════════════════════════════════════════════════════════════════
# Main public API
# ════════════════════════════════════════════════════════════════════════════

def draft_paper(cfg: DraftConfig) -> DraftResult:
    """
    Generate a LaTeX draft paper from experiment results.

    Parameters
    ----------
    cfg : DraftConfig — all inputs (see class docstring)

    Returns
    -------
    DraftResult — status, output paths, warnings, unresolved placeholders

    The function never raises on non-fatal issues; they are collected in
    ``DraftResult.warnings``.  Fatal errors set ``status="failed"`` and
    populate ``DraftResult.errors``.

    Output files
    ------------
    ``<out_dir>/paper_<template>_<experiment_id>.tex``  — the draft .tex
    ``<out_dir>/draft_report_<experiment_id>.json``     — validation report
    """
    warnings: list[str] = []
    errors:   list[str] = []

    # ── 1. Validate config ───────────────────────────────────────────────────
    try:
        cfg.validate()
    except (ValueError, FileNotFoundError) as exc:
        return DraftResult(
            status="failed",
            errors=[str(exc)],
        )

    os.makedirs(cfg.out_dir, exist_ok=True)

    # ── 2. Load and validate results.json ────────────────────────────────────
    try:
        data, load_warnings = _load_and_validate_results(cfg.results_json)
        warnings.extend(load_warnings)
    except (ValueError, json.JSONDecodeError, OSError) as exc:
        return DraftResult(status="failed", errors=[str(exc)])

    experiment_id = data["experiment_id"]
    metrics       = data["metrics"] or {}
    task_type     = data.get("task_type", "regression")
    arts          = data.get("artefacts") or {}
    loss_plot     = arts.get("loss_plot")
    disclaimer    = data.get("disclaimer", "")
    provenance    = data.get("dataset_provenance", "[UNKNOWN]")

    # Warn explicitly if this is a synthetic run
    if "SYNTHETIC" in provenance.upper():
        warnings.append(
            "Dataset provenance indicates SYNTHETIC data. "
            "The generated paper will clearly label results as synthetic "
            "pipeline-test results, not paper reproduction."
        )

    # ── 3. Locate the template ───────────────────────────────────────────────
    template_dir  = os.path.join(_TEMPLATES_DIR, cfg.template)
    template_file = os.path.join(template_dir, "paper.tex")

    if not os.path.exists(template_file):
        return DraftResult(
            status="failed",
            errors=[
                f"Template file not found: '{template_file}'. "
                f"Expected at templates/{cfg.template}/paper.tex"
            ],
        )

    # ── 4. Check for NeurIPS .sty ────────────────────────────────────────────
    neurips_sty_missing = False
    if cfg.template == "neurips":
        neurips_sty_missing = not _check_neurips_sty(template_dir)
        if neurips_sty_missing:
            warnings.append(
                "neurips_2024.sty (or similar) not found in "
                f"'{template_dir}'. "
                "The generated .tex will compile in draft mode only "
                "(standard article class). "
                "Download from https://neurips.cc/Conferences/2024/"
                "PaperInformation/StyleFiles and place in "
                "templates/neurips/ before final compilation."
            )

    # ── 5. Build template variables ──────────────────────────────────────────
    metrics_table = _build_metrics_table_rows(metrics, task_type)
    loss_figure   = _build_loss_figure(loss_plot, experiment_id, warnings)

    # Runtime row appended to metrics table
    elapsed = data.get("elapsed_seconds", "[N/A]")
    metrics_table += f"\nRuntime (s) & {escape_latex_number(elapsed)} \\\\"

    # Config fields
    cfg_block: dict = {}
    # Try to load the experiment config.json alongside results.json
    results_dir  = os.path.dirname(cfg.results_json)
    config_path  = os.path.join(results_dir, "config.json")
    if os.path.exists(config_path):
        with open(config_path, encoding="utf-8") as fh:
            cfg_block = json.load(fh)
    else:
        warnings.append(
            f"config.json not found at '{config_path}'. "
            "Hyperparameter table will use values from results.json only."
        )

    def _cfg(key: str, fallback="[N/A]"):
        """Get value from config.json, fall back to results.json, then fallback."""
        return cfg_block.get(key, data.get(key, fallback))

    # ── 6. Build section bodies (use caller-supplied text or placeholder) ─────
    def _section(caller_text: str, name: str) -> str:
        if caller_text and caller_text.strip():
            return caller_text.strip()
        return _default_section(name)

    template_vars = {
        # Identity
        "title":              escape_latex(cfg.title),
        "authors":            escape_latex(cfg.authors),
        "affiliation":        escape_latex(cfg.affiliation),
        "experiment_id":      escape_latex(experiment_id),
        "generation_date":    str(date.today()),
        "disclaimer":         escape_latex(disclaimer),
        # Dataset / provenance
        "dataset_provenance": escape_latex(provenance),
        # Model
        "model_description":  escape_latex(str(data.get("model_description", "[N/A]"))),
        "n_parameters":       escape_latex_number(data.get("n_parameters", "[N/A]")),
        # Hyperparameters
        "seed":               escape_latex_number(_cfg("seed")),
        "epochs":             escape_latex_number(_cfg("epochs")),
        "lr":                 escape_latex_number(_cfg("lr")),
        "batch_size":         escape_latex_number(_cfg("batch_size")),
        # Rendered blocks
        "metrics_table":      metrics_table,
        "loss_figure":        loss_figure,
        # Section bodies
        "abstract":           _section(cfg.abstract,           "abstract"),
        "introduction":       _section(cfg.introduction,       "introduction"),
        "related_work":       _section(cfg.related_work,       "related work"),
        "methodology":        _section(cfg.methodology,        "methodology"),
        "experimental_setup": _section(cfg.experimental_setup, "experimental setup"),
        "results_discussion": _section(cfg.results_discussion, "results discussion"),
        "limitations":        _section(cfg.limitations,        "limitations"),
        "conclusion":         _section(cfg.conclusion,         "conclusion"),
    }

    # ── 7. Render with Jinja2 ─────────────────────────────────────────────────
    # We use << >> as variable delimiters to avoid conflicts with LaTeX { }.
    # The template files use << variable_name >> syntax.
    try:
        loader = jinja2.FileSystemLoader(template_dir)
        env    = jinja2.Environment(
            loader=loader,
            variable_start_string="<<",
            variable_end_string=">>",
            block_start_string="<<%",
            block_end_string="%>>",
            comment_start_string="<<#",
            comment_end_string="#>>",
            undefined=jinja2.Undefined,
            keep_trailing_newline=True,
        )
        tmpl        = env.get_template("paper.tex")
        tex_content = tmpl.render(**template_vars)
    except jinja2.TemplateError as exc:
        return DraftResult(
            status="failed",
            errors=[f"Jinja2 template error: {exc}"],
        )

    # ── 8. Detect unresolved placeholders ────────────────────────────────────
    unresolved = detect_unresolved_placeholders(tex_content)
    if unresolved:
        warnings.append(
            f"{len(unresolved)} unresolved placeholder(s) remain: "
            f"{unresolved}"
        )

    # ── 9. Write .tex file ────────────────────────────────────────────────────
    tex_filename = f"paper_{cfg.template}_{experiment_id}.tex"
    tex_path     = os.path.join(cfg.out_dir, tex_filename)
    with open(tex_path, "w", encoding="utf-8") as fh:
        fh.write(tex_content)

    # ── 10. Write validation report ──────────────────────────────────────────
    report = {
        "experiment_id":          experiment_id,
        "template":               cfg.template,
        "generation_date":        str(date.today()),
        "status":                 "success_with_warnings" if warnings else "success",
        "tex_path":               tex_path,
        "warnings":               warnings,
        "errors":                 errors,
        "unresolved_placeholders": unresolved,
        "neurips_sty_missing":    neurips_sty_missing,
        "dataset_provenance":     provenance,
        "is_synthetic":           "SYNTHETIC" in provenance.upper(),
        "metrics_included":       list(metrics.keys()),
        "loss_figure_included":   bool(loss_plot and os.path.exists(loss_plot)),
        "disclaimer":             disclaimer,
    }

    report_filename = f"draft_report_{experiment_id}.json"
    report_path     = os.path.join(cfg.out_dir, report_filename)
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    final_status = "success_with_warnings" if warnings else "success"

    return DraftResult(
        status=final_status,
        tex_path=tex_path,
        report_path=report_path,
        warnings=warnings,
        errors=[],
        unresolved_placeholders=unresolved,
        neurips_sty_missing=neurips_sty_missing,
    )
