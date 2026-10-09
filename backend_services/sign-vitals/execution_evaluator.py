"""
execution_evaluator.py
GLOSS component — grades one attempt against the sign the caregiver was
asked to perform.

Thin app-side wrapper around the notebook pipeline: grading.py
(recognise, then DTW-grade against the recognised sign's reference
exemplar and the v3 thresholds) and feedback_generator.py (the
thesis's rule-based wording). All it adds is the tutoring context the
notebook doesn't have — the TARGET sign — and the mapping into the
API's existing response fields.

Deliberately independent of any HTTP endpoint / FastAPI app state, so
it can be tested directly (see tests/test_pipeline_parity.py).
"""

import grading
from feedback_generator import generate_feedback, to_api_deviations, to_api_feedback

# Below this the notebook's feedback never names a sign ("couldn't
# confidently identify") — same cutoff as generate_feedback() and
# gloss_feedback_guard.LOW_CONFIDENCE_CUTOFF.
LOW_CONFIDENCE_CUTOFF = 0.35
# Below this (and above the cutoff) the notebook hedges: "wasn't fully
# certain" — same threshold as generate_feedback()'s confidence_threshold.
CONFIDENCE_THRESHOLD = 0.6


def evaluate_execution(normalized_seq, target_sign_id, model) -> dict:
    """
    normalized_seq: (T, 49, 3) variable-length normalized array —
      preprocessing.normalize_raw_landmarks()'s output.
    target_sign_id: str — the sign the caregiver was asked to perform.
    model: the startup-loaded ensemble (recogniser.load_ensemble()).

    Returns:
      {
        "result": grade_learner_attempt() dict (notebook values, plus "probs"),
        "base": generate_feedback(result) dict (notebook values),
        "is_correct_sign": bool — recognised sign == target sign,
        "rewordable": bool — whether corrective_feedback["summary"] is
          the notebook's rule-based text (and so may go through the
          Gemini guard),
        "distance": float | None,
        "quality_tier": "strong"|"moderate"|"weak" | None,
        "deviating_landmarks": [{"group", "friendly_name", "deviation_score"}, ...] | None,
        "corrective_feedback": {"summary": str, "top_deviating_groups": [...]},
      }

    distance / quality_tier / deviating_landmarks are None when the
    recognised sign isn't the target: the notebook grades execution
    against the RECOGNISED sign's reference, which says nothing about
    how well the target sign was performed.

    Raises: ValueError if the recognised sign has no reference exemplar.
    """
    result = grading.grade(normalized_seq, model)
    base = generate_feedback(result)
    predicted = result["predicted_class"]
    is_correct_sign = predicted == target_sign_id

    if is_correct_sign or result["tcn_confidence"] < LOW_CONFIDENCE_CUTOFF:
        corrective_feedback = to_api_feedback(result, base)
        rewordable = True
    else:
        # Recognised as a different sign. The notebook has no target
        # sign, so it has no wording for this case — this is the app's
        # own sentence, hedged below CONFIDENCE_THRESHOLD exactly where
        # the notebook hedges ("wasn't fully certain"), so a learner is
        # never told firmly they signed the wrong sign when the model
        # isn't sure (e.g. pain/hurt at ~0.45). Never sent to Gemini.
        if result["tcn_confidence"] < CONFIDENCE_THRESHOLD:
            summary = (
                f"This looked more like '{predicted}' than '{target_sign_id}', though the system "
                f"wasn't fully certain. Please try '{target_sign_id}' again."
            )
        else:
            summary = (
                f"This was recognized as '{predicted}', not '{target_sign_id}'. "
                f"Try performing the sign for '{target_sign_id}' again."
            )
        corrective_feedback = {"summary": summary, "top_deviating_groups": []}
        rewordable = False

    return {
        "result": result,
        "base": base,
        "is_correct_sign": is_correct_sign,
        "rewordable": rewordable,
        "distance": result["dtw_distance"] if is_correct_sign else None,
        "quality_tier": result["quality_tier"] if is_correct_sign else None,
        "deviating_landmarks": (
            to_api_deviations(result["top_deviating_landmarks"]) if is_correct_sign else None
        ),
        "corrective_feedback": corrective_feedback,
    }
