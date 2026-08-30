"""
attempt_submission.py
GLOSS component — Phase 8: the real, combined attempt-submission flow.

Wires together landmark extraction + preprocessing (Phase 0/1),
recognition (Phase 3), DTW execution evaluation + corrective feedback
(Phase 4/7), persistence, mastery update (Phase 5), and next-lesson
selection (Phase 6) into one call. This is what the frontend actually
calls — unlike /gloss/attempts/recognize and /gloss/attempts/evaluate,
which stay internal/testing utilities for their individual pipelines.

Independent of any HTTP endpoint / FastAPI app state — takes plain
arguments (including the model/scaler/class-names/thresholds, the same
dependency-injection pattern as execution_evaluator.py and
mastery_engine.py) and returns a plain dict, so it's testable directly.
caregiver_profile_id must already be server-derived (see
auth_helper.get_authenticated_caregiver) — this function never
accepts or trusts a client-supplied one.
"""

import logging

import numpy as np

from execution_evaluator import evaluate_execution
from extract_landmarks_bridge import NoLandmarksExtractedError, extract_landmarks_via_subprocess
from lesson_selector import select_next_lesson
from mastery_engine import compute_execution_score, update_mastery
from preprocessing import preprocess_landmarks_for_inference

logger = logging.getLogger("sign_vitals")


