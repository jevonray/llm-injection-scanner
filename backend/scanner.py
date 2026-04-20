"""
scanner.py — Payload Firing Engine
Handles sending payloads to target LLM endpoints.
Add new provider adapters here — orchestrator and judge stay untouched.
"""

import time
import httpx
from typing import Optional
from enum import Enum


class Provider(str, Enum):
    OPENAI    = "openai"     # OpenAI + any OpenAI-compatible endpoint
    ANTHROPIC = "anthropic"  # Anthropic Claude endpoints
    OLLAMA    = "ollama"     # Local Ollama (http://localhost:11434)


def detect_provider(target_url: str, provider_hint: Optional[str] = None) -> Provider:
    """
    Auto-detect provider from URL if no hint is given.
    Override by passing provider_hint explicitly.
    """
    if provider_hint:
        return Provider(provider_hint.lower())

    url = target_url.lower()
    if "anthropic.com" in url:
        return Provider.ANTHROPIC
    if "localhost:11434" in url or "ollama" in url:
        return Provider.OLLAMA
    return Provider.OPENAI  # Default — covers OpenAI + Azure + most compatible APIs


async def fire_payload(
    target_url: str,
    api_key: str,
    model_name: str,
    payload_text: str,
    system_prompt: Optional[str] = None,
    provider_hint: Optional[str] = None,
) -> tuple[str, int]:
    """
    Sends a single payload to the target LLM.
    Auto-detects provider or accepts an explicit override.

    Returns:
        (raw_response_text, latency_ms)
    """
    provider = detect_provider(target_url, provider_hint)

    if provider == Provider.ANTHROPIC:
        return await _fire_anthropic(target_url, api_key, model_name, payload_text, system_prompt)
    elif provider == Provider.OLLAMA:
        return await _fire_ollama(target_url, model_name, payload_text, system_prompt)
    else:
        return await _fire_openai(target_url, api_key, model_name, payload_text, system_prompt)


# ── Provider adapters ──────────────────────────────────────────────────────────

async def _fire_openai(
    target_url: str,
    api_key: str,
    model_name: str,
    payload_text: str,
    system_prompt: Optional[str],
) -> tuple[str, int]:
    """OpenAI-compatible: /v1/chat/completions format."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": payload_text})

    body = {
        "model": model_name,
        "messages": messages,
        "max_tokens": 512,
        "temperature": 0,
    }

    start = time.time()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            target_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        response.raise_for_status()

    latency_ms = int((time.time() - start) * 1000)
    return response.json()["choices"][0]["message"]["content"], latency_ms


async def _fire_anthropic(
    target_url: str,
    api_key: str,
    model_name: str,
    payload_text: str,
    system_prompt: Optional[str],
) -> tuple[str, int]:
    """Anthropic Claude: /v1/messages format."""
    body = {
        "model": model_name,
        "max_tokens": 512,
        "messages": [{"role": "user", "content": payload_text}],
    }
    if system_prompt:
        body["system"] = system_prompt

    start = time.time()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            target_url,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json=body,
        )
        response.raise_for_status()

    latency_ms = int((time.time() - start) * 1000)
    return response.json()["content"][0]["text"], latency_ms


async def _fire_ollama(
    target_url: str,
    model_name: str,
    payload_text: str,
    system_prompt: Optional[str],
) -> tuple[str, int]:
    """
    Ollama local models — OpenAI-compatible endpoint.
    No API key required. Default: http://localhost:11434/v1/chat/completions
    """
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": payload_text})

    body = {
        "model": model_name,
        "messages": messages,
        "stream": False,
    }

    start = time.time()
    async with httpx.AsyncClient(timeout=60) as client:  # Longer timeout for local models
        response = await client.post(
            target_url,
            headers={"Content-Type": "application/json"},
            json=body,
        )
        response.raise_for_status()

    latency_ms = int((time.time() - start) * 1000)
    return response.json()["choices"][0]["message"]["content"], latency_ms
