"""
recall_selector.py
GLOSS component — the word for the Recall challenge (see the word, sign it
from memory).

Only signs the caregiver has already practised (practice or recall
attempts), never the not-recommended signs. Preference, so a recall attempt
is most useful:
  1. Demonstrated 7+ days ago and not yet Retained (can earn Retained now);
  2. Demonstrated, not yet Retained;
  3. any other practised sign.
The previous recall word is avoided when there is a choice.
"""

import random
from datetime import datetime, timedelta, timezone as dt_timezone

import sign_config as cfg
from progress_rules import _ts


def pick_recall_sign(attempts: list[dict], milestones: list[dict], now: datetime | None = None,
                     rng: random.Random | None = None) -> str | None:
    now = now or datetime.now(dt_timezone.utc)
    rng = rng or random.Random()
    practised = sorted({
        a["target_sign_id"] for a in attempts
        if a.get("target_sign_id") and (a.get("mode") or "practice") in ("practice", "recall")
        and cfg.is_recommendable(a["target_sign_id"])
    })
    if not practised:
        return None
    demonstrated = {m["key"]: _ts(m["achieved_at"]) for m in milestones if m["type"] == "demonstrated"}
    retained = {m["key"] for m in milestones if m["type"] == "retained"}
    recalls = [a for a in attempts if a.get("mode") == "recall"]
    last = max(recalls, key=lambda a: _ts(a["attempted_at"]))["target_sign_id"] if recalls else None

    due = [s for s in practised if s in demonstrated and s not in retained
           and now - demonstrated[s] >= timedelta(days=cfg.RETAINED_AFTER_DAYS)]
    pending = [s for s in practised if s in demonstrated and s not in retained]
    for group in (due, pending, practised):
        choices = [s for s in group if s != last] or group
        if choices:
            return rng.choice(choices)
    return None
