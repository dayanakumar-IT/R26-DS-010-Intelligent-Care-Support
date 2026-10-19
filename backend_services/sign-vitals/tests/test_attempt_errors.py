"""
tests/test_attempt_errors.py
Regression test for "Attempt submission failed" on Recall (no network, no
model):

  - the cause: supabase-py's default HTTP/2 connection is not safe when the
    attempt path reads Supabase from several threads at once; the backend
    client (db_client.make_client) must use an HTTP/1.1 pool;
  - when a database call still fails, the learner gets a helpful message
    (503, "couldn't reach the progress database ... try again", with a
    reference that is also in the server log) instead of a bare
    "Attempt submission failed"; any other error gives a 500 with the same
    kind of message.

Run with .venv's python:
    python tests/test_attempt_errors.py
"""

import io
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import auth_helper  # noqa: E402
import db_client  # noqa: E402
import main  # noqa: E402
import progress_store  # noqa: E402
from fake_supabase_rpc import FakeSupabase  # noqa: E402

CG = "10000000-0000-0000-0000-00000000000a"


def check_http1_client():
    seen = {}

    def fake_create(url, key, options):
        seen["options"] = options
        return SimpleNamespace()

    real = db_client.create_client
    db_client.create_client = fake_create
    try:
        db_client.make_client("https://example.supabase.co", "key")
    finally:
        db_client.create_client = real
    client = seen["options"].httpx_client
    assert isinstance(client, httpx.Client), "no explicit httpx client"
    assert getattr(client._transport._pool, "_http2", True) is False, "backend client still uses HTTP/2"
    print("  ok  the backend Supabase client uses an HTTP/1.1 pool (thread-safe)")


class _Failing(FakeSupabase):
    """Fails like the shared HTTP/2 connection did, on the catalogue read."""

    def __init__(self, error, **kw):
        super().__init__(**kw)
        self.error = error

    def table(self, name):
        if name == "gloss_signs":
            raise self.error
        return super().table(name)


def post_recall(db):
    db.auth = SimpleNamespace(get_user=lambda tok: SimpleNamespace(user=SimpleNamespace(id="u-care")))
    main.state.update(supabase=db, model=None, class_names=[], class_thresholds={})
    auth_helper._auth_cache.clear()
    progress_store._signs.update(ids=None, at=0.0)
    progress_store._ready.update(value=None, checked=0.0)
    return TestClient(main.app).post(
        "/gloss/attempts",
        data={"target_sign_id": "water", "attempt_type": "webcam", "mode": "recall"},
        files={"video": ("attempt.webm", io.BytesIO(b"not a real video"), "video/webm")},
        headers={"Authorization": "Bearer tok"},
    )


def check_messages():
    tables = {"gloss_caregiver_accounts": [{"user_id": "u-care", "caregiver_profile_id": CG}], "gloss_milestones": []}
    r = post_recall(_Failing(httpx.RemoteProtocolError("Server disconnected"), tables=tables))
    assert r.status_code == 503, (r.status_code, r.text)
    detail = r.json()["detail"]
    assert "couldn't reach the progress database" in detail and "try again" in detail and "(ref " in detail, detail
    assert "Attempt submission failed" not in detail
    print(f"  ok  connection failure -> 503: {detail}")

    r = post_recall(_Failing(RuntimeError("boom"), tables=tables))
    assert r.status_code == 500 and "tell your supervisor" in r.json()["detail"], r.text
    print("  ok  any other failure -> 500 with a helpful message and a reference")


if __name__ == "__main__":
    check_http1_client()
    check_messages()
    print("ATTEMPT ERRORS TEST PASSED")
