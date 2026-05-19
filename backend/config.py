"""Centralized configuration via environment variables."""
from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    OPENAI_API_KEY: str = ""
    TAVILY_API_KEY: str = ""

    # LLM provider (OpenAI-compatible). For OpenRouter:
    #   OPENAI_BASE_URL=https://openrouter.ai/api/v1
    #   OPENAI_API_KEY=sk-or-...
    #   OPENAI_CHAT_MODEL=openai/gpt-4o-mini   (or any OpenRouter model id)
    OPENAI_BASE_URL: str = ""

    # Embedding provider. "openai" uses the OpenAI-compatible client above
    # (works with OpenAI, NOT with OpenRouter — OpenRouter has no embeddings).
    # "local" uses sentence-transformers (free, CPU, 384 dims).
    EMBEDDING_PROVIDER: str = "openai"  # "openai" | "local"
    LOCAL_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    RETRIEVAL_TOP_K: int = 5

    DATA_DIR: str = "data"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def data_path(self) -> Path:
        p = Path(self.DATA_DIR)
        p.mkdir(parents=True, exist_ok=True)
        (p / "pdfs").mkdir(parents=True, exist_ok=True)
        return p

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()