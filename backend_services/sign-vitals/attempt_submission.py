"""
attempt_submission.py
GLOSS component — Phase 8: the real, combined attempt-submission flow.

Wires together landmark extraction + preprocessing (Phase 0/1),
recognition (Phase 3), DTW execution evaluation + corrective feedback
(Phase 4/7, with the guarded Gemini rewording), persistence, mastery
update (Phase 5), and next-lesson selection (Phase 6) into one call. This is what the frontend actually
calls — unlike /gloss/attempts/recognize and /gloss/attempts/evaluate,
which stay internal/testing utilities for their individual pipelines.

Independent of any HTTP endpoint / FastAPI app state — takes plain
arguments (including the model/class-names/thresholds, the same
dependency-injection pattern as execution_evaluator.py and
mastery_engine.py) and returns a plain dict, so it's testable directly.
caregiver_profile_id must already be server-derived (see
auth_helper.get_authenticated_caregiver) — this function never
accepts or trusts a client-supplied one.
"""

import logging
import time
from contextlib import contextmanager

import numpy as np

from execution_evaluator import evaluate_execution
from extract_landmarks_bridge import NoLandmarksExtractedError, extract_landmarks_via_subprocess
from gemini_feedback import feedback_text
from lesson_selector import select_next_lesson
from mastery_engine import compute_execution_score, update_mastery
from preprocessing import normalize_raw_landmarks

logger = logging.getLogger("sign_vitals")


