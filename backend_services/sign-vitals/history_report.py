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

import logging

from execution_evaluator import LOW_CONFIDENCE_CUTOFF

DEFAULT_LIMIT = 30
MAX_LIMIT = 100

logger = logging.getLogger("sign_vitals")


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
    logger.info("[GLOSS][DB] attempt history loaded | rows=%d | limit=%d", len(rows), limit)

    signs = (
        supabase_client.table("gloss_signs").select("id, display_name").execute().data
    ) or []
    display_name_by_id = {s["id"]: s["display_name"] for s in signs}

    return [_history_entry(r, display_name_by_id) for r in rows]


def _is_not_recognised(row: dict) -> bool:
    """A webcam attempt below the confidence cut-off. New attempts are
    already stored with recognized_sign_id NULL; this also covers rows
    written before that rule, which still hold a low-confidence guess."""
    confidence = row["recognition_confidence"]
    return row["attempt_type"] == "webcam" and (
        row["recognized_sign_id"] is None
        or (confidence is not None and float(confidence) < LOW_CONFIDENCE_CUTOFF)
    )


def _history_entry(r: dict, display_name_by_id: dict) -> dict:
    not_recognised = _is_not_recognised(r)
    recognized = None if not_recognised else r["recognized_sign_id"]
    return {
        "attempt_id": r["id"],
        "target_sign_id": r["target_sign_id"],
        "target_display_name": display_name_by_id.get(r["target_sign_id"], r["target_sign_id"]),
        "recognized_sign_id": recognized,
        "recognized_display_name": display_name_by_id.get(recognized, recognized) if recognized else None,
        "is_correct_sign": recognized is not None and recognized == r["target_sign_id"],
        "not_recognised": not_recognised,
        "recognition_confidence": r["recognition_confidence"],
        "attempt_type": r["attempt_type"],
        # quality_tier / execution_score are only meaningful for a webcam
        # attempt whose recognised sign matched the target and went
        # through DTW — null otherwise, passed straight through as stored.
        "quality_tier": None if not_recognised else r["quality_tier"],
        "execution_score": None if not_recognised else r["execution_score"],
        "attempted_at": r["attempted_at"],
    }