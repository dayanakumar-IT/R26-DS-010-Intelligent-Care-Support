"""
progress_summary.py
GLOSS component — GET /gloss/progress/summary: level, next level and exactly
what is missing, per-category and per-sign status, badges with dates, and
active days this month.

Everything shown comes from gloss_milestones (earned, permanent) and
gloss_attempts (practising, active days); nothing is estimated or seeded.
build_summary() is pure; load_summary() does the reads.
"""

from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo

import sign_config as cfg
from progress_rules import active_days_in_month

LEVEL_KEYS = [lvl["key"] for lvl in cfg.LEVELS]
LEVEL_NAME = {lvl["key"]: lvl["name"] for lvl in cfg.LEVELS}


def _plural(n: int, word: str) -> str:
    return f"{n} more {word}{'' if n == 1 else 's'}"


def _missing_for(level_key: str, demonstrated: set, retained: set) -> str:
    """Plain sentence: what is still needed for level_key."""
    countable = cfg.countable_signs()
    if level_key == "starter":
        return "Make your first camera attempt"
    if level_key in ("learner", "care_signer"):
        need = next(lvl["demonstrated"] for lvl in cfg.LEVELS if lvl["key"] == level_key)
        return f"Demonstrate {_plural(need - len(demonstrated), 'sign')}"
    if level_key == "communicator":
        best = min(
            cfg.CATEGORIES,
            key=lambda c: (len([s for s in cfg.countable_signs(c) if s not in demonstrated]), cfg.CATEGORIES[c]["name"]),
        )
        left = len([s for s in cfg.countable_signs(best) if s not in demonstrated])
        return f"Demonstrate {_plural(left, cfg.CATEGORIES[best]['name'] + ' sign')}"
    if level_key == "master":
        d = len([s for s in countable if s not in demonstrated])
        r = len([s for s in countable if s not in retained])
        parts = []
        if d:
            parts.append(f"demonstrate {_plural(d, 'sign')}")
        if r:
            parts.append(f"pass a recall challenge 7+ days later on {r} sign{'' if r == 1 else 's'}")
        return ("To finish: " + " and ".join(parts)) if parts else "All done"
    raise ValueError(level_key)