class _Timings:
    """Task 6 instrumentation — records wall-clock ms per pipeline stage
    for one attempt. Additive only: exposed as an extra `timings` key on
    the response, no existing field changes. `stage()` is a context
    manager so stages can't be accidentally left unclosed."""

    def __init__(self):
        self._marks: dict[str, float] = {}
        self._t0 = time.perf_counter()

    @contextmanager
    def stage(self, name: str):
        start = time.perf_counter()
        try:
            yield
        finally:
            self._marks[name] = round((time.perf_counter() - start) * 1000, 1)

    def last(self, name: str) -> float:
        """ms recorded for the most recently completed `stage(name)` block
        (0.0 if that stage hasn't run) — read-only, for logging."""
        return self._marks.get(name, 0.0)

    def as_dict(self) -> dict:
        out = dict(self._marks)
        out["total_ms"] = round((time.perf_counter() - self._t0) * 1000, 1)
        return out


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
        logger.info("[GLOSS][DB] session verified | session=%s", str(session_id)[:8])
        return session_id

    created = (
        supabase_client.table("gloss_learning_sessions")
        .insert({"caregiver_profile_id": caregiver_profile_id})
        .execute()
    )
    new_session_id = created.data[0]["id"]
    logger.info("[GLOSS][DB] session created | session=%s", str(new_session_id)[:8])
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
    model, class_names, class_thresholds: the same startup-loaded
      resources main.py's other endpoints use (the scaler and DTW
      references are grading.py's startup-loaded globals).

    Returns the response dict described in the Phase 8 design (see
    main.py's POST /gloss/attempts docstring).

    Raises: AttemptError for any 400/403 business-logic failure.
    """
    logger.info(
        "[GLOSS][ATTEMPT] processing | caregiver=%s | target=%s | type=%s",
        str(caregiver_profile_id)[:8], target_sign_id, attempt_type,
    )

    timings = _Timings()

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

    with timings.stage("validate_sign_and_session"):
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

    # Diagnostic summary — additive, returned as `diagnostics` and logged.
    # Lets us tell at a glance whether a wrong recognition is a model
    # problem or a capture problem, without re-running anything.
    # server_side_mirroring is hard-coded False: the backend never
    # flips landmarks; the frontend "Mirror" control is display-only on
    # the 2D guide and never touches the recorded video or this pipeline.
    diagnostics: dict = {
        "attempt_type": attempt_type,
        "target_sign_id": target_sign_id,
        "server_side_mirroring": False,
    }

    if attempt_type == "webcam":
        # Landmarks are extracted ONCE and normalized ONCE here; the
        # same `normalized` sequence feeds both recognition and DTW
        # grading (grading.grade_learner_attempt, the notebook pipeline).
        # No second decode, no second extraction, no second normalization.
        with timings.stage("landmark_extraction"):
            try:
                raw = extract_landmarks_via_subprocess(video_path)
            except NoLandmarksExtractedError:
                raise AttemptError(400, "Could not extract usable landmarks from video")
        logger.info(
            "[GLOSS][INFERENCE] landmark extraction completed | frames=%d | extract_ms=%s",
            int(raw.shape[0]), timings.last("landmark_extraction"),
        )

        with timings.stage("preprocessing"):
            normalized = normalize_raw_landmarks(raw)
        if normalized is None:
            raise AttemptError(400, "Could not extract usable landmarks from video")
        logger.info(
            "[GLOSS][INFERENCE] preprocessing completed | normalized=%s | preprocessing_ms=%s",
            tuple(normalized.shape), timings.last("preprocessing"),
        )

        logger.info("[GLOSS][INFERENCE] recognition + DTW grading started")
        with timings.stage("recognition_and_grading"):
            eval_result = evaluate_execution(normalized, target_sign_id, model)
            grading_result = eval_result["result"]
            prediction = grading_result["probs"]  # (59,)
            recognized_sign_id = str(grading_result["predicted_class"])
            recognition_confidence = grading_result["tcn_confidence"]

        # Capture-quality + top-3 diagnostics (cheap; does not change the
        # prediction). Raw landmark array is (T, 49, 3), NaN where a
        # landmark was not detected by MediaPipe.
        top3_idx = [int(i) for i in np.argsort(prediction)[::-1][:3]]
        diagnostics["top3"] = [
            {"sign_id": class_names[i], "confidence": float(prediction[i])} for i in top3_idx
        ]
        raw_frame_count = int(raw.shape[0])
        fully_undetected_frames = int(np.isnan(raw).all(axis=(1, 2)).sum())
        missing_landmark_fraction = float(np.isnan(raw).mean())
        diagnostics["raw_frame_count"] = raw_frame_count
        diagnostics["fully_undetected_frames"] = fully_undetected_frames
        diagnostics["missing_landmark_fraction"] = round(missing_landmark_fraction, 4)
        diagnostics["preprocessing"] = (
            "notebook-parity: interpolate_missing -> normalize (translate/scale/rotate) "
            "-> [first repetition if several] -> resample 60 frames -> kinematic 147->441 "
            "-> standardize (gloss_assets/feature_scaler.npz)"
        )
        diagnostics["was_multi_attempt"] = bool(grading_result["was_multi_attempt"])
        diagnostics["n_repetitions_detected"] = int(grading_result["n_repetitions_detected"])

        logger.info(
            "[GLOSS][INFERENCE] recognition completed | target=%s | predicted=%s | confidence=%.4f "
            "| top3=%s | recognition_and_grading_ms=%s",
            target_sign_id, recognized_sign_id, recognition_confidence,
            [(d["sign_id"], round(d["confidence"], 3)) for d in diagnostics["top3"]],
            timings.last("recognition_and_grading"),
        )
        logger.info(
            "[GLOSS][INFERENCE] capture quality | frames=%d | undetected=%d | missing_landmark_fraction=%.3f",
            raw_frame_count, fully_undetected_frames, missing_landmark_fraction,
        )
        if missing_landmark_fraction > 0.6 or (
            raw_frame_count and fully_undetected_frames / raw_frame_count > 0.25
        ):
            logger.warning(
                "[GLOSS][INFERENCE][WARNING] low landmark quality | target=%s | missing_fraction=%.3f "
                "| undetected=%d/%d — recognition unreliable (framing/lighting/hands out of frame)",
                target_sign_id, missing_landmark_fraction, fully_undetected_frames, raw_frame_count,
            )

        is_correct_sign = eval_result["is_correct_sign"]
        corrective_feedback = eval_result["corrective_feedback"]

        if is_correct_sign:
            quality_tier = eval_result["quality_tier"]
            deviating_landmarks = eval_result["deviating_landmarks"]
            thresholds = class_thresholds[target_sign_id]
            execution_score = compute_execution_score(
                eval_result["distance"], thresholds["strong_max"], thresholds["moderate_max"]
            )
            logger.info(
                "[GLOSS][DTW] execution scored | distance=%.4f | quality=%s | score=%.4f",
                eval_result["distance"], quality_tier, execution_score,
            )
        else:
            logger.info("[GLOSS][DTW] execution scoring skipped | predicted sign != target")

        # Guarded Gemini rewording of the notebook's rule-based text
        # (gloss_feedback_guard.safe_feedback_text). Falls back to the
        # rule-based text if GEMINI_API_KEY is unset, the call fails, or
        # the reply isn't faithful. The app's own mismatch sentence is
        # never sent to Gemini.
        if eval_result["rewordable"]:
            with timings.stage("feedback_rewording"):
                corrective_feedback["summary"] = feedback_text(grading_result, eval_result["base"])

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
        diagnostics["selected_sign_id"] = selected_sign_id
        diagnostics["note"] = "quiz answer — no landmark extraction, no model inference, no movement scoring"
        logger.info(
            "[GLOSS][ATTEMPT] multiple-choice recorded | target=%s | selected=%s | correct=%s",
            target_sign_id, selected_sign_id, is_correct_sign,
        )

    diagnostics["predicted_sign_id"] = recognized_sign_id
    diagnostics["confidence"] = recognition_confidence
    diagnostics["is_correct_sign"] = is_correct_sign

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
    with timings.stage("persist_attempt"):
        inserted = supabase_client.table("gloss_attempts").insert(attempt_row).execute()
        attempt_id = inserted.data[0]["id"]
    logger.info("[GLOSS][DB] attempt persisted | attempt_id=%s", str(attempt_id)[:8])

    with timings.stage("mastery_update"):
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
        "[GLOSS][MASTERY] updated | sign=%s | status=%s | strong_streak=%s",
        target_sign_id, mastery_row["mastery_status"], mastery_row["consecutive_strong_streak"],
    )

    with timings.stage("next_lesson_selection"):
        next_sign = select_next_lesson(supabase_client, caregiver_profile_id)
    logger.info("[GLOSS][RECOMMENDATION] next sign selected | sign=%s", next_sign)

    stage_timings = timings.as_dict()
    logger.info(
        "[GLOSS][ATTEMPT] pipeline timings (ms) | %s",
        " | ".join(f"{k}={v}" for k, v in stage_timings.items()),
    )

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
        # Task 6 instrumentation — additive; existing consumers ignore it.
        "timings": stage_timings,
        # Diagnostic summary — additive; predicted/expected/confidence/top-3,
        # capture quality, preprocessing description, mirroring flag.
        "diagnostics": diagnostics,
    }
