"""
auth_helper.py
GLOSS component — derives an authenticated learner's identity from a
Supabase Auth bearer token. caregiver_profile_id (the learner id) is NEVER
accepted as a client-supplied request field — it is always derived here,
from a verified login. A learner is a caregiver (gloss_caregiver_accounts)
or, from migration 0049, a supervisor with a learner row (gloss_learners).
Supervisor-only endpoints use get_authenticated_supervisor(), which checks
profiles.role on the server.

Independent of any HTTP endpoint — plain function, reusable by any
future endpoint needing the same identity check.
"""

import hashlib
import logging
import threading
import time
from typing import NoReturn

logger = logging.getLogger("sign_vitals")

# A verified token -> caregiver mapping is reused for a short time, saving the
# two Supabase round trips (token check + account lookup) on every request.
# Keyed by a hash of the token (the token itself is never stored); only
# successful lookups are cached, so a rejected token is always re-checked.
AUTH_CACHE_SECONDS = 120
_auth_cache: dict[str, tuple[object, float]] = {}
_auth_lock = threading.Lock()


def _cached(key: str):
    with _auth_lock:
        hit = _auth_cache.get(key)
        if hit and time.monotonic() - hit[1] < AUTH_CACHE_SECONDS:
            return hit[0]
    return None


def _remember(key: str, value) -> None:
    with _auth_lock:
        now = time.monotonic()
        for k in [k for k, v in _auth_cache.items() if now - v[1] >= AUTH_CACHE_SECONDS]:
            _auth_cache.pop(k, None)
        _auth_cache[key] = (value, now)


class AuthError(Exception):
    """Raised for any auth failure. status_code is 401 (missing/invalid
    token) or 403 (valid login, but not linked to a GLOSS caregiver
    identity) — the caller maps this directly to an HTTPException."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _reject(context: str, status_code: int, detail: str) -> NoReturn:
    logger.warning("[%s][AUTH][WARNING] rejected | status=%d | reason=%s", context, status_code, detail)
    raise AuthError(status_code, detail)


def _verified_user_id(supabase_client, authorization_header: str | None, context: str) -> tuple[str, str]:
    """(user id, token hash) for a valid "Bearer <token>"; AuthError(401)
    otherwise. The token is verified by Supabase (never decoded locally)."""
    if not authorization_header or not authorization_header.startswith("Bearer "):
        _reject(context, 401, "Missing or malformed Authorization header")
    token = authorization_header[len("Bearer "):].strip()
    if not token:
        _reject(context, 401, "Missing bearer token")
    key = hashlib.sha256(token.encode()).hexdigest()
    user_id = _cached(f"user:{key}")
    if user_id:
        return user_id, key
    try:
        user_response = supabase_client.auth.get_user(token)
    except Exception:
        _reject(context, 401, "Invalid or expired token")
    user = getattr(user_response, "user", None)
    if user is None or not getattr(user, "id", None):
        _reject(context, 401, "Invalid or expired token")
    _remember(f"user:{key}", str(user.id))
    return str(user.id), key


def _learner_id_for_user(supabase_client, user_id: str, *, create_for_supervisor: bool = False) -> str | None:
    """A caregiver's caregiver_profile_id, else a supervisor's learner id
    (gloss_learners, migration 0049; None if that table is not there yet).
    create_for_supervisor: a supervisor without a learner row gets one now
    (name from profiles.name; role checked here, on the server), so every
    learning screen works for them on first use."""
    rows = (supabase_client.table("gloss_caregiver_accounts").select("caregiver_profile_id")
            .eq("user_id", user_id).limit(1).execute().data)
    if rows:
        return rows[0]["caregiver_profile_id"]
    try:
        rows = (supabase_client.table("gloss_learners").select("id")
                .eq("user_id", user_id).eq("kind", "supervisor").limit(1).execute().data)
    except Exception:
        return None
    if rows:
        return rows[0]["id"]
    if not create_for_supervisor:
        return None
    profile = _profile(supabase_client, user_id)
    if profile.get("role") != "supervisor":
        return None
    try:
        created = (supabase_client.table("gloss_learners")
                   .insert({"kind": "supervisor", "user_id": user_id, "display_name": profile.get("name") or "Supervisor"})
                   .execute().data)
    except Exception:
        # Created by a parallel request (user_id is unique): read it back.
        created = (supabase_client.table("gloss_learners").select("id")
                   .eq("user_id", user_id).eq("kind", "supervisor").limit(1).execute().data)
    if created:
        logger.info("[GLOSS][AUTH] supervisor learner profile created | learner=%s", str(created[0]["id"])[:8])
    return created[0]["id"] if created else None


def get_authenticated_caregiver(
    supabase_client, authorization_header: str | None, *, context: str = "GLOSS"
) -> str:
    """
    The caller's learner id (caregiver_profile_id column value) from a
    verified login: 401 for a missing / invalid token, 403 for a login that
    is neither a caregiver account nor a supervisor (a supervisor's learner
    row is created on first use). Only successful lookups are cached
    (AUTH_CACHE_SECONDS).

    Logging never includes the token, the header or the Supabase user id —
    only a short prefix of the learner id, and the reason on rejection.
    """
    user_id, key = _verified_user_id(supabase_client, authorization_header, context)
    learner_id = _cached(f"learner:{key}")
    if learner_id:
        return learner_id
    learner_id = _learner_id_for_user(supabase_client, user_id, create_for_supervisor=True)
    if not learner_id:
        _reject(context, 403, "This login is not linked to a GLOSS caregiver identity")
    _remember(f"learner:{key}", learner_id)
    logger.info("[%s][AUTH] authenticated | learner=%s", context, str(learner_id)[:8])
    return learner_id


def _profile(supabase_client, user_id: str) -> dict:
    rows = (supabase_client.table("profiles").select("id, name, role")
            .eq("id", user_id).limit(1).execute().data)
    return rows[0] if rows else {}


def get_authenticated_supervisor(
    supabase_client, authorization_header: str | None, *, context: str = "GLOSS"
) -> dict:
    """{"user_id", "name"} for a verified login whose profiles.role is
    'supervisor' (checked on the server, never trusted from the client);
    401 / 403 otherwise."""
    user_id, key = _verified_user_id(supabase_client, authorization_header, context)
    profile = _cached(f"supervisor:{key}")
    if not profile:
        profile = _profile(supabase_client, user_id)
        if profile.get("role") != "supervisor":
            _reject(context, 403, "Supervisors only")
        _remember(f"supervisor:{key}", profile)
    return {"user_id": user_id, "name": profile.get("name") or "Supervisor"}


def get_authenticated_identity(
    supabase_client, authorization_header: str | None, *, context: str = "GLOSS"
) -> dict:
    """{"user_id", "role", "name", "learner_id" | None} for any verified login
    (drives which Sign & Vitals screens the app shows)."""
    user_id, _ = _verified_user_id(supabase_client, authorization_header, context)
    profile = _profile(supabase_client, user_id)
    return {"user_id": user_id, "role": profile.get("role"), "name": profile.get("name"),
            "learner_id": _learner_id_for_user(supabase_client, user_id)}


def forget_learner(authorization_header: str | None) -> None:
    """Drop the cached learner lookup for this token (after creating a learner row)."""
    if authorization_header and authorization_header.startswith("Bearer "):
        key = hashlib.sha256(authorization_header[len("Bearer "):].strip().encode()).hexdigest()
        with _auth_lock:
            _auth_cache.pop(f"learner:{key}", None)
