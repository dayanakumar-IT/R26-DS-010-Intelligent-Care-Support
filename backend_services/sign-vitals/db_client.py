"""
db_client.py
Sign & Vitals — the Supabase client used by the backend.

Uses an HTTP/1.1 connection pool instead of supabase-py's default HTTP/2
connection. The attempt path reads Supabase from several threads at once
(progress_store.POOL); one HTTP/2 connection shared between threads fails at
random ("Server disconnected", "Invalid input StreamInputs.SEND_HEADERS"),
which surfaced as "Attempt submission failed". HTTP/1.1 pools are
thread-safe (200 parallel queries: 14 errors with HTTP/2, 0 with HTTP/1.1).
"""

import httpx
from supabase import ClientOptions, create_client


def make_client(url: str, key: str):
    return create_client(url, key, ClientOptions(
        httpx_client=httpx.Client(http2=False, timeout=httpx.Timeout(120.0), limits=httpx.Limits(max_connections=20)),
    ))
