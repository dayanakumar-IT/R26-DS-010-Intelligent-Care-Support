"""
supervisor_report.py
Sign & Vitals — the supervisor view (read-only).

Every supervisor sees ALL caregivers (two supervisors cover each other).
Per caregiver: Demonstrated / Retained (of the countable signs) and signs
practised — the same definitions as /gloss/progress/summary — pace
(Demonstrated per week over the last 4 weeks and a neutral trend), active
days this week and overall, last active date, and Parkinson's education
(quizzes completed, questions answered, mastery). Plus one neutral line per
caregiver for the daily popup.

Recognition, not surveillance: no rankings (sorted by name), no failed
attempts, no streaks, no video (none is stored). Supervisors' own learning
(gloss_learners kind='supervisor') is not listed.

The maths is in plain functions (caregiver_row, popup_line) so it is
unit-tested without a database; load_overview / load_caregiver do batched
reads with the service role. Callers must check the supervisor role first
(auth_helper.get_authenticated_supervisor).
"""

from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import sign_config as cfg
from progress_rules import COUNTED_MODES
from progress_summary import load_summary

MASTERED_SCORE = 80  # pdedu mastery_score at or above this = symptom mastered
WEEKS = 4


def _ts(value) -> datetime:
    return value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())  # Monday


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def trend_word(pace: list[int]) -> str:
    """Neutral comparison of the last 2 weeks with the 2 weeks before."""
    recent, earlier = sum(pace[-2:]), sum(pace[:-2])
    if recent == earlier:
        return "about the same as the 2 weeks before"
    return "more than the 2 weeks before" if recent > earlier else "fewer than the 2 weeks before"


def caregiver_row(caregiver: dict, milestones: list[dict], attempts: list[dict], pdedu: dict,
                  timezone: str = cfg.DEFAULT_TIMEZONE, now: datetime | None = None) -> dict:
    """caregiver: {id, name}; milestones: their gloss_milestones rows; attempts:
    their gloss_attempts rows (target_sign_id, mode, attempted_at); pdedu:
    {quiz_sessions, responses, mastery, symptom_count} rows / numbers."""
    tz = ZoneInfo(timezone or cfg.DEFAULT_TIMEZONE)
    today = (now or datetime.now(tz)).astimezone(tz).date()
    this_week = _week_start(today)
    countable = set(cfg.countable_signs())

    demonstrated = {m["key"]: _ts(m["achieved_at"]) for m in milestones if m["type"] == "demonstrated" and m["key"] in countable}
    retained = {m["key"] for m in milestones if m["type"] == "retained" and m["key"] in countable}
    counted = [a for a in attempts if (a.get("mode") or "practice") in COUNTED_MODES]
    practised = {a["target_sign_id"] for a in counted if a.get("target_sign_id")}
    days = sorted({_ts(a["attempted_at"]).astimezone(tz).date() for a in counted})

    weeks = [this_week - timedelta(weeks=WEEKS - 1 - i) for i in range(WEEKS)]  # oldest -> this week
    pace = [sum(1 for at in demonstrated.values() if _week_start(at.astimezone(tz).date()) == w) for w in weeks]

    mastery = pdedu.get("mastery", [])
    scores = [float(m["mastery_score"]) for m in mastery]
    return {
        "caregiver_profile_id": caregiver["id"],
        "name": caregiver["name"],
        "short_id": str(caregiver["id"])[:8],
        "countable": len(countable),
        "demonstrated": len(demonstrated),
        "retained": len(retained),
        "practised": len(practised),
        "pace": {"weeks": [w.isoformat() for w in weeks], "demonstrated": pace, "trend": trend_word(pace)},
        "active_days_this_week": sum(1 for d in days if d >= this_week),
        "active_days_total": len(days),
        "new_demonstrated_this_week": pace[-1],
        "last_active": days[-1].isoformat() if days else None,
        "parkinsons": {
            "quizzes_completed": sum(1 for s in pdedu.get("quiz_sessions", []) if s.get("completed_at")),
            "questions_answered": len(pdedu.get("responses", [])),
            "symptoms_mastered": sum(1 for s in scores if s >= MASTERED_SCORE),
            "symptom_count": pdedu.get("symptom_count", 0),
            "average_mastery": round(sum(scores) / len(scores)) if scores else None,
        },
    }


