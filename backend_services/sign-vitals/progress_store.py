"""
progress_store.py
GLOSS component — stores an attempt together with what it earns.

record_attempt() computes the milestones the new attempt earns
(progress_rules.milestones_for_new_attempt, from a small context: existing
milestones, this sign's attempts, first camera attempt per sign, this
month's active days — equal to a full replay, see the equivalence test) and
writes attempt + mastery row + new milestones in ONE transaction through the
gloss_record_attempt database function (migration 0046).

schema_ready() tells whether migrations 0045-0047 are applied. Until they
are, attempt_submission keeps the original practice write path so the app
keeps working, and the new modes answer 503.

Speed: the reads an attempt needs (session, mastery row, the small
milestone context, all mastery rows for the next lesson) are started on
POOL as soon as the request arrives, so they run while MediaPipe works;
the sign catalogue and time zones are cached; the next lesson is ranked in
memory; milestones are computed incrementally (progress_rules.
milestones_for_new_attempt), not by replaying the whole history.
"""

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo

import sign_config as cfg
from lesson_selector import rank_lessons
from progress_rules import COUNTED_MODES, NEW, milestones_for_new_attempt
from progress_summary import LEVEL_NAME, load_timezone

MIGRATIONS_NEEDED = "This feature needs the GLOSS database migrations 0045-0047 to be applied first."
POOL = ThreadPoolExecutor(max_workers=8, thread_name_prefix="gloss-io")
CACHE_SECONDS = 600
_ready = {"value": None, "checked": 0.0}


def schema_ready(db) -> bool:
    """True once gloss_milestones exists (re-checked at most once a minute while missing)."""
    now = time.monotonic()
    if _ready["value"] or (_ready["value"] is False and now - _ready["checked"] < 60):
        return bool(_ready["value"])
    try:
        db.table("gloss_milestones").select("id").limit(1).execute()
        ok = True
    except Exception as e:
        # Only a missing table means "not migrated". Any other error (network
        # blip, timeout) must not switch the app to the old write path: assume
        # ready, don't cache, and let the real query report its own error.
        text = str(e)
        if not any(code in text for code in ("PGRST205", "42P01", "does not exist", "Could not find the table")):
            return True
        ok = False
    _ready.update(value=ok, checked=now)
    return ok


def milestone_name(kind: str, key: str) -> str:
    if kind == "level":
        return f"Level: {LEVEL_NAME.get(key, key)}"
    if kind == "category":
        return f"{cfg.CATEGORIES[key]['name']} badge"
    if kind == "demonstrated":
        return f"Demonstrated: {key.replace('_', ' ')}"
    if kind == "retained":
        return f"Retained: {key.replace('_', ' ')}"
    if kind == "practice":
        return "First recall challenge" if key == "first_recall" else f"{key.split('_')[1]} signs practised"
    if kind == "monthly":
        month, days = key.split(":")
        return f"{days} active days in {datetime.strptime(month, '%Y-%m').strftime('%B')}"
    return key


# ---------------------------------------------------------------
# Small caches (rarely changing data)
# ---------------------------------------------------------------
_signs = {"ids": None, "at": 0.0}
_tz: dict[str, tuple[str, float]] = {}


def active_sign_ids(db) -> list[str]:
    """Active gloss_signs ids, cached for CACHE_SECONDS."""
    if _signs["ids"] is None or time.monotonic() - _signs["at"] > CACHE_SECONDS:
        rows = db.table("gloss_signs").select("id").eq("is_active", True).execute().data or []
        _signs.update(ids=sorted(r["id"] for r in rows), at=time.monotonic())
    return _signs["ids"]


def caregiver_timezone(db, caregiver_profile_id: str) -> str:
    hit = _tz.get(caregiver_profile_id)
    if hit and time.monotonic() - hit[1] < CACHE_SECONDS:
        return hit[0]
    tz = load_timezone(db, caregiver_profile_id)
    _tz[caregiver_profile_id] = (tz, time.monotonic())
    return tz


# ---------------------------------------------------------------
# Context for one attempt (loaded in parallel)
# ---------------------------------------------------------------
_ATT = "id, target_sign_id, recognized_sign_id, quality_tier, attempt_type, mode, pipeline_version, attempted_at"


def _paged(query_factory) -> list[dict]:
    rows, start = [], 0
    while True:
        page = query_factory().range(start, start + 999).execute().data or []
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


