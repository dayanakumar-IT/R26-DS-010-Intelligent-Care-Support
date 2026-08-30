"""
auth_helper.py
GLOSS component — derives an authenticated caregiver's identity from a
Supabase Auth bearer token. caregiver_profile_id is NEVER accepted as
a client-supplied request field — it is always derived here, from a
verified login.

Independent of any HTTP endpoint — plain function, reusable by any
future endpoint needing the same identity check.
"""


class AuthError(Exception):
    """Raised for any auth failure. status_code is 401 (missing/invalid
    token) or 403 (valid login, but not linked to a GLOSS caregiver
    identity) — the caller maps this directly to an HTTPException."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def get_authenticated_caregiver(supabase_client, authorization_header: str | None) -> str:
    """
    authorization_header: the raw value of the request's Authorization
      header (or None if absent).

    1. Expects "Bearer <token>" — missing/malformed -> AuthError(401).
    2. Verifies the token via supabase.auth.get_user(token) (asks
       Supabase to verify it — the JWT is never decoded locally) —
       invalid/expired -> AuthError(401).
    3. Looks up gloss_caregiver_accounts for that verified user id
       (profiles.id, since profiles.id references auth.users(id)
       directly) — no matching row -> AuthError(403).

    Returns: caregiver_profile_id (str) — server-derived.
    """
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise AuthError(401, "Missing or malformed Authorization header")

    token = authorization_header[len("Bearer "):].strip()
    if not token:
        raise AuthError(401, "Missing bearer token")

    try:
        user_response = supabase_client.auth.get_user(token)
    except Exception:
        raise AuthError(401, "Invalid or expired token")

    user = getattr(user_response, "user", None)
    if user is None or not getattr(user, "id", None):
        raise AuthError(401, "Invalid or expired token")

    result = (
        supabase_client.table("gloss_caregiver_accounts")
        .select("caregiver_profile_id")
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise AuthError(403, "This login is not linked to a GLOSS caregiver identity")

    return result.data[0]["caregiver_profile_id"]