def build_summary(milestones: list[dict], attempts: list[dict], timezone: str, now: datetime | None = None) -> dict:
    now = now or datetime.now(dt_timezone.utc)
    tz = ZoneInfo(timezone or cfg.DEFAULT_TIMEZONE)
    by_type: dict[str, dict[str, dict]] = {}
    for m in milestones:
        by_type.setdefault(m["type"], {})[m["key"]] = m
    demonstrated = set(by_type.get("demonstrated", {}))
    retained = set(by_type.get("retained", {}))
    levels_earned = by_type.get("level", {})

    practised = {
        a["target_sign_id"] for a in attempts
        if a.get("target_sign_id") and (a.get("mode") or "practice") in ("practice", "recall")
    }

    def status(sign: str) -> str:
        if sign in retained:
            return "retained"
        if sign in demonstrated:
            return "demonstrated"
        return "practising" if sign in practised else "not_started"

    current = None
    for key in LEVEL_KEYS:
        if key in levels_earned:
            current = key
    # The next level is the first one not yet earned (levels can be earned out of order).
    next_key = next((k for k in LEVEL_KEYS if k not in levels_earned), None)

    categories = []
    for slug, c in cfg.CATEGORIES.items():
        countable = cfg.countable_signs(slug)
        categories.append({
            "key": slug,
            "name": c["name"],
            "countable": len(countable),
            "demonstrated": len([s for s in countable if s in demonstrated]),
            "retained": len([s for s in countable if s in retained]),
            "badge_earned_at": by_type.get("category", {}).get(slug, {}).get("achieved_at"),
            "signs": [
                {
                    "sign_id": s,
                    "status": status(s),
                    "countable": cfg.is_countable(s),
                    "note": cfg.UNRELIABLE_NOTE if s in cfg.UNRELIABLE else None,
                    "demonstrated_at": by_type.get("demonstrated", {}).get(s, {}).get("achieved_at"),
                    "retained_at": by_type.get("retained", {}).get(s, {}).get("achieved_at"),
                }
                for s in c["signs"]
            ],
        })

    month = now.astimezone(tz).strftime("%Y-%m")
    days = active_days_in_month(attempts, month, timezone)

    def badge(kind: str, key: str, name: str, description: str) -> dict:
        m = by_type.get(kind, {}).get(key)
        return {"type": kind, "key": key, "name": name, "description": description,
                "earned_at": m["achieved_at"] if m else None}

    skill_badges = [badge("level", lvl["key"], lvl["name"], lvl["rule"]) for lvl in cfg.LEVELS] + [
        badge("category", slug, c["name"], f"every countable {c['name']} sign Demonstrated")
        for slug, c in cfg.CATEGORIES.items()
    ]
    practice_badges = [
        badge("practice", f"signs_{n}", f"{n} signs practised", f"practised {n} different signs with the camera")
        for n in cfg.PRACTICE_SIGN_COUNTS
    ] + [badge("practice", "first_recall", "First recall", "completed a first Recall challenge")]
    monthly_badges = [
        {"type": "monthly", "key": m["key"], "month": m["key"].split(":")[0], "days": int(m["key"].split(":")[1]),
         "name": f"{int(m['key'].split(':')[1])} active days", "earned_at": m["achieved_at"]}
        for m in sorted(by_type.get("monthly", {}).values(), key=lambda m: m["key"])
    ]

    return {
        "level": {"key": current, "name": LEVEL_NAME.get(current)} if current else None,
        "next_level": (
            {"key": next_key, "name": LEVEL_NAME[next_key], "missing": _missing_for(next_key, demonstrated, retained)}
            if next_key else None
        ),
        "levels": [{"key": lvl["key"], "name": lvl["name"], "rule": lvl["rule"],
                    "earned_at": levels_earned.get(lvl["key"], {}).get("achieved_at")} for lvl in cfg.LEVELS],
        "counts": {
            "countable": len(cfg.countable_signs()),
            "demonstrated": len(demonstrated),
            "retained": len(retained),
            "practised": len(practised),
        },
        "categories": categories,
        "skill_badges": skill_badges,
        "practice_badges": practice_badges,
        "monthly": {"month": month, "active_days": days, "tiers": cfg.MONTHLY_TIERS, "badges": monthly_badges},
        "timezone": timezone or cfg.DEFAULT_TIMEZONE,
        "pipeline_version": cfg.PIPELINE_VERSION,
    }


ATTEMPT_COLUMNS = "id, target_sign_id, recognized_sign_id, quality_tier, attempt_type, mode, pipeline_version, attempted_at"


def load_attempts(db, caregiver_profile_id: str) -> list[dict]:
    rows, start = [], 0
    while True:
        page = (db.table("gloss_attempts").select(ATTEMPT_COLUMNS)
                .eq("caregiver_profile_id", caregiver_profile_id)
                .order("attempted_at").range(start, start + 999).execute()).data or []
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


def load_milestones(db, caregiver_profile_id: str) -> list[dict]:
    return (db.table("gloss_milestones").select("type, key, achieved_at, evidence")
            .eq("caregiver_profile_id", caregiver_profile_id).execute()).data or []


def load_timezone(db, caregiver_profile_id: str) -> str:
    rows = (db.table("gloss_caregiver_accounts").select("timezone")
            .eq("caregiver_profile_id", caregiver_profile_id).limit(1).execute()).data
    return (rows[0].get("timezone") if rows else None) or cfg.DEFAULT_TIMEZONE


def load_summary(db, caregiver_profile_id: str) -> dict:
    return build_summary(load_milestones(db, caregiver_profile_id), load_attempts(db, caregiver_profile_id),
                         load_timezone(db, caregiver_profile_id))
