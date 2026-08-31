"""
execution_evaluator.py
GLOSS component — DTW-based execution quality evaluator.

Given a caregiver's attempt sequence and a target sign, fetches that
sign's stored reference sequence from gloss_sign_references, computes
the DTW distance and alignment path (dtw.py — see that module for how
the distance formula was validated), classifies the result against
class_thresholds.json's strong_max/moderate_max cutoffs for that sign,
and (Phase 7) identifies which body regions deviated most and turns
that into short corrective feedback (feedback_generator.py).

Deliberately independent of any HTTP endpoint / FastAPI app state —
takes the supabase client and thresholds dict as plain arguments — so
it can be unit-tested directly and reused by Phase 8's combined
attempt-submission endpoint without an HTTP round-trip.
"""

import numpy as np

from dtw import dtw_distance_with_path
from feedback_generator import compute_group_deviations, generate_feedback


def evaluate_execution(attempt_sequence, target_sign_id, supabase_client, class_thresholds) -> dict:
    """
    attempt_sequence: (T, 147) variable-length normalized array — the
      `dtw_sequence` output of
      preprocessing.preprocess_landmarks_for_inference().
    target_sign_id: str — must match a gloss_signs.id / a
      class_thresholds.json key (e.g. "pain").
    supabase_client: an initialized supabase client (service role),
      used to fetch the reference sequence from gloss_sign_references.
    class_thresholds: the loaded class_thresholds.json dict.

    Returns:
      {
        "distance": float,
        "quality_tier": "strong"|"moderate"|"weak",
        "deviating_landmarks": [{"group", "friendly_name", "deviation_score"}, ...]  (all 9, sorted),
        "corrective_feedback": {"summary": str, "top_deviating_groups": [...]},
      }

    Raises: ValueError if the target sign has no reference row in
      gloss_sign_references or no class_thresholds entry.
    """
    result = (
        supabase_client.table("gloss_sign_references")
        .select("landmark_sequence")
        .eq("sign_id", target_sign_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise ValueError(f"No reference sequence found for sign_id={target_sign_id!r}")

    reference_sequence = np.array(result.data[0]["landmark_sequence"], dtype=np.float64)

    if target_sign_id not in class_thresholds:
        raise ValueError(f"No class_thresholds entry for sign_id={target_sign_id!r}")

    thresholds = class_thresholds[target_sign_id]
    strong_max = thresholds["strong_max"]
    moderate_max = thresholds["moderate_max"]

    distance, path = dtw_distance_with_path(attempt_sequence, reference_sequence)

    if distance <= strong_max:
        quality_tier = "strong"
    elif distance <= moderate_max:
        quality_tier = "moderate"
    else:
        quality_tier = "weak"

    deviating_landmarks = compute_group_deviations(attempt_sequence, reference_sequence, path)
    corrective_feedback = generate_feedback(quality_tier, deviating_landmarks)

    return {
        "distance": distance,
        "quality_tier": quality_tier,
        "deviating_landmarks": deviating_landmarks,
        "corrective_feedback": corrective_feedback,
    }