def load_context(db, caregiver_profile_id: str, sign_id: str | None, timezone: str) -> dict:
    """What milestones_for_new_attempt needs, with four small parallel queries."""
    cg = caregiver_profile_id
    tz = ZoneInfo(timezone or cfg.DEFAULT_TIMEZONE)
    month_start = datetime.now(tz).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    f_ms = POOL.submit(lambda: (db.table("gloss_milestones").select("type, key, achieved_at, evidence")
                                .eq("caregiver_profile_id", cg).execute().data or []))
    f_sign = POOL.submit(lambda: [] if not sign_id else _paged(lambda: (
        db.table("gloss_attempts").select(_ATT).eq("caregiver_profile_id", cg).eq("target_sign_id", sign_id)
        .eq("pipeline_version", cfg.PIPELINE_VERSION).in_("mode", list(COUNTED_MODES)).order("attempted_at"))))
    f_cam = POOL.submit(lambda: _paged(lambda: (
        db.table("gloss_attempts").select("id, target_sign_id, attempted_at").eq("caregiver_profile_id", cg)
        .eq("attempt_type", "webcam").in_("mode", list(COUNTED_MODES)).order("attempted_at"))))
    f_month = POOL.submit(lambda: _paged(lambda: (
        db.table("gloss_attempts").select("id, attempted_at").eq("caregiver_profile_id", cg)
        .in_("mode", list(COUNTED_MODES)).gte("attempted_at", month_start.astimezone(dt_timezone.utc).isoformat())
        .order("attempted_at"))))
    first: dict[str, str] = {}
    for a in f_cam.result():
        if a["target_sign_id"] and a["target_sign_id"] not in first:
            first[a["target_sign_id"]] = str(a["id"])
    days: dict[str, str] = {}
    for a in f_month.result():
        local = datetime.fromisoformat(a["attempted_at"].replace("Z", "+00:00")).astimezone(tz)
        days.setdefault(local.strftime("%Y-%m-%d"), str(a["id"]))
    return {"existing": {(m["type"], m["key"]): m for m in f_ms.result()},
            "sign_attempts": f_sign.result(), "practised_first": first, "month_days": days}


def load_mastery_rows(db, caregiver_profile_id: str) -> list[dict]:
    return (db.table("gloss_caregiver_mastery")
            .select("sign_id, attempts, consecutive_strong_streak, mastery_status")
            .eq("caregiver_profile_id", caregiver_profile_id).execute().data or [])


def next_lesson_in_memory(sign_ids: list[str], mastery_rows: list[dict], updated: dict | None) -> str:
    """lesson_selector's ranking on already-loaded data, with this attempt's
    mastery row applied (same rule as select_next_lesson, no extra queries)."""
    by_sign = {r["sign_id"]: r for r in mastery_rows}
    if updated:
        by_sign[updated["sign_id"]] = {**by_sign.get(updated["sign_id"], {}), **updated}
    return rank_lessons(cfg.recommendable(sign_ids), by_sign)[0][0]


def record_attempt(db, attempt_row: dict, mastery_row: dict | None, context: dict | None = None,
                   timezone: str | None = None) -> dict:
    """attempt_row: gloss_attempts columns incl. mode and pipeline_version.
    context: load_context() result (loaded earlier, in parallel); loaded here if absent.
    Returns {attempt_id, attempted_at, new_milestones: [{type, key, name, achieved_at}]}."""
    cg = attempt_row["caregiver_profile_id"]
    earned = []
    if attempt_row.get("mode", "practice") in COUNTED_MODES:
        tz = timezone or caregiver_timezone(db, cg)
        ctx = context or load_context(db, cg, attempt_row.get("target_sign_id"), tz)
        this = {**attempt_row, "id": NEW, "attempted_at": datetime.now(dt_timezone.utc)}
        earned = milestones_for_new_attempt(this, ctx, tz)

    payload = [
        {
            "caregiver_profile_id": cg,
            "type": m["type"],
            "key": m["key"],
            # Earned by this attempt -> stamped with its time inside the transaction.
            "achieved_at": None if NEW in m["evidence"] else m["achieved_at"].isoformat(),
            "evidence": m["evidence"],
        }
        for m in earned
    ]
    out = db.rpc("gloss_record_attempt", {"p_attempt": attempt_row, "p_mastery": mastery_row,
                                          "p_milestones": payload}).execute().data
    out["new_milestones"] = [{**m, "name": milestone_name(m["type"], m["key"])} for m in out.get("new_milestones") or []]
    return out
