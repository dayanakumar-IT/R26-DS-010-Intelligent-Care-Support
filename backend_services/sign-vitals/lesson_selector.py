"""
lesson_selector.py
GLOSS component — adaptive lesson selection (Phase 6, Option C:
weighted-random).

select_next_lesson(supabase_client, caregiver_profile_id) -> sign_id

Two branches, checked in this order:

BRANCH 1 — true cold start: this caregiver has ZERO
gloss_caregiver_mastery rows at all (their very first-ever lesson).
Deterministic, NOT weighted-random — a brand new caregiver's first
lesson should be the gentlest onboarding, not randomized:
  1. Look at gloss_sign_difficulty for signs with
     total_attempts >= COLD_START_MIN_ATTEMPTS (a minimum sample size
     for "meaningful" difficulty data).
  2. If any such signs exist, pick the one with the lowest
     error_rate_percent (easiest-first).
  3. Otherwise (true today — no real usage data exists yet), fall
     back to the alphabetically-first active sign_id in gloss_signs.

BRANCH 2 — caregiver already has at least one mastery row (not their
first-ever lesson, even if it's their first for this particular
sign): genuine weighted-random selection over all active signs,
weighted by mastery_status per STATUS_WEIGHTS below (default 'new'
for any active sign with no mastery row — this also covers a row
that exists with attempts=0, since that row's stored mastery_status
is itself 'new' by the same rule used everywhere else in the app).

Independent of any HTTP endpoint — plain function, to be wired into
GET /gloss/next-lesson/{caregiver_id} in Phase 9, not here.
"""

import logging
import random

logger = logging.getLogger("sign_vitals")

# BRANCH 1 threshold: minimum total_attempts for a sign's
# error_rate_percent to be considered "meaningful" difficulty data.
COLD_START_MIN_ATTEMPTS = 5

# BRANCH 2 weight table: higher weight = more likely to be selected.
# 'mastered' is intentionally non-zero — occasional review is
# deliberate, not a bug.
STATUS_WEIGHTS = {
    "needs_revision": 5,
    "weak": 4,
    "new": 3,
    "learning": 3,
    "improving": 1.5,
    "mastered": 0.3,
}


def _has_any_mastery_rows(supabase_client, caregiver_profile_id: str) -> bool:
    result = (
        supabase_client.table("gloss_caregiver_mastery")
        .select("id")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def _select_cold_start(supabase_client) -> str:
    difficulty = (
        supabase_client.table("gloss_sign_difficulty")
        .select("sign_id, total_attempts, error_rate_percent")
        .gte("total_attempts", COLD_START_MIN_ATTEMPTS)
        .execute()
    )
    candidates = difficulty.data or []
    if candidates:
        candidates.sort(key=lambda row: row["error_rate_percent"])
        return candidates[0]["sign_id"]

    active_signs = (
        supabase_client.table("gloss_signs")
        .select("id")
        .eq("is_active", True)
        .order("id")
        .limit(1)
        .execute()
    )
    if not active_signs.data:
        raise ValueError("No active signs found in gloss_signs — cannot select a lesson")
    return active_signs.data[0]["id"]


def _select_weighted_random(supabase_client, caregiver_profile_id: str) -> str:
    active_signs = supabase_client.table("gloss_signs").select("id").eq("is_active", True).execute()
    sign_ids = [row["id"] for row in active_signs.data]
    if not sign_ids:
        raise ValueError("No active signs found in gloss_signs — cannot select a lesson")

    mastery_rows = (
        supabase_client.table("gloss_caregiver_mastery")
        .select("sign_id, mastery_status")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .execute()
    )
    status_by_sign = {row["sign_id"]: row["mastery_status"] for row in mastery_rows.data}
    logger.info(
        "[GLOSS][DB] mastery records loaded | rows=%d (weighted-random selection)",
        len(mastery_rows.data or []),
    )

    weights = [STATUS_WEIGHTS[status_by_sign.get(sign_id, "new")] for sign_id in sign_ids]

    return random.choices(sign_ids, weights=weights, k=1)[0]


def select_next_lesson(supabase_client, caregiver_profile_id: str) -> str:
    """Returns a single sign_id — the next lesson to give this caregiver."""
    if _has_any_mastery_rows(supabase_client, caregiver_profile_id):
        return _select_weighted_random(supabase_client, caregiver_profile_id)
    logger.info("[GLOSS][RECOMMENDATION] cold start | no mastery history — using easiest-first")
    return _select_cold_start(supabase_client)