def popup_line(row: dict) -> str:
    """One neutral line, e.g. 'Harsha: 4 active days this week, 1 new sign demonstrated'."""
    days, new = row["active_days_this_week"], row["new_demonstrated_this_week"]
    if days == 0:
        return f"{row['name']}: no practice yet this week"
    line = f"{row['name']}: {_plural(days, 'active day')} this week"
    if new:
        line += f", {_plural(new, 'new sign')} demonstrated"
    return line


# ---------------------------------------------------------------
# Loaders (service role; batched)
# ---------------------------------------------------------------
def _paged(query_factory) -> list[dict]:
    rows, start = [], 0
    while True:
        page = query_factory().range(start, start + 999).execute().data or []
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


def _by(rows: list[dict]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        out[str(r["caregiver_profile_id"])].append(r)
    return out


def _caregivers(db) -> list[dict]:
    accounts = db.table("gloss_caregiver_accounts").select("caregiver_profile_id, timezone").execute().data or []
    ids = [a["caregiver_profile_id"] for a in accounts]
    if not ids:
        return []
    names = {r["id"]: r["display_name"] for r in
             (db.table("caregiver_profiles").select("id, display_name").in_("id", ids).execute().data or [])}
    return sorted(
        ({"id": a["caregiver_profile_id"], "name": names.get(a["caregiver_profile_id"], "Caregiver"),
          "timezone": a.get("timezone") or cfg.DEFAULT_TIMEZONE} for a in accounts),
        key=lambda c: c["name"].lower(),
    )


def _rows_for(db, ids: list[str]) -> dict:
    ms = _paged(lambda: db.table("gloss_milestones").select("caregiver_profile_id, type, key, achieved_at")
                .in_("caregiver_profile_id", ids).in_("type", ["demonstrated", "retained"]).order("id"))
    att = _paged(lambda: db.table("gloss_attempts").select("caregiver_profile_id, target_sign_id, mode, attempted_at")
                 .in_("caregiver_profile_id", ids).order("id"))
    qs = _paged(lambda: db.table("pdedu_quiz_sessions").select("caregiver_profile_id, completed_at")
                .in_("caregiver_profile_id", ids).order("id"))
    rs = _paged(lambda: db.table("pdedu_responses").select("caregiver_profile_id")
                .in_("caregiver_profile_id", ids).order("id"))
    mm = _paged(lambda: db.table("pdedu_caregiver_mastery").select("caregiver_profile_id, mastery_score")
                .in_("caregiver_profile_id", ids).order("id"))
    symptoms = len(db.table("pdedu_symptoms").select("id").eq("is_active", True).execute().data or [])
    return {"milestones": _by(ms), "attempts": _by(att), "quiz_sessions": _by(qs), "responses": _by(rs),
            "mastery": _by(mm), "symptom_count": symptoms}


def _row(c: dict, data: dict, now=None) -> dict:
    cid = str(c["id"])
    pdedu = {"quiz_sessions": data["quiz_sessions"].get(cid, []), "responses": data["responses"].get(cid, []),
             "mastery": data["mastery"].get(cid, []), "symptom_count": data["symptom_count"]}
    return caregiver_row(c, data["milestones"].get(cid, []), data["attempts"].get(cid, []), pdedu, c["timezone"], now)


def load_overview(db) -> dict:
    caregivers = _caregivers(db)
    if not caregivers:
        return {"caregivers": [], "popup": []}
    data = _rows_for(db, [c["id"] for c in caregivers])
    rows = [_row(c, data) for c in caregivers]
    return {"caregivers": rows, "popup": [popup_line(r) for r in rows]}


def load_caregiver(db, caregiver_profile_id: str) -> dict | None:
    """Detail for one caregiver: overview row + their progress summary (the
    same data as their own My Journey / progress report). None if unknown."""
    caregiver = next((c for c in _caregivers(db) if str(c["id"]) == str(caregiver_profile_id)), None)
    if not caregiver:
        return None
    data = _rows_for(db, [caregiver["id"]])
    return {**_row(caregiver, data), "summary": load_summary(db, caregiver["id"])}


def create_supervisor_learner(db, user_id: str, name: str) -> str:
    """The caller's supervisor learner id, created if missing (idempotent)."""
    existing = (db.table("gloss_learners").select("id").eq("user_id", user_id).eq("kind", "supervisor")
                .limit(1).execute().data)
    if existing:
        return existing[0]["id"]
    row = (db.table("gloss_learners").insert({"kind": "supervisor", "user_id": user_id, "display_name": name})
           .execute().data)
    return row[0]["id"]
