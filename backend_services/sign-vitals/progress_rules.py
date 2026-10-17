"""
progress_rules.py
GLOSS component — levels, badges and milestones, derived ONLY from real
attempts (pure functions, no I/O).

compute_milestones() replays one caregiver's gloss_attempts in time order and
returns every milestone those attempts earn, each with the attempt ids that
earned it. The same function serves the live path (history + the new attempt,
written in one transaction by gloss_record_attempt) and the re-runnable
backfill (scripts/backfill_milestones.py), so both always agree.

Skill (current pipeline only, sign_config.PIPELINE_VERSION; practice and
recall camera attempts; free attempts never count):
  demonstrated:<sign>  the strong streak reaches 3 (mastery_engine rules:
                       strong on the right sign +1; moderate/weak or another
                       sign resets; a not-recognised attempt changes nothing;
                       a correct quiz answer changes nothing, a wrong one resets)
  retained:<sign>      Demonstrated, then a strong recall attempt on that sign
                       7+ days later
  level:*              Starter (first camera attempt), Learner (5 Demonstrated),
                       Communicator (first full category), Care Signer (30),
                       Master (every countable sign Demonstrated and Retained)
  category:<slug>      every countable sign in the category Demonstrated
  UNRELIABLE signs (hurt, pain, me, sleep) never earn or block any of these.

Practice (ALL history, earlier pipeline versions too — earlier effort counts):
  practice:signs_<N>   N different signs practised with the camera (5/10/25/40),
                       counting only camera attempts that passed the hand and
                       movement checks: clips that fail them are never stored
                       (attempt_submission returns before saving), so every
                       stored camera attempt qualifies. Attempts from before the
                       checks existed (14 Oct 2026) count too, by decision.
  practice:first_recall  first Recall challenge attempt
  monthly:<YYYY-MM>:<N>  N active days in that month (5/10/15), in the
                       caregiver's time zone; a day is active with any practice
                       or recall attempt (camera or quiz). Nothing is ever lost.

Milestones are permanent: once earned they are never revoked, even if a later
attempt breaks the streak (the current streak is shown separately).
"""

from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import sign_config as cfg

NEW = "NEW"  # placeholder id for the attempt being recorded (see gloss_record_attempt)
COUNTED_MODES = ("practice", "recall")


def _ts(value) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _m(kind: str, key: str, at: datetime, evidence: list[str]) -> dict:
    return {"type": kind, "key": key, "achieved_at": at, "evidence": list(evidence)}


def compute_milestones(attempts: list[dict], timezone: str = cfg.DEFAULT_TIMEZONE) -> list[dict]:
    """attempts: one caregiver's gloss_attempts rows (id, target_sign_id,
    recognized_sign_id, quality_tier, attempt_type, mode, pipeline_version,
    attempted_at). Returns [{type, key, achieved_at, evidence}], one per
    milestone earned, at the moment it was first earned."""
    tz = ZoneInfo(timezone or cfg.DEFAULT_TIMEZONE)
    rows = sorted(
        (a for a in attempts if (a.get("mode") or "practice") in COUNTED_MODES),
        key=lambda a: (_ts(a["attempted_at"]), str(a["id"])),
    )
    out: list[dict] = []

    # ---- skill: current pipeline only ----
    streak: dict[str, list[str]] = defaultdict(list)   # sign -> ids of the current strong run
    demonstrated: dict[str, tuple[datetime, str]] = {}  # sign -> (when, completing attempt id)
    retained: dict[str, tuple[datetime, str]] = {}
    levels: set[str] = set()
    categories_done: set[str] = set()
    countable = cfg.countable_signs()

    def level(key: str, at: datetime, evidence: list[str]):
        if key not in levels:
            levels.add(key)
            out.append(_m("level", key, at, evidence))

    for a in rows:
        if a.get("pipeline_version") != cfg.PIPELINE_VERSION:
            continue
        at, aid, sign = _ts(a["attempted_at"]), str(a["id"]), a.get("target_sign_id")
        camera = a.get("attempt_type", "webcam") == "webcam"
        if camera:
            level("starter", at, [aid])
        recognised = a.get("recognized_sign_id")
        correct = recognised is not None and recognised == sign

        # Streak (mastery_engine rules).
        if camera and recognised is None:
            pass                                    # not recognised: nothing changes
        elif not correct:
            streak[sign] = []
        elif camera:
            if a.get("quality_tier") == "strong":
                streak[sign].append(aid)
            else:
                streak[sign] = []
        # a correct quiz answer: untouched

        if (cfg.is_countable(sign) and sign not in demonstrated
                and len(streak[sign]) >= cfg.DEMONSTRATED_STREAK):
            demonstrated[sign] = (at, aid)
            out.append(_m("demonstrated", sign, at, streak[sign][-cfg.DEMONSTRATED_STREAK:]))

            n = len(demonstrated)
            proof = [d[1] for d in demonstrated.values()]
            if n >= 5:
                level("learner", at, proof[:5])
            if n >= 30:
                level("care_signer", at, proof[:30])
            cat = cfg.CATEGORY_OF[sign]
            if cat not in categories_done and all(s in demonstrated for s in cfg.countable_signs(cat)):
                categories_done.add(cat)
                cat_proof = [demonstrated[s][1] for s in cfg.countable_signs(cat)]
                out.append(_m("category", cat, at, cat_proof))
                level("communicator", at, cat_proof)

        # Retained: a strong recall attempt 7+ days after Demonstrated.
        if (a.get("mode") == "recall" and camera and correct and a.get("quality_tier") == "strong"
                and sign in demonstrated and sign not in retained
                and at - demonstrated[sign][0] >= timedelta(days=cfg.RETAINED_AFTER_DAYS)):
            retained[sign] = (at, aid)
            out.append(_m("retained", sign, at, [aid]))

        if ("master" not in levels and all(s in demonstrated for s in countable)
                and all(s in retained for s in countable)):
            level("master", at, [retained[s][1] for s in countable])

    # ---- practice badges: all history ----
    first_per_sign: dict[str, str] = {}
    first_recall_done = False
    active_days: dict[str, dict[str, str]] = defaultdict(dict)   # month -> {day: first attempt id}
    for a in rows:
        at, aid, sign = _ts(a["attempted_at"]), str(a["id"]), a.get("target_sign_id")
        if a.get("attempt_type", "webcam") == "webcam" and sign and sign not in first_per_sign:
            first_per_sign[sign] = aid
            if len(first_per_sign) in cfg.PRACTICE_SIGN_COUNTS:
                n = len(first_per_sign)
                out.append(_m("practice", f"signs_{n}", at, list(first_per_sign.values())))
        if a.get("mode") == "recall" and not first_recall_done:
            first_recall_done = True
            out.append(_m("practice", "first_recall", at, [aid]))
        local = at.astimezone(tz)
        month, day = local.strftime("%Y-%m"), local.strftime("%Y-%m-%d")
        if day not in active_days[month]:
            active_days[month][day] = aid
            if len(active_days[month]) in cfg.MONTHLY_TIERS:
                n = len(active_days[month])
                out.append(_m("monthly", f"{month}:{n}", at, list(active_days[month].values())))

    return out


