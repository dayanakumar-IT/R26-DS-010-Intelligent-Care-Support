"""
history_report.py
GLOSS component — caregiver attempt history (read-only).

Returns the authenticated caregiver's most recent attempts for the
History tab. Pure read model: no writes, no ML. Never returns raw
landmark arrays, video, credentials, or auth data — only the
already-computed per-attempt summary fields.

Independent of FastAPI — takes a supabase client + caregiver_profile_id
and returns a plain list, so it is unit-testable.
"""

DEFAULT_LIMIT = 30
MAX_LIMIT = 100


def build_history(supabase_client, caregiver_profile_id: str, limit: int = DEFAULT_LIMIT) -> list[dict]:
    limit = max(1, min(int(limit), MAX_LIMIT))

    rows = (
        supabase_client.table("gloss_attempts")
        .select(
            "id, target_sign_id, recognized_sign_id, recognition_confidence, "
            "execution_score, quality_tier, attempt_type, attempted_at"
        )
        .eq("caregiver_profile_id", caregiver_profile_id)
        .order("attempted_at", desc=True)
        .limit(limit)
        .execute()
        .data
    ) or []

    signs = (
        supabase_client.table("gloss_signs").select("id, display_name").execute().data
    ) or []
    display_name_by_id = {s["id"]: s["display_name"] for s in signs}

    return [
        {
            "attempt_id": r["id"],
            "target_sign_id": r["target_sign_id"],
            "target_display_name": display_name_by_id.get(r["target_sign_id"], r["target_sign_id"]),
            "recognized_sign_id": r["recognized_sign_id"],
            "recognized_display_name": (
                display_name_by_id.get(r["recognized_sign_id"], r["recognized_sign_id"])
                if r["recognized_sign_id"]
                else None
            ),
            "is_correct_sign": r["recognized_sign_id"] == r["target_sign_id"],
            "recognition_confidence": r["recognition_confidence"],
            "attempt_type": r["attempt_type"],
            # quality_tier / execution_score are only meaningful for a webcam
            # attempt whose recognised sign matched the target and went
            # through DTW — null otherwise, passed straight through as stored.
            "quality_tier": r["quality_tier"],
            "execution_score": r["execution_score"],
            "attempted_at": r["attempted_at"],
        }
        for r in rows
    ]