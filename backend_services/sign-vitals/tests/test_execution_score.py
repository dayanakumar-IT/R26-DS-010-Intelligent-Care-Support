"""
tests/test_execution_score.py
GLOSS component — the display-only execution score never contradicts
the v3 quality tier.

For each of the 10 pipeline-parity attempts
(gloss_assets/pipeline_parity.npz), computes
mastery_engine.compute_execution_score() from the notebook's DTW
distance and that sign's v3 thresholds, and asserts the score's band
matches the notebook's tier:

  strong   -> score >= 0.67
  moderate -> 0.33 <= score < 0.67
  weak     -> score < 0.33

Also sweeps every sign's thresholds across the tier boundaries.

Run with .venv's python, from anywhere:
    python tests/test_execution_score.py
(also collectable by pytest).
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mastery_engine import compute_execution_score  # noqa: E402

ASSETS_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "gloss_assets")
)


def _band(score: float) -> str:
    assert 0.0 <= score <= 1.0, score
    return "strong" if score >= 0.67 else "moderate" if score >= 0.33 else "weak"


def _tier(distance, t) -> str:
    return "strong" if distance <= t["strong_max"] else "moderate" if distance <= t["moderate_max"] else "weak"


def _thresholds():
    with open(os.path.join(ASSETS_DIR, "class_thresholds.json")) as f:
        return json.load(f)


def test_parity_attempts_score_band_matches_tier():
    thresholds = _thresholds()
    z = np.load(os.path.join(ASSETS_DIR, "pipeline_parity.npz"))
    expected = json.loads(str(z["expected_json"]))
    assert len(expected) == 10

    failures = []
    for exp in expected:
        # The notebook grades against the PREDICTED sign's reference.
        t = thresholds[exp["predicted_class"]]
        score = compute_execution_score(exp["dtw_distance"], t["strong_max"], t["moderate_max"])
        ok = _band(score) == exp["quality_tier"]
        print(
            f"[{exp['index']}] sign={exp['predicted_class']:<12} dtw={exp['dtw_distance']:<8.4f} "
            f"strong_max={t['strong_max']:.3f} moderate_max={t['moderate_max']:.3f} "
            f"tier={exp['quality_tier']:<8} score={score:.4f} ({round(score * 100)}%) band={_band(score):<8} "
            f"{'OK' if ok else 'FAIL'}"
        )
        if not ok:
            failures.append(exp["index"])
    assert not failures, f"score band contradicts tier for attempts {failures}"


def test_score_never_contradicts_tier_for_any_sign():
    thresholds = _thresholds()
    checked = 0
    for sign, t in thresholds.items():
        s, m = t["strong_max"], t["moderate_max"]
        distances = [0.0, s / 2, np.nextafter(s, 0), s, np.nextafter(s, np.inf), (s + m) / 2,
                     np.nextafter(m, 0), m, np.nextafter(m, np.inf), 1.5 * m, 2 * m, 10 * m]
        previous = None
        for d in distances:
            score = compute_execution_score(float(d), s, m)
            assert _band(score) == _tier(d, t), (sign, d, score)
            # what the frontend shows (whole percent) must agree too
            shown = round(score * 100)
            assert {"strong": shown >= 67, "moderate": 33 <= shown < 67, "weak": shown < 33}[_tier(d, t)], (sign, d, shown)
            assert previous is None or score <= previous, (sign, d, "score must not increase with distance")
            previous = score
            checked += 1
        assert compute_execution_score(0.0, s, m) == 1.0 and compute_execution_score(2 * m, s, m) == 0.0
    print(f"boundary sweep: {checked} distances across {len(thresholds)} signs OK")


if __name__ == "__main__":
    test_parity_attempts_score_band_matches_tier()
    test_score_never_contradicts_tier_for_any_sign()
    print("EXECUTION SCORE TEST PASSED")
