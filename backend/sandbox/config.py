"""
config.py — Centralised settings for the ARES Sandbox Engine.
All values are read from environment variables / .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── E2B ──────────────────────────────────────────────────────────────────
    e2b_api_key: str = Field(..., description="E2B platform API key")
    e2b_template: str = Field("base", description="E2B sandbox template ID")
    sandbox_timeout_seconds: int = Field(300, description="Hard timeout per sandbox run (s)")

    # ── LLM Debugger ─────────────────────────────────────────────────────────
    # Gemini is primary (faster, free via AI Studio). Groq is fallback.
    gemini_api_key: str = Field("", description="Google Gemini API key (primary debugger)")
    gemini_model: str = Field("gemini-3.8-flash", description="Gemini model for self-healing")

    groq_api_key: str = Field("", description="Groq API key (fallback debugger)")
    debugger_model: str = Field("llama-3.3-70b-versatile", description="Groq model for self-healing fallback")

    max_heal_attempts: int = Field(3, description="Max retry attempts in self-healing loop")

    # ── Storage ───────────────────────────────────────────────────────────────
    sqlite_db_path: str = Field("./data/research_memory.db", description="SQLite DB file path")

    # ── Server ────────────────────────────────────────────────────────────────
    host: str = Field("0.0.0.0")
    port: int = Field(8001)
    log_level: str = Field("info")


# Singleton — import this everywhere
settings = Settings()
