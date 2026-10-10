"""
contract_loader.py — Loads the 3-file contract from disk.

The sandbox engine always needs fresh string copies of the contract files
to upload into each E2B VM. This module is the single read point —
if Module 4 (ML Baseline) later replaces the contract files, everything
picks up the changes automatically.
"""

from pathlib import Path

# Contracts live next to this file under ./contracts/
_CONTRACTS_DIR = Path(__file__).parent / "contracts"


def load_prepare() -> str:
    """Return the content of the locked prepare.py evaluation contract."""
    return (_CONTRACTS_DIR / "prepare.py").read_text(encoding="utf-8")


def load_train(override: str | None = None) -> str:
    """
    Return train.py content.

    Args:
        override: If provided (e.g. a Coding Agent patch), return that
                  string directly instead of the file on disk.
    """
    if override is not None:
        return override
    return (_CONTRACTS_DIR / "train.py").read_text(encoding="utf-8")


def load_program_md() -> str:
    """Return the content of program.md experiment specification."""
    return (_CONTRACTS_DIR / "program.md").read_text(encoding="utf-8")


def load_all(train_override: str | None = None) -> tuple[str, str, str]:
    """
    Convenience function — returns (prepare_code, train_code, program_md).

    Usage:
        prepare, train, program = contract_loader.load_all(train_override=patch)
    """
    return load_prepare(), load_train(train_override), load_program_md()
