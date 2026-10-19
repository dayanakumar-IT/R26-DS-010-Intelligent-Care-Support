"""
history_report.py
GLOSS component — caregiver attempt history (read-only).

Returns the authenticated caregiver's attempts, newest first, for the
practice history list on the Progress tab: a page at a time (before = the
attempted_at of the last row already shown) and optionally one day only
(start / end, ISO times — the app sends the local day's bounds). Pure read model: no writes, no ML. Never returns raw
landmark arrays, video, credentials, or auth data — only the
already-computed per-attempt summary fields.

Independent of FastAPI — takes a supabase client + caregiver_profile_id
and returns a plain list, so it is unit-testable.
"""

from progress_store import schema_ready
from sign_config import PIPELINE_VERSION
import logging

from execution_evaluator import LOW_CONFIDENCE_CUTOFF

DEFAULT_LIMIT = 30
MAX_LIMIT = 100

logger = logging.getLogger("sign_vitals")


def build_history(supabase_client, caregiver_profile_id: str, limit: int = DEFAULT_LIMIT) -> list[dict]:
    return build_history_page(supabase_client, caregiver_profile_id, limit)["attempts"]


def build_history_page(supabase_client, caregiver_profile_id: str, limit: int = DEFAULT_LIMIT,
                       before: str | None = None, start: str | None = None, end: str | None = None) -> dict:
    """{"attempts": [...newest first], "has_more": bool}."""
    limit = max(1, min(int(limit), MAX_LIMIT))
    # mode / pipeline_version exist once migration 0045 is applied.
    extra = ", mode, pipeline_version" if schema_ready(supabase_client) else ""

    query = (
        supabase_client.table("gloss_attempts")
        .select(
            "id, target_sign_id, recognized_sign_id, recognition_confidence, "
            "execution_score, quality_tier, attempt_type, attempted_at, session_id" + extra
        )
        .eq("caregiver_profile_id", caregiver_profile_id)
    )
    if before:
        query = query.lt("attempted_at", before)
    if start:
        query = query.gte("attempted_at", start)
    if end:
        query = query.lt("attempted_at", end)
    # One extra row tells whether there is another page.
    rows = query.order("attempted_at", desc=True).limit(limit + 1).execute().data or []
    has_more = len(rows) > limit
    rows = rows[:limit]
    logger.info("[GLOSS][DB] attempt history loaded | rows=%d | limit=%d", len(rows), limit)

    signs = (
        supabase_client.table("gloss_signs").select("id, display_name").execute().data
    ) or []
    display_name_by_id = {s["id"]: s["display_name"] for s in signs}

    return {"attempts": [_history_entry(r, display_name_by_id) for r in rows], "has_more": has_more}


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
        # The sitting this attempt belongs to: the app groups one quiz
        # session's answers into a single history row.
        "session_id": r.get("session_id"),
        # practice | recall | free (Check my sign: no target, never counted).
        "mode": r.get("mode") or "practice",
        # Made with an earlier grading pipeline: counts as practice only.
        "earlier_version": r.get("pipeline_version", PIPELINE_VERSION) != PIPELINE_VERSION,
    }