def active_days_in_month(attempts: list[dict], month: str, timezone: str = cfg.DEFAULT_TIMEZONE) -> int:
    """Distinct local days with a practice or recall attempt in `month` (YYYY-MM)."""
    tz = ZoneInfo(timezone or cfg.DEFAULT_TIMEZONE)
    days = {
        _ts(a["attempted_at"]).astimezone(tz).strftime("%Y-%m-%d")
        for a in attempts
        if (a.get("mode") or "practice") in COUNTED_MODES
    }
    return sum(1 for d in days if d.startswith(month))


def new_milestones(computed: list[dict], existing_keys: set[tuple[str, str]]) -> list[dict]:
    """The computed milestones not yet stored (by (type, key))."""
    return [m for m in computed if (m["type"], m["key"]) not in existing_keys]


# ---------------------------------------------------------------
# Incremental: only what ONE new attempt can change (live path)
# ---------------------------------------------------------------
def _streak_run(sign_attempts: list[dict]) -> list[str]:
    """Ids of the current strong run for one sign (mastery_engine rules),
    over that sign's current-pipeline practice/recall attempts in order."""
    run: list[str] = []
    for a in sign_attempts:
        camera = a.get("attempt_type", "webcam") == "webcam"
        recognised = a.get("recognized_sign_id")
        if camera and recognised is None:
            continue
        if recognised != a.get("target_sign_id"):
            run = []
        elif camera:
            run = run + [str(a["id"])] if a.get("quality_tier") == "strong" else []
    return run


