"""
tests/test_drafter.py
======================
Tests for ``drafter/agent.py`` and the LaTeX templates.

What is covered
---------------
- Valid results JSON -> success
- Missing results JSON path
- Invalid results JSON (not valid JSON)
- Missing required keys in results JSON
- Incomplete experiment status
- Unsupported template selection
- LaTeX special-character escaping (all 10 special chars)
- Correct metric table generation (regression + classification)
- Figure inclusion when loss plot exists
- Graceful handling when loss plot is missing
- Unresolved placeholder detection
- Synthetic dataset provenance labelling in report
- Output .tex and metadata report creation
- NeurIPS .sty missing warning
- DraftConfig validation (empty path, bad template, empty out_dir)
- escape_latex is idempotent on plain ASCII

Runner (no extra install needed):
    python -m unittest tests/test_drafter.py -v
    python -m unittest discover tests -v
"""

import json
import os
import sys
import tempfile
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from drafter.agent import (
    DraftConfig,
    DraftResult,
    draft_paper,
    escape_latex,
    detect_unresolved_placeholders,
    _build_metrics_table_rows,
    _build_loss_figure,
)


# ════════════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════════════

def _write_results_json(tmp_dir: str, overrides: dict | None = None) -> str:
    """Write a minimal valid results.json and return its path."""
    base = {
        "experiment_id":      "test0001",
        "status":             "pipeline_test_completed",
        "error_message":      None,
        "dataset_provenance": "SYNTHETIC_test.csv",
        "task_type":          "regression",
        "seed":               42,
        "model_description":  "KAN[2->4->1]",
        "n_parameters":       61,
        "metrics": {
            "mse":  0.01,
            "rmse": 0.1,
            "mae":  0.08,
            "r2":   0.98,
        },
        "final_train_loss": 0.005,
        "elapsed_seconds":  12.5,
        "artefacts": {
            "config":    os.path.join(tmp_dir, "config.json"),
            "results":   os.path.join(tmp_dir, "results.json"),
            "log":       os.path.join(tmp_dir, "training.log"),
            "loss_plot": None,          # no plot by default
        },
        "disclaimer": (
            "SIMPLIFIED KAN IMPLEMENTATION — not an exact reproduction of "
            "Liu et al. (2024) arXiv:2404.19756."
        ),
    }
    if overrides:
        # Deep-merge one level
        for k, v in overrides.items():
            if isinstance(v, dict) and isinstance(base.get(k), dict):
                base[k].update(v)
            else:
                base[k] = v

    path = os.path.join(tmp_dir, "results.json")
    with open(path, "w") as f:
        json.dump(base, f)
    return path


def _write_fake_plot(tmp_dir: str) -> str:
    """Write a 1-byte PNG placeholder and return its path."""
    p = os.path.join(tmp_dir, "loss_curve.png")
    with open(p, "wb") as f:
        f.write(b"\x89PNG")   # fake PNG magic bytes
    return p


def _minimal_cfg(tmp_dir: str, results_json: str, **overrides) -> DraftConfig:
    """Return a DraftConfig pointing at *results_json*."""
    cfg = DraftConfig(
        results_json = results_json,
        template     = "ieee",
        title        = "Test Paper",
        authors      = "Tester One",
        out_dir      = tmp_dir,
    )
    for k, v in overrides.items():
        setattr(cfg, k, v)
    return cfg


# ════════════════════════════════════════════════════════════════════════════
# Tests: escape_latex
# ════════════════════════════════════════════════════════════════════════════