class AttemptError(Exception):
    """Raised for any business-logic failure in submit_attempt(). The
    caller maps status_code directly to an HTTPException."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _resolve_session(supabase_client, caregiver_profile_id: str, session_id: str | None) -> str:
    if session_id:
        result = (
            supabase_client.table("gloss_learning_sessions")
            .select("id, caregiver_profile_id")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            raise AttemptError(403, f"session_id {session_id!r} not found")
        if result.data[0]["caregiver_profile_id"] != caregiver_profile_id:
            raise AttemptError(403, "session_id does not belong to this caregiver")
        logger.info("session verified: session_id=%s", session_id)
        return session_id

    created = (
        supabase_client.table("gloss_learning_sessions")
        .insert({"caregiver_profile_id": caregiver_profile_id})
        .execute()
    )
    new_session_id = created.data[0]["id"]
    logger.info("new session created: session_id=%s", new_session_id)
    return new_session_id


def submit_attempt(
    supabase_client,
    caregiver_profile_id: str,
    target_sign_id: str,
    attempt_type: str,
    session_id: str | None = None,
    video_path: str | None = None,
    selected_sign_id: str | None = None,
    model=None,
    class_names=None,
    scaler_mean=None,
    scaler_std=None,
    class_thresholds=None,
) -> dict:
    """
    caregiver_profile_id: server-derived (never client-supplied).
    target_sign_id: the sign the caregiver was asked to perform.
    attempt_type: "webcam" or "multiple_choice".
    session_id: optional existing gloss_learning_sessions id — verified
      to belong to this caregiver, or a new session is created.
    video_path: path to the attempt clip — required for "webcam",
      forbidden for "multiple_choice".
    selected_sign_id: the sign the caregiver picked in the MC UI —
      required for "multiple_choice", forbidden for "webcam".
    model, class_names, scaler_mean, scaler_std, class_thresholds:
      the same startup-loaded resources main.py's other endpoints use.

    Returns the response dict described in the Phase 8 design (see
    main.py's POST /gloss/attempts docstring).

    Raises: AttemptError for any 400/403 business-logic failure.
    """
    logger.info(
        "attempt received: caregiver_profile_id=%s target_sign_id=%s attempt_type=%s",
        caregiver_profile_id, target_sign_id, attempt_type,
    )

    if attempt_type not in ("webcam", "multiple_choice"):
        raise AttemptError(400, f"attempt_type must be 'webcam' or 'multiple_choice', got {attempt_type!r}")

    if attempt_type == "webcam":
        if not video_path:
            raise AttemptError(400, "webcam attempts require a video file")
        if selected_sign_id is not None:
            raise AttemptError(400, "selected_sign_id must not be provided for webcam attempts")
    else:
        if not selected_sign_id:
            raise AttemptError(400, "multiple_choice attempts require selected_sign_id")
        if video_path is not None:
            raise AttemptError(400, "video must not be provided for multiple_choice attempts")

    sign_check = supabase_client.table("gloss_signs").select("id").eq("id", target_sign_id).limit(1).execute()
    if not sign_check.data:
        raise AttemptError(400, f"Unknown target_sign_id: {target_sign_id!r}")

    session_id = _resolve_session(supabase_client, caregiver_profile_id, session_id)

    recognized_sign_id = None
    recognition_confidence = None
    quality_tier = None
    execution_score = None
    deviating_landmarks = None
    corrective_feedback = None

    if attempt_type == "webcam":
        try:
            raw = extract_landmarks_via_subprocess(video_path)
        except NoLandmarksExtractedError:
            raise AttemptError(400, "Could not extract usable landmarks from video")
        logger.info("landmarks extracted: shape=%s", raw.shape)

        tensor, _positional, dtw_sequence = preprocess_landmarks_for_inference(raw, scaler_mean, scaler_std)
        if tensor is None:
            raise AttemptError(400, "Could not extract usable landmarks from video")
        logger.info("preprocessing done: tensor_shape=%s", tensor.shape)

        prediction = model.predict(tensor, verbose=0)[0]  # (59,)
        class_index = int(np.argmax(prediction))
        recognized_sign_id = class_names[class_index]
        recognition_confidence = float(prediction[class_index])
        logger.info(
            "recognition done: recognized_sign_id=%s confidence=%.4f",
            recognized_sign_id, recognition_confidence,
        )

        is_correct_sign = recognized_sign_id == target_sign_id

        if is_correct_sign:
            eval_result = evaluate_execution(dtw_sequence, target_sign_id, supabase_client, class_thresholds)
            quality_tier = eval_result["quality_tier"]
            deviating_landmarks = eval_result["deviating_landmarks"]
            corrective_feedback = eval_result["corrective_feedback"]
            moderate_max = class_thresholds[target_sign_id]["moderate_max"]
            execution_score = compute_execution_score(eval_result["distance"], moderate_max)
            logger.info(
                "evaluation done: distance=%.2f quality_tier=%s execution_score=%.4f",
                eval_result["distance"], quality_tier, execution_score,
            )
        else:
            corrective_feedback = {
                "summary": (
                    f"This was recognized as '{recognized_sign_id}', not '{target_sign_id}'. "
                    f"Try performing the sign for '{target_sign_id}' again."
                ),
                "top_deviating_groups": [],
            }
            logger.info("evaluation skipped: recognized sign did not match target")

    else:  # multiple_choice
        recognized_sign_id = selected_sign_id
        is_correct_sign = selected_sign_id == target_sign_id
        if is_correct_sign:
            corrective_feedback = {"summary": "Correct!", "top_deviating_groups": []}
        else:
            corrective_feedback = {
                "summary": f"That wasn't the right sign — the correct answer was '{target_sign_id}'.",
                "top_deviating_groups": [],
            }
        logger.info(
            "multiple_choice recorded: selected=%s is_correct_sign=%s",
            selected_sign_id, is_correct_sign,
        )

    attempt_row = {
        "caregiver_profile_id": caregiver_profile_id,
        "session_id": session_id,
        "target_sign_id": target_sign_id,
        "recognized_sign_id": recognized_sign_id,
        "recognition_confidence": recognition_confidence,
        "execution_score": execution_score,
        "quality_tier": quality_tier,
        "deviating_landmarks": deviating_landmarks,
        "corrective_feedback": corrective_feedback,
        "attempt_type": attempt_type,
    }
    inserted = supabase_client.table("gloss_attempts").insert(attempt_row).execute()
    attempt_id = inserted.data[0]["id"]
    logger.info("attempt persisted: attempt_id=%s", attempt_id)

    mastery_row = update_mastery(
        supabase_client,
        caregiver_profile_id,
        target_sign_id,
        attempt_type=attempt_type,
        is_correct_sign=is_correct_sign,
        quality_tier=quality_tier,
        execution_score=execution_score,
    )
    logger.info(
        "mastery updated: sign_id=%s status=%s streak=%s",
        target_sign_id, mastery_row["mastery_status"], mastery_row["consecutive_strong_streak"],
    )

    next_sign = select_next_lesson(supabase_client, caregiver_profile_id)
    logger.info("next lesson selected: sign_id=%s", next_sign)

    return {
        "attempt_id": attempt_id,
        "session_id": session_id,
        "is_correct_sign": is_correct_sign,
        "recognized_sign_id": recognized_sign_id,
        "recognition_confidence": recognition_confidence,
        "quality_tier": quality_tier,
        "execution_score": execution_score,
        "corrective_feedback": corrective_feedback,
        "mastery": mastery_row,
        "next_recommended_sign_id": next_sign,
    }
