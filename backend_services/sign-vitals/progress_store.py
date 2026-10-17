"""
progress_store.py
GLOSS component — stores an attempt together with what it earns.

record_attempt() computes the milestones the new attempt earns
(progress_rules, over the caregiver's full history plus this attempt) and
writes attempt + mastery row + new milestones in ONE transaction through the
gloss_record_attempt database function (migration 0046).

schema_ready() tells whether migrations 0045-0047 are applied. Until they
are, attempt_submission keeps the original practice write path so the app
keeps working, and the new modes answer 503.
"""

import time
from datetime import datetime, timezone as dt_timezone

import sign_config as cfg
from progress_rules import COUNTED_MODES, NEW, compute_milestones, new_milestones
from progress_summary import LEVEL_NAME, load_attempts, load_milestones, load_timezone

MIGRATIONS_NEEDED = "This feature needs the GLOSS database migrations 0045-0047 to be applied first."
_ready = {"value": None, "checked": 0.0}


def schema_ready(db) -> bool:
    """True once gloss_milestones exists (re-checked at most once a minute while missing)."""
    now = time.monotonic()
    if _ready["value"] or (_ready["value"] is False and now - _ready["checked"] < 60):
        return bool(_ready["value"])
    try:
        db.table("gloss_milestones").select("id").limit(1).execute()
        ok = True
    except Exception:
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


def record_attempt(db, attempt_row: dict, mastery_row: dict | None) -> dict:
    """attempt_row: gloss_attempts columns incl. mode and pipeline_version.
    Returns {attempt_id, attempted_at, new_milestones: [{type, key, name, achieved_at}]}."""
    cg = attempt_row["caregiver_profile_id"]
    earned = []
    if attempt_row.get("mode", "practice") in COUNTED_MODES:
        history = load_attempts(db, cg)
        existing = {(m["type"], m["key"]) for m in load_milestones(db, cg)}
        this = {**attempt_row, "id": NEW, "attempted_at": datetime.now(dt_timezone.utc)}
        earned = new_milestones(compute_milestones(history + [this], load_timezone(db, cg)), existing)

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
