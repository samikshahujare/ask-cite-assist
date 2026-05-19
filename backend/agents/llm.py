"""Thin OpenAI wrapper used by every agent. Centralizing this means we can
swap providers (or proxy through Lovable AI Gateway) by changing one file."""
from __future__ import annotations

import json
from typing import Type, TypeVar

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from config import settings

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. Copy backend/.env.example to backend/.env and fill it in. "
                "For OpenRouter, set OPENAI_API_KEY=sk-or-... and OPENAI_BASE_URL=https://openrouter.ai/api/v1"
            )
        kwargs = {"api_key": settings.OPENAI_API_KEY}
        if settings.OPENAI_BASE_URL:
            kwargs["base_url"] = settings.OPENAI_BASE_URL
        _client = OpenAI(**kwargs)
    return _client


T = TypeVar("T", bound=BaseModel)


def chat_json(system: str, user: str, schema: Type[T], model: str | None = None, temperature: float = 0.2) -> T:
    """Call the LLM with JSON-mode and validate against a Pydantic schema."""
    client = get_client()
    resp = client.chat.completions.create(
        model=model or settings.OPENAI_CHAT_MODEL,
        temperature=temperature,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        return schema.model_validate_json(raw)
    except ValidationError:
        # Best-effort: try to coerce loose JSON
        data = json.loads(raw)
        return schema.model_validate(data)


def chat_text(system: str, user: str, model: str | None = None, temperature: float = 0.3) -> str:
    client = get_client()
    resp = client.chat.completions.create(
        model=model or settings.OPENAI_CHAT_MODEL,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return resp.choices[0].message.content or ""