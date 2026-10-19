"""
tests/test_progress_rules.py
GLOSS component — levels, badges and milestones come only from real
attempts (progress_rules.py, progress_summary.py, recall_selector.py).

Run with .venv's python:
    python tests/test_progress_rules.py
"""

import hashlib
import os
import random
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import mastery_engine  # noqa: E402
import sign_config as cfg  # noqa: E402
from progress_rules import compute_milestones, context_from_history, milestones_for_new_attempt, new_milestones  # noqa: E402
from progress_summary import build_summary  # noqa: E402
from recall_selector import pick_recall_sign  # noqa: E402
from recogniser import ASSETS_DIR  # noqa: E402

V, OLD = cfg.PIPELINE_VERSION, cfg.LEGACY_PIPELINE
T0 = datetime(2026, 10, 12, 4, 0, tzinfo=timezone.utc)
_n = [0]


def att(sign, tier="strong", minutes=0, version=V, mode="practice", kind="webcam", recognised="same"):
    _n[0] += 1
    return {
        "id": f"a{_n[0]}", "target_sign_id": sign, "attempt_type": kind, "mode": mode, "pipeline_version": version,
        "recognized_sign_id": sign if recognised == "same" else recognised,
        "quality_tier": tier if recognised == "same" and kind == "webcam" else None,
        # + one second per attempt, so attempts made "at the same minute" keep their order.
        "attempted_at": (T0 + timedelta(minutes=minutes, seconds=_n[0])).isoformat(),
    }


def keys(ms, kind=None):
    return {(m["type"], m["key"]) for m in ms if kind is None or m["type"] == kind}


def demonstrate(sign, start):
    return [att(sign, minutes=start + i) for i in range(3)]


def test_pipeline_version_matches_model_bundle():
    with open(os.path.join(ASSETS_DIR, "manifest.json"), "rb") as f:
        assert hashlib.sha256(f.read()).hexdigest().startswith(cfg.PIPELINE_MANIFEST_SHA256_PREFIX), \
            "gloss_assets changed: bump sign_config.PIPELINE_VERSION (and tag attempts accordingly)"
    assert cfg.PIPELINE_VERSION.endswith(cfg.PIPELINE_MANIFEST_SHA256_PREFIX)
    assert cfg.DEMONSTRATED_STREAK == mastery_engine.MASTERY_STREAK_REQUIRED


def test_categories_cover_all_59_signs():
    import json
    with open(os.path.join(ASSETS_DIR, "class_names.json")) as f:
        assert sorted(json.load(f)) == cfg.ALL_SIGNS
    assert len(cfg.countable_signs()) == 55


def test_demonstrated_needs_three_strong_in_a_row_and_is_permanent():
    a = [att("water"), att("water"), att("water", tier="moderate"), att("water"), att("water")]
    assert "demonstrated" not in {m["type"] for m in compute_milestones(a)}
    a.append(att("water", minutes=10))
    ms = compute_milestones(a)
    d = [m for m in ms if m["type"] == "demonstrated"]
    assert [m["key"] for m in d] == ["water"] and d[0]["evidence"] == [x["id"] for x in a[-3:]]
    # A later weak attempt resets the streak but never removes Demonstrated.
    a.append(att("water", tier="weak", minutes=20))
    assert ("demonstrated", "water") in keys(compute_milestones(a))


def test_streak_rules_match_mastery_engine():
    # Not recognised: no change. Correct quiz answer: no change. Another sign: reset.
    a = [att("tea"), att("tea"), att("tea", recognised=None), att("tea", kind="multiple_choice"), att("tea")]
    assert ("demonstrated", "tea") in keys(compute_milestones(a))
    b = [att("tea"), att("tea"), att("tea", recognised="coffee"), att("tea")]
    assert ("demonstrated", "tea") not in keys(compute_milestones(b))
    c = [att("tea"), att("tea"), att("tea", kind="multiple_choice", recognised="milk"), att("tea")]
    assert ("demonstrated", "tea") not in keys(compute_milestones(c))


def test_only_current_pipeline_counts_for_skill_but_all_count_as_practice():
    legacy = [att(s, version=OLD, minutes=i * 3 + j) for i, s in enumerate(["bread", "coffee", "egg", "fruit", "milk"]) for j in range(3)]
    ms = compute_milestones(legacy)
    assert not keys(ms, "demonstrated") and not keys(ms, "level")
    assert ("practice", "signs_5") in keys(ms)


def test_unreliable_signs_never_count():
    ms = compute_milestones(demonstrate("pain", 0) + demonstrate("sleep", 10))
    assert not keys(ms, "demonstrated")


def test_free_attempts_never_count():
    free = [{**att(None, mode="free", minutes=i), "target_sign_id": None, "recognized_sign_id": "water"} for i in range(20)]
    assert compute_milestones(free) == []


def test_levels_and_category_badges():
    a = []
    for i, s in enumerate(cfg.countable_signs("food_drink")):
        a += demonstrate(s, i * 5)
    ms = compute_milestones(a)
    assert ("level", "starter") in keys(ms) and ("level", "learner") in keys(ms)
    assert ("category", "food_drink") in keys(ms) and ("level", "communicator") in keys(ms)
    assert ("level", "care_signer") not in keys(ms)
    learner = next(m for m in ms if m["key"] == "learner")
    fifth = [m for m in ms if m["type"] == "demonstrated"][4]
    assert learner["achieved_at"] == fifth["achieved_at"]


