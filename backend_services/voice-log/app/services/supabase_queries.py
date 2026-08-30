"""Safe helpers for Supabase/PostgREST query responses.

postgrest returns None from execute() for maybe_single() when zero rows match
(PGRST116), so never access .data on the raw result without a guard.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any

import httpx
from supabase import Client

from app.services.supabase_client import get_supabase, reset_supabase_client, supabase_execute_lock

logger = logging.getLogger(__name__)

_TRANSIENT_HTTP_ERRORS = (
    httpx.RemoteProtocolError,
    httpx.ConnectError,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    httpx.NetworkError,
)

TRANSIENT_SUPABASE_HTTP_ERRORS = _TRANSIENT_HTTP_ERRORS

_MAX_ATTEMPTS = 3


def supabase_execute(build: Callable[[Client], Any]) -> Any:
    """Run a PostgREST query with thread-safe access and transient-error retries."""
    last_error: Exception | None = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            with supabase_execute_lock():
                client = get_supabase()
                return build(client).execute()
        except _TRANSIENT_HTTP_ERRORS as exc:
            last_error = exc
            logger.warning(
                "Supabase transient HTTP error (attempt %s/%s): %s",
                attempt,
                _MAX_ATTEMPTS,
                exc,
            )
            reset_supabase_client()
            if attempt < _MAX_ATTEMPTS:
                time.sleep(0.15 * attempt)

    assert last_error is not None
    raise last_error


def response_rows(result: Any) -> list[dict]:
    if result is None:
        return []
    data = getattr(result, "data", None)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    return [data]


def response_first_row(result: Any) -> dict | None:
    rows = response_rows(result)
    return rows[0] if rows else None
