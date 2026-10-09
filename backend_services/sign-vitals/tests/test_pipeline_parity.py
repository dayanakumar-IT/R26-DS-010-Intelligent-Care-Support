"""
tests/test_pipeline_parity.py
GLOSS component — full-pipeline parity check against the notebook.

Loads gloss_assets/pipeline_parity.npz (10 complete attempts plus the
notebook's expected outputs) and, for each attempt, runs the APP's own
grading and feedback (execution_evaluator.evaluate_execution ->
grading.grade_learner_attempt + feedback_generator.generate_feedback)
on normalized_{i}, asserting:

  - predicted_class equal;
  - confidence within 1e-4;
  - dtw_distance within 1e-4;
  - quality_tier equal;
  - top_landmarks equal;
  - feedback_text identical.

Then, for each attempt where has_raw is true, runs the app's own
normalization (preprocessing.normalize_raw_landmarks) on raw_{i} and
REPORTS — does not assert — how close it is to normalized_{i}.

Run with .venv's python, from anywhere:
    python tests/test_pipeline_parity.py
(also collectable by pytest).
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import grading  # noqa: E402
from execution_evaluator import evaluate_execution  # noqa: E402
from preprocessing import normalize_raw_landmarks  # noqa: E402
from recogniser import ASSETS_DIR, load_ensemble  # noqa: E402

TOLERANCE = 1e-4


def _load_parity():
    z = np.load(os.path.join(ASSETS_DIR, "pipeline_parity.npz"))
    return z, json.loads(str(z["expected_json"]))


def test_pipeline_parity():
    z, expected = _load_parity()
    assert len(expected) == 10, len(expected)

    grading.load_assets()
    model = load_ensemble()

    failures = []
    for exp in expected:
        i = exp["index"]
        ev = evaluate_execution(z[f"normalized_{i}"], exp["true_sign"], model)
        result, base = ev["result"], ev["base"]

        top_landmarks = [d["landmark"] for d in result["top_deviating_landmarks"][:2]]
        conf_diff = abs(result["tcn_confidence"] - exp["confidence"])
        dist_diff = abs(result["dtw_distance"] - exp["dtw_distance"])
        checks = {
            "predicted_class": str(result["predicted_class"]) == exp["predicted_class"],
            "confidence": conf_diff <= TOLERANCE,
            "dtw_distance": dist_diff <= TOLERANCE,
            "quality_tier": result["quality_tier"] == exp["quality_tier"],
            "top_landmarks": top_landmarks == exp["top_landmarks"],
            "feedback_text": base["full_text"] == exp["feedback_text"],
        }
        bad = [name for name, ok in checks.items() if not ok]
        print(
            f"[{i}] true={exp['true_sign']:<12} predicted={str(result['predicted_class']):<12} "
            f"conf_diff={conf_diff:.1e} dtw={result['dtw_distance']:.4f} dtw_diff={dist_diff:.1e} "
            f"tier={result['quality_tier']:<8} top={top_landmarks} feedback_identical={checks['feedback_text']} "
            f"{'OK' if not bad else 'FAIL ' + str(bad)}"
        )
        if bad:
            failures.append((i, bad))

    assert not failures, f"pipeline parity failed: {failures}"


def report_normalization():
    """Report only — never fails the test run."""
    z, expected = _load_parity()
    print("\nNormalization report: app normalize_raw_landmarks(raw_i) vs notebook normalized_i")
    for exp in expected:
        i = exp["index"]
        if not exp["has_raw"]:
            print(f"[{i}] no raw landmarks stored")
            continue
        raw, reference = z[f"raw_{i}"], z[f"normalized_{i}"]
        ours = normalize_raw_landmarks(raw)
        if ours is None or ours.shape != reference.shape:
            print(f"[{i}] shape mismatch: ours={None if ours is None else ours.shape} notebook={reference.shape}")
            continue
        diff = np.abs(ours - reference)
        print(
            f"[{i}] frames={raw.shape[0]:<4} raw_nan_fraction={float(np.isnan(raw).mean()):.3f} "
            f"max_abs_diff={float(diff.max()):.2e} mean_abs_diff={float(diff.mean()):.2e}"
        )


if __name__ == "__main__":
    test_pipeline_parity()
    print("PIPELINE PARITY TEST PASSED (10/10)")
    report_normalization()