def milestones_for_new_attempt(new: dict, ctx: dict, timezone: str = cfg.DEFAULT_TIMEZONE) -> list[dict]:
    """The milestones `new` earns, from a small context instead of the full
    history (same rules as compute_milestones; tests/test_progress_rules.py
    checks they always agree). ctx:
      existing         {(type, key): milestone row} already stored
      sign_attempts    this sign's earlier current-pipeline practice/recall attempts, oldest first
      practised_first  {sign: first camera practice/recall attempt id}, all versions, in order
      month_days       {local YYYY-MM-DD: first practice/recall attempt id} for new's month
    """
    mode = new.get("mode") or "practice"
    if mode not in COUNTED_MODES:
        return []
    tz = ZoneInfo(timezone or cfg.DEFAULT_TIMEZONE)
    existing = ctx["existing"]
    at, aid, sign = _ts(new["attempted_at"]), str(new["id"]), new.get("target_sign_id")
    camera = new.get("attempt_type", "webcam") == "webcam"
    out: list[dict] = []
    have = lambda kind, key: (kind, key) in existing or any(m["type"] == kind and m["key"] == key for m in out)  # noqa: E731

    demonstrated = {k: _ts(m["achieved_at"]) for (t, k), m in existing.items() if t == "demonstrated"}
    proof = {k: str(m["evidence"][-1]) for (t, k), m in existing.items() if t == "demonstrated" and m.get("evidence")}
    retained = {k for (t, k) in existing if t == "retained"}

    if new.get("pipeline_version") == cfg.PIPELINE_VERSION:
        if camera and not have("level", "starter"):
            out.append(_m("level", "starter", at, [aid]))
        run = _streak_run(ctx["sign_attempts"] + [new])
        if cfg.is_countable(sign) and sign not in demonstrated and len(run) >= cfg.DEMONSTRATED_STREAK:
            demonstrated[sign], proof[sign] = at, aid
            out.append(_m("demonstrated", sign, at, run[-cfg.DEMONSTRATED_STREAK:]))
            ordered = [proof[s] for s in sorted(demonstrated, key=lambda s: (demonstrated[s], proof.get(s, "")))]
            if len(demonstrated) >= 5 and not have("level", "learner"):
                out.append(_m("level", "learner", at, ordered[:5]))
            if len(demonstrated) >= 30 and not have("level", "care_signer"):
                out.append(_m("level", "care_signer", at, ordered[:30]))
            cat = cfg.CATEGORY_OF[sign]
            if not have("category", cat) and all(s in demonstrated for s in cfg.countable_signs(cat)):
                cat_proof = [proof[s] for s in cfg.countable_signs(cat)]
                out.append(_m("category", cat, at, cat_proof))
                if not have("level", "communicator"):
                    out.append(_m("level", "communicator", at, cat_proof))
        correct = new.get("recognized_sign_id") is not None and new.get("recognized_sign_id") == sign
        if (mode == "recall" and camera and correct and new.get("quality_tier") == "strong"
                and sign in demonstrated and sign not in retained
                and at - demonstrated[sign] >= timedelta(days=cfg.RETAINED_AFTER_DAYS)):
            retained.add(sign)
            out.append(_m("retained", sign, at, [aid]))
        countable = cfg.countable_signs()
        if (not have("level", "master") and all(s in demonstrated for s in countable)
                and all(s in retained for s in countable)):
            ids = [str(existing[("retained", s)]["evidence"][-1]) if ("retained", s) in existing else aid for s in countable]
            out.append(_m("level", "master", at, ids))

    first = dict(ctx["practised_first"])
    if camera and sign and sign not in first:
        first[sign] = aid
        n = len(first)
        if n in cfg.PRACTICE_SIGN_COUNTS and not have("practice", f"signs_{n}"):
            out.append(_m("practice", f"signs_{n}", at, list(first.values())))
    if mode == "recall" and not have("practice", "first_recall"):
        out.append(_m("practice", "first_recall", at, [aid]))
    local = at.astimezone(tz)
    month, day = local.strftime("%Y-%m"), local.strftime("%Y-%m-%d")
    days = dict(ctx["month_days"])
    if day not in days:
        days[day] = aid
        n = len(days)
        if n in cfg.MONTHLY_TIERS and not have("monthly", f"{month}:{n}"):
            out.append(_m("monthly", f"{month}:{n}", at, list(days.values())))
    return out


def context_from_history(history: list[dict], new: dict, existing_rows: list[dict],
                         timezone: str = cfg.DEFAULT_TIMEZONE) -> dict:
    """The ctx milestones_for_new_attempt needs, built from a full history
    (used by tests; the live path loads the same pieces with small queries)."""
    tz = ZoneInfo(timezone or cfg.DEFAULT_TIMEZONE)
    rows = sorted((a for a in history if (a.get("mode") or "practice") in COUNTED_MODES),
                  key=lambda a: (_ts(a["attempted_at"]), str(a["id"])))
    sign = new.get("target_sign_id")
    month = _ts(new["attempted_at"]).astimezone(tz).strftime("%Y-%m")
    first: dict[str, str] = {}
    days: dict[str, str] = {}
    for a in rows:
        if a.get("attempt_type", "webcam") == "webcam" and a.get("target_sign_id") and a["target_sign_id"] not in first:
            first[a["target_sign_id"]] = str(a["id"])
        d = _ts(a["attempted_at"]).astimezone(tz)
        if d.strftime("%Y-%m") == month:
            days.setdefault(d.strftime("%Y-%m-%d"), str(a["id"]))
    return {
        "existing": {(m["type"], m["key"]): m for m in existing_rows},
        "sign_attempts": [a for a in rows if a.get("target_sign_id") == sign and a.get("pipeline_version") == cfg.PIPELINE_VERSION],
        "practised_first": first,
        "month_days": days,
    }
