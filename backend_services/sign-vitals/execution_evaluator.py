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

import os

import numpy as np

import grading
from feedback_generator import generate_feedback, to_api_deviations, to_api_feedback
from preprocessing import N_HAND_LANDMARKS, N_POSE_LANDMARKS
# Below this the notebook's feedback never names a sign ("couldn't
# confidently identify") — same cutoff as generate_feedback() and
# gloss_feedback_guard.LOW_CONFIDENCE_CUTOFF.
LOW_CONFIDENCE_CUTOFF = 0.35
# Below this (and above the cutoff) the notebook hedges: "wasn't fully
# certain" — same threshold as generate_feedback()'s confidence_threshold.
CONFIDENCE_THRESHOLD = 0.6

# Feedback version (GLOSS_FEEDBACK_VERSION, or the feedback_version argument):
#   "v1" — the thesis-evaluated behaviour, notebook verbatim: the feedback may
#          cite any of the top deviating landmarks.
#   "v2" — default: the feedback only cites hands (and their arm) that the
#          reference sign actually uses. A learner's resting non-signing hand
#          is otherwise often the biggest "difference" for a one-handed sign
#          ("left wrist and left thumb base" for hello), because the reference
#          signer's other hand was never in view.
# Recognition, DTW distance, quality tier and thresholds are identical in
# both versions; only WHICH landmarks the feedback names can differ.
FEEDBACK_VERSIONS = ("v1", "v2")
DEFAULT_FEEDBACK_VERSION = "v2"

# A hand the reference signer never showed is zero-filled before
# normalization, so all its 21 points sit on one spot (size 0); hands that
# were used span 0.5-1.2 shoulder widths in the shipped references.
_UNUSED_HAND_SIZE = 0.01
_HANDS = {
    "left": slice(N_POSE_LANDMARKS, N_POSE_LANDMARKS + N_HAND_LANDMARKS),
    "right": slice(N_POSE_LANDMARKS + N_HAND_LANDMARKS, N_POSE_LANDMARKS + 2 * N_HAND_LANDMARKS),
}


def feedback_version(explicit: str | None = None) -> str:
    # An empty setting (e.g. "GLOSS_FEEDBACK_VERSION=" copied from .env.example) means the default.
    version = explicit or os.environ.get("GLOSS_FEEDBACK_VERSION") or DEFAULT_FEEDBACK_VERSION
    if version not in FEEDBACK_VERSIONS:
        raise ValueError(f"Unknown feedback version {version!r}; expected one of {FEEDBACK_VERSIONS}")
    return version


def unused_hand_sides(sign_id: str) -> set[str]:
    """Sides ("left"/"right", the signer's own) whose hand never appears in
    the sign's reference exemplar."""
    ref = grading.references[sign_id]["sequence"].reshape(-1, grading.N_LANDMARKS, 3)
    unused = set()
    for side, sl in _HANDS.items():
        hand = ref[:, sl, :2]
        size = np.linalg.norm(hand - hand[:, :1], axis=2).max()
        if size < _UNUSED_HAND_SIZE:
            unused.add(side)
    return unused


def _cites_unused_side(landmark: str, unused: set[str]) -> bool:
    """left_hand_*, left_wrist and left_elbow belong to the left hand / arm."""
    return any(
        landmark.startswith(f"{side}_hand_") or landmark in (f"{side}_wrist", f"{side}_elbow")
        for side in unused
    )


def _only_used_hands(normalized_seq, result: dict) -> dict:
    """v2: the same grading result, with top_deviating_landmarks re-ranked
    from the full per-landmark DTW profile and limited to landmarks of hands
    the reference uses. The profile comes from grading's own functions on
    the same inputs as grade(), so distance and tier are unchanged (checked)."""
    predicted = result["predicted_class"]
    unused = unused_hand_sides(predicted)
    if not unused:
        return result
    ref = grading.references[predicted]["sequence"].reshape(-1, grading.N_LANDMARKS, 3)
    isolated, _, _ = grading.isolate_best_attempt(normalized_seq, ref)
    full = grading.evaluate_attempt(isolated, predicted, top_n=grading.N_LANDMARKS)
    if not np.isclose(full["overall_dtw_distance"], result["dtw_distance"]):
        return result  # not the same comparison as grade(): keep the original wording
    kept = [d for d in full["top_deviating_landmarks"] if not _cites_unused_side(d["landmark"], unused)]
    return {**result, "top_deviating_landmarks": kept[: len(result["top_deviating_landmarks"])]}

def evaluate_execution(normalized_seq, target_sign_id, model, feedback_version_override: str | None = None) -> dict:
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

    feedback_version_override: "v1" / "v2" (see FEEDBACK_VERSIONS); defaults
      to GLOSS_FEEDBACK_VERSION, else DEFAULT_FEEDBACK_VERSION.

    Raises: ValueError if the recognised sign has no reference exemplar.
    """
    version = feedback_version(feedback_version_override)
    result = grading.grade(normalized_seq, model)
    if version == "v2" and result["quality_tier"] in ("moderate", "weak"):
        result = _only_used_hands(normalized_seq, result)
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
        "feedback_version": version,
    }