class TestEscapeLatex(unittest.TestCase):

    # T1 — backslash is replaced by \textbackslash{} without double-escaping
    def test_backslash(self):
        result = escape_latex("a\\b")
        self.assertIn(r"\textbackslash{}", result)
        # The braces in \textbackslash{} must NOT themselves be escaped
        self.assertNotIn(r"\textbackslash\{\}", result)

    # T2 — ampersand
    def test_ampersand(self):
        self.assertEqual(escape_latex("A & B"), r"A \& B")

    # T3 — percent
    def test_percent(self):
        self.assertEqual(escape_latex("50%"), r"50\%")

    # T4 — dollar
    def test_dollar(self):
        self.assertEqual(escape_latex("$10"), r"\$10")

    # T5 — hash
    def test_hash(self):
        self.assertEqual(escape_latex("#1"), r"\#1")

    # T6 — underscore
    def test_underscore(self):
        self.assertEqual(escape_latex("x_1"), r"x\_1")

    # T7 — braces
    def test_braces(self):
        self.assertIn(r"\{", escape_latex("{x}"))
        self.assertIn(r"\}", escape_latex("{x}"))

    # T8 — tilde
    def test_tilde(self):
        self.assertIn(r"\textasciitilde{}", escape_latex("a~b"))

    # T9 — caret
    def test_caret(self):
        self.assertIn(r"\textasciicircum{}", escape_latex("x^2"))

    # T10 — plain ASCII is unchanged (no spurious escaping)
    def test_plain_ascii_unchanged(self):
        text = "hello world 123"
        self.assertEqual(escape_latex(text), text)

    # T11 — non-string input converted
    def test_non_string_input(self):
        result = escape_latex(42)
        self.assertIsInstance(result, str)


# ════════════════════════════════════════════════════════════════════════════
# Tests: detect_unresolved_placeholders
# ════════════════════════════════════════════════════════════════════════════

class TestDetectPlaceholders(unittest.TestCase):

    # T12 — no placeholders
    def test_no_placeholders(self):
        self.assertEqual(detect_unresolved_placeholders("Hello world"), [])

    # T13 — one placeholder
    def test_one_placeholder(self):
        result = detect_unresolved_placeholders("Title: << title >>")
        self.assertEqual(result, ["<< title >>"])

    # T14 — multiple unique placeholders
    def test_multiple_unique(self):
        text   = "<< title >> by << authors >>"
        result = detect_unresolved_placeholders(text)
        self.assertIn("<< title >>",   result)
        self.assertIn("<< authors >>", result)

    # T15 — duplicates counted once
    def test_duplicates_deduped(self):
        text   = "<< title >> and << title >>"
        result = detect_unresolved_placeholders(text)
        self.assertEqual(result.count("<< title >>"), 1)

    # T16 — LaTeX braces not confused with placeholders
    def test_latex_braces_ignored(self):
        text = r"\textbf{bold} and \ref{fig:loss}"
        self.assertEqual(detect_unresolved_placeholders(text), [])


# ════════════════════════════════════════════════════════════════════════════
# Tests: _build_metrics_table_rows
# ════════════════════════════════════════════════════════════════════════════

class TestMetricsTable(unittest.TestCase):

    # T17 — regression table contains MSE, RMSE, MAE, R²
    def test_regression_table_rows(self):
        metrics = {"mse": 0.01, "rmse": 0.1, "mae": 0.08, "r2": 0.98}
        rows    = _build_metrics_table_rows(metrics, "regression")
        self.assertIn("MSE",  rows)
        self.assertIn("RMSE", rows)
        self.assertIn("MAE",  rows)
        self.assertIn("0.01", rows)

    # T18 — classification table contains accuracy
    def test_classification_table_rows(self):
        metrics = {
            "accuracy": 0.95, "macro_precision": 0.94,
            "macro_recall": 0.93, "macro_f1": 0.935,
        }
        rows = _build_metrics_table_rows(metrics, "classification")
        self.assertIn("Accuracy", rows)
        self.assertIn("0.95",     rows)

    # T19 — missing metric shows [N/A]
    def test_missing_metric_shows_na(self):
        rows = _build_metrics_table_rows({}, "regression")
        self.assertIn("[N/A]", rows)

    # T20 — rows use LaTeX table separator
    def test_rows_have_latex_separator(self):
        metrics = {"mse": 0.01, "rmse": 0.1, "mae": 0.08, "r2": 0.98}
        rows    = _build_metrics_table_rows(metrics, "regression")
        self.assertIn("\\\\", rows)   # LaTeX row terminator