def test_retained_needs_strong_recall_7_days_later_and_master_needs_all():
    a = demonstrate("water", 0)
    a.append(att("water", mode="recall", minutes=60 * 24 * 6))      # 6 days: too early
    assert ("retained", "water") not in keys(compute_milestones(a))
    a.append(att("water", mode="recall", minutes=60 * 24 * 8))
    assert ("retained", "water") in keys(compute_milestones(a))
    assert ("practice", "first_recall") in keys(compute_milestones(a))
    everything = []
    for i, s in enumerate(cfg.countable_signs()):
        everything += demonstrate(s, i * 4)
    for i, s in enumerate(cfg.countable_signs()):
        everything.append(att(s, mode="recall", minutes=60 * 24 * 10 + i))
    ms = compute_milestones(everything)
    assert ("level", "master") in keys(ms) and ("level", "care_signer") in keys(ms)


def test_monthly_badge_counts_local_days():
    # 23:30 UTC is already the next day in Colombo (UTC+5:30).
    days = [att("tea", minutes=0, version=OLD)]
    base = datetime(2026, 10, 1, 19, 0, tzinfo=timezone.utc)
    for d in range(5):
        days.append({**att("tea", version=OLD), "attempted_at": (base + timedelta(days=d)).isoformat()})
    ms = compute_milestones(days, "Asia/Colombo")
    assert ("monthly", "2026-10:5") in keys(ms)
    assert ("monthly", "2026-10:10") not in keys(ms)


def test_new_milestones_and_existing():
    ms = compute_milestones(demonstrate("water", 0))
    assert new_milestones(ms, {("level", "starter")}) == [m for m in ms if m["key"] != "starter"]


def test_summary_level_next_goal_and_categories():
    a = []
    for i, s in enumerate(cfg.countable_signs("food_drink")[:7]):
        a += demonstrate(s, i * 5)
    ms = [{**m, "achieved_at": m["achieved_at"].isoformat()} for m in compute_milestones(a)]
    s = build_summary(ms, a, "Asia/Colombo", now=T0 + timedelta(days=1))
    assert s["level"]["key"] == "learner"
    assert s["next_level"] == {"key": "communicator", "name": "Communicator",
                               "missing": "Demonstrate 2 more Food & Drink signs"}
    food = next(c for c in s["categories"] if c["key"] == "food_drink")
    assert (food["countable"], food["demonstrated"]) == (9, 7)
    pain = next(x for c in s["categories"] for x in c["signs"] if x["sign_id"] == "pain")
    assert pain["countable"] is False and pain["note"] == cfg.UNRELIABLE_NOTE
    empty = build_summary([], [], "Asia/Colombo")
    assert empty["level"] is None and empty["next_level"]["missing"] == "Make your first camera attempt"


def test_recall_picks_practised_signs_only_never_not_recommended():
    a = [att("good", version=OLD), att("water", version=OLD), att("tea", version=OLD)]
    rng = random.Random(1)
    picks = {pick_recall_sign(a, [], rng=rng) for _ in range(30)}
    assert picks <= {"water", "tea"} and "good" not in picks
    assert pick_recall_sign([], []) is None
    ms = [{"type": "demonstrated", "key": "tea", "achieved_at": (T0 - timedelta(days=9)).isoformat()}]
    assert pick_recall_sign(a, ms, now=T0, rng=rng) == "tea"   # due for Retained


def test_incremental_equals_full_replay():
    """The live path computes only what the new attempt can change; it must
    always equal full replay (history + attempt) minus what was earned."""
    rng = random.Random(7)
    signs = cfg.CATEGORIES["health_medical"]["signs"] + cfg.CATEGORIES["body_parts"]["signs"] + ["water", "tea"]
    checked = 0
    for trial in range(40):
        history, t = [], T0
        for k in range(rng.randint(30, 120)):
            t += timedelta(minutes=rng.choice([1, 5, 60, 60 * 24, 60 * 24 * 8]))
            sign = rng.choice(signs)
            kind = rng.choice(["webcam"] * 5 + ["multiple_choice"])
            mode = rng.choice(["practice"] * 4 + ["recall", "free"]) if kind == "webcam" else "practice"
            rec = rng.choice([sign] * 6 + [None, "water"])
            a = {"id": f"t{trial}-{k}", "target_sign_id": None if mode == "free" else sign, "attempt_type": kind, "mode": mode,
                 "pipeline_version": rng.choice([V] * 4 + [OLD]), "recognized_sign_id": rec,
                 "quality_tier": rng.choice(["strong"] * 3 + ["moderate", "weak"]) if (kind == "webcam" and rec == sign) else None,
                 "attempted_at": t.isoformat()}
            existing = compute_milestones(history)
            expected = new_milestones(compute_milestones(history + [a]), {(m["type"], m["key"]) for m in existing})
            got = milestones_for_new_attempt(a, context_from_history(history, a, existing))
            norm = lambda ms: sorted((m["type"], m["key"], m["achieved_at"], tuple(m["evidence"])) for m in ms)  # noqa: E731
            assert norm(got) == norm(expected), (trial, k, norm(got), norm(expected))
            history.append(a)
            checked += 1
    print(f"    incremental == full replay on {checked} attempts")


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("PROGRESS RULES TEST PASSED")
