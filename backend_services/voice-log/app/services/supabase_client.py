"""Supabase service-role client — all SCRIBE writes go through here."""

from __future__ import annotations

import logging
import threading
from typing import Any

import httpx
from fastapi import HTTPException
from supabase import Client, ClientOptions, create_client

from app import config

logger = logging.getLogger(__name__)

_client: Client | None = None
_client_lock = threading.Lock()

# Sync httpx.Client is not safe for concurrent use across threads without a lock.
_execute_lock = threading.Lock()


def _close_client(client: Client | None) -> None:
    if client is None:
        return
    for attr in ("postgrest", "storage", "functions"):
        part = getattr(client, attr, None)
        session = getattr(part, "session", None)
        if session is not None and hasattr(session, "close"):
            try:
                session.close()
            except Exception:
                logger.debug("Failed to close Supabase %s session", attr, exc_info=True)


def _create_client() -> Client:
    try:
        url = config.SUPABASE_URL()
        key = config.SUPABASE_SERVICE_ROLE_KEY()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"{exc} Set SUPABASE_SERVICE_ROLE_KEY in backend_services/voice-log/.env "
                "and restart the API (run.ps1)."
            ),
        ) from exc

    # HTTP/1.1 avoids intermittent HTTP/2 "Server disconnected" errors with Supabase.
    httpx_client = httpx.Client(
        http2=False,
        timeout=httpx.Timeout(30.0, connect=10.0),
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=30.0),
    )
    options = ClientOptions(httpx_client=httpx_client)
    return create_client(url, key, options=options)


def reset_supabase_client() -> None:
    """Drop the cached client so the next request opens fresh connections."""
    global _client
    with _client_lock:
        _close_client(_client)
        _client = None


def get_supabase() -> Client:
    global _client
    with _client_lock:
        if _client is None:
            _client = _create_client()
        return _client


def supabase_execute_lock() -> threading.Lock:
    """Serialize Supabase HTTP calls (sync httpx client is not thread-safe)."""
    return _execute_lock


def shutdown_supabase_client() -> None:
    reset_supabase_client()