# ════════════════════════════════════════════════════════════════════════════
# Tests: _build_loss_figure
# ════════════════════════════════════════════════════════════════════════════

class TestLossFigure(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # T21 — figure block included when plot exists
    def test_figure_included_when_plot_exists(self):
        plot = _write_fake_plot(self.tmp)
        warnings = []
        block    = _build_loss_figure(plot, "test001", warnings)
        self.assertIn(r"\includegraphics", block)
        self.assertIn("test001", block)
        self.assertEqual(warnings, [],
                         "No warning expected when file exists")

    # T22 — figure omitted with warning when plot missing
    def test_figure_omitted_when_missing(self):
        warnings = []
        block    = _build_loss_figure("/nonexistent/path.png", "test001", warnings)
        self.assertNotIn(r"\includegraphics", block)
        self.assertTrue(len(warnings) > 0, "Expected a warning")

    # T23 — figure omitted when path is None
    def test_figure_omitted_when_none(self):
        warnings = []
        block    = _build_loss_figure(None, "test001", warnings)
        self.assertNotIn(r"\includegraphics", block)

    # T24 — forward slashes used in path (pdflatex requirement)
    def test_forward_slashes_in_path(self):
        plot = _write_fake_plot(self.tmp)
        block = _build_loss_figure(plot, "x", [])
        # The \includegraphics argument must not contain backslashes
        start = block.find(r"\includegraphics")
        end   = block.find("\n", start)
        line  = block[start:end]
        self.assertNotIn("\\\\", line.replace(r"\includegraphics", ""))


# ════════════════════════════════════════════════════════════════════════════
# Tests: DraftConfig validation
# ════════════════════════════════════════════════════════════════════════════

class TestDraftConfigValidation(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.rj  = _write_results_json(self.tmp)

    # T25 — valid config does not raise
    def test_valid_config_ok(self):
        cfg = _minimal_cfg(self.tmp, self.rj)
        cfg.validate()  # must not raise

    # T26 — empty results_json raises
    def test_empty_results_json_raises(self):
        cfg = DraftConfig(
            results_json="",
            template="ieee",
            title="Test",
            authors="Tester",
            out_dir=self.tmp,
        )
        with self.assertRaises(ValueError):
            cfg.validate()

    # T27 — missing results_json file raises FileNotFoundError
    def test_missing_file_raises(self):
        cfg = _minimal_cfg(self.tmp, "/no/such/file.json")
        with self.assertRaises(FileNotFoundError):
            cfg.validate()

    # T28 — unsupported template raises
    def test_bad_template_raises(self):
        cfg = _minimal_cfg(self.tmp, self.rj, template="word")
        with self.assertRaises(ValueError):
            cfg.validate()

    # T29 — empty out_dir raises
    def test_empty_out_dir_raises(self):
        cfg = _minimal_cfg(self.tmp, self.rj, out_dir="")
        with self.assertRaises(ValueError):
            cfg.validate()


# ════════════════════════════════════════════════════════════════════════════
# Tests: draft_paper — success paths
# ════════════════════════════════════════════════════════════════════════════

class TestDraftPaperSuccess(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # T30 — successful IEEE draft
    def test_ieee_draft_succeeds(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        self.assertIn(result.status, ("success", "success_with_warnings"),
                      f"Unexpected status: {result.status}\nErrors: {result.errors}")

    # T31 — .tex file is created
    def test_tex_file_created(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        self.assertIsNotNone(result.tex_path)
        self.assertTrue(os.path.exists(result.tex_path),
                        f"tex_path does not exist: {result.tex_path}")

    # T32 — .tex file is non-empty
    def test_tex_file_non_empty(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        size = os.path.getsize(result.tex_path)
        self.assertGreater(size, 0)

    # T33 — report JSON is created and parseable
    def test_report_json_created(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        self.assertIsNotNone(result.report_path)
        self.assertTrue(os.path.exists(result.report_path))
        with open(result.report_path) as f:
            report = json.load(f)
        self.assertIn("experiment_id", report)
        self.assertIn("template",      report)
        self.assertIn("status",        report)

    # T34 — .tex contains experiment_id
    def test_tex_contains_experiment_id(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        content = open(result.tex_path, encoding="utf-8").read()
        self.assertIn("test0001", content)

    # T35 — .tex contains metric values
    def test_tex_contains_metrics(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        content = open(result.tex_path, encoding="utf-8").read()
        self.assertIn("MSE",  content)
        self.assertIn("0.01", content)

    # T36 — NeurIPS draft succeeds (without .sty, with warning)
    def test_neurips_draft_succeeds(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(self.tmp, rj, template="neurips")
        result = draft_paper(cfg)
        self.assertIn(result.status, ("success", "success_with_warnings"))
        self.assertTrue(result.neurips_sty_missing,
                        "Expected neurips_sty_missing=True when .sty is absent")

    # T37 — NeurIPS .sty missing warning is present in warnings list
    def test_neurips_missing_sty_warning(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(self.tmp, rj, template="neurips")
        result = draft_paper(cfg)
        has_sty_warning = any(
            "neurips" in w.lower() and "sty" in w.lower()
            for w in result.warnings
        )
        self.assertTrue(has_sty_warning,
                        f"Expected sty warning in: {result.warnings}")


# ════════════════════════════════════════════════════════════════════════════
# Tests: draft_paper — loss plot behaviour
# ════════════════════════════════════════════════════════════════════════════

class TestLossFigureInDraft(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # T38 — figure included in .tex when plot file exists
    def test_figure_included_when_plot_exists(self):
        plot = _write_fake_plot(self.tmp)
        rj   = _write_results_json(
            self.tmp, {"artefacts": {"loss_plot": plot}}
        )
        cfg  = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        content = open(result.tex_path, encoding="utf-8").read()
        self.assertIn(r"\includegraphics", content)

    # T39 — figure omitted (with warning) when plot is missing
    def test_figure_omitted_when_plot_missing(self):
        rj  = _write_results_json(
            self.tmp,
            {"artefacts": {"loss_plot": "/no/such/plot.png"}}
        )
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        content = open(result.tex_path, encoding="utf-8").read()
        self.assertNotIn(r"\includegraphics", content)
        has_plot_warning = any("loss" in w.lower() for w in result.warnings)
        self.assertTrue(has_plot_warning)

    # T40 — figure omitted (no error) when loss_plot is null
    def test_figure_omitted_when_null_plot(self):
        rj  = _write_results_json(
            self.tmp, {"artefacts": {"loss_plot": None}}
        )
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        self.assertIn(result.status, ("success", "success_with_warnings"))


# ════════════════════════════════════════════════════════════════════════════
# Tests: draft_paper — failure paths
# ════════════════════════════════════════════════════════════════════════════

class TestDraftPaperFailures(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # T41 — missing results JSON file
    def test_missing_results_json(self):
        cfg = _minimal_cfg(self.tmp, "/does/not/exist.json")
        result = draft_paper(cfg)
        self.assertEqual(result.status, "failed")
        self.assertTrue(len(result.errors) > 0)

    # T42 — invalid JSON content
    def test_invalid_json_content(self):
        bad = os.path.join(self.tmp, "bad.json")
        with open(bad, "w") as f:
            f.write("this is not json {{{")
        cfg = _minimal_cfg(self.tmp, bad)
        result = draft_paper(cfg)
        self.assertEqual(result.status, "failed")

    # T43 — missing required key in results JSON
    def test_missing_required_key(self):
        rj = _write_results_json(self.tmp)
        data = json.loads(open(rj).read())
        del data["metrics"]
        with open(rj, "w") as f:
            json.dump(data, f)
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        self.assertEqual(result.status, "failed")

    # T44 — incomplete experiment status
    def test_incomplete_status(self):
        rj = _write_results_json(self.tmp, {"status": "failed"})
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        self.assertEqual(result.status, "failed")
        self.assertTrue(any("status" in e.lower() for e in result.errors))

    # T45 — in-progress status rejected
    def test_in_progress_status_rejected(self):
        rj = _write_results_json(self.tmp, {"status": "running"})
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        self.assertEqual(result.status, "failed")

    # T46 — unsupported template fails at config validation
    def test_bad_template_fails(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(self.tmp, rj, template="powerpoint")
        result = draft_paper(cfg)
        self.assertEqual(result.status, "failed")


# ════════════════════════════════════════════════════════════════════════════
# Tests: synthetic provenance labelling
# ════════════════════════════════════════════════════════════════════════════

class TestSyntheticProvenance(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # T47 — report marks synthetic data correctly
    def test_report_marks_synthetic(self):
        rj  = _write_results_json(
            self.tmp, {"dataset_provenance": "SYNTHETIC_test.csv"}
        )
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        with open(result.report_path) as f:
            report = json.load(f)
        self.assertTrue(report["is_synthetic"])

    # T48 — synthetic warning present in warnings list
    def test_synthetic_warning_issued(self):
        rj  = _write_results_json(
            self.tmp, {"dataset_provenance": "SYNTHETIC_test.csv"}
        )
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        has_synth_warning = any(
            "synthetic" in w.lower() for w in result.warnings
        )
        self.assertTrue(has_synth_warning,
                        f"Expected synthetic warning; got: {result.warnings}")

    # T49 — non-synthetic provenance does not trigger synthetic warning
    def test_real_provenance_no_synthetic_warning(self):
        rj  = _write_results_json(
            self.tmp, {"dataset_provenance": "iris.csv"}
        )
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        has_synth_warning = any(
            "synthetic" in w.lower() for w in result.warnings
        )
        self.assertFalse(has_synth_warning,
                         f"Did not expect synthetic warning; got: {result.warnings}")

    # T50 — .tex contains synthetic labelling text
    def test_tex_contains_synthetic_label(self):
        rj  = _write_results_json(
            self.tmp, {"dataset_provenance": "SYNTHETIC_test.csv"}
        )
        cfg = _minimal_cfg(self.tmp, rj)
        result = draft_paper(cfg)
        content = open(result.tex_path, encoding="utf-8").read()
        # The template contains \textbf{synthetic}
        self.assertIn("synthetic", content.lower())


# ════════════════════════════════════════════════════════════════════════════
# Tests: unresolved placeholder detection in generated .tex
# ════════════════════════════════════════════════════════════════════════════

class TestUnresolvedPlaceholders(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    # T51 — successful draft has no Jinja2-style unresolved {{ }} tokens
    def test_no_jinja2_tokens_remain(self):
        rj  = _write_results_json(self.tmp)
        cfg = _minimal_cfg(
            self.tmp, rj,
            title="My Paper",
            authors="Alice",
            abstract="Short abstract.",
        )
        result  = draft_paper(cfg)
        content = open(result.tex_path, encoding="utf-8").read()
        # After rendering, no {{ word }} should remain
        remaining = detect_unresolved_placeholders(content)
        self.assertEqual(
            remaining, [],
            f"Unresolved Jinja2 tokens found: {remaining}"
        )

    # T52 — report records unresolved placeholders when they exist
    def test_report_records_unresolved(self):
        # We test detect_unresolved_placeholders directly on synthetic content
        fake_tex = "Title: << title >>\nAuthors: << authors >>\nBody."
        found    = detect_unresolved_placeholders(fake_tex)
        self.assertGreaterEqual(len(found), 2)


# ════════════════════════════════════════════════════════════════════════════
# Runner
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    unittest.main(verbosity=2)
