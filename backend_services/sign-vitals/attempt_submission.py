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

from capture_gates import check_capture
import grading
from execution_evaluator import CONFIDENCE_THRESHOLD, LOW_CONFIDENCE_CUTOFF, evaluate_execution
from extract_landmarks_bridge import NoLandmarksExtractedError, extract_landmarks_via_subprocess
from gemini_feedback import feedback_text
from lesson_selector import select_next_lesson
import feedback_async
from mastery_engine import _fetch_existing_row, compute_execution_score, get_mastery, next_mastery_row, update_mastery
from preprocessing import normalize_raw_landmarks
from progress_store import (
    MIGRATIONS_NEEDED, POOL, active_sign_ids, caregiver_timezone, load_context, load_mastery_rows,
    next_lesson_in_memory, record_attempt, schema_ready,
)
from sign_config import PIPELINE_VERSION
from stage_timing import TimedDb, db_summary, instrument_grading, start_detail, take_detail

logger = logging.getLogger("sign_vitals")

# Splits recognition + DTW into sub-stages, only if GLOSS_TIMING_DETAIL=1.
instrument_grading()

# Every attempt response carries one of these, so the UI never has to
# infer the result from is_correct_sign / recognized_sign_id:
#   capture_rejected — a capture gate stopped the clip before the model
#                      ran (hands not visible / no movement). Nothing is
#                      stored and mastery is unchanged.
#   not_recognised   — the model ran but top-1 confidence was below
#                      LOW_CONFIDENCE_CUTOFF. No sign is named, nothing is
#                      graded, mastery is unchanged; the attempt is stored
#                      with recognized_sign_id NULL.
#   different_sign   — confidently recognised as another sign.
#   target_sign      — recognised as the target sign, then DTW-graded.
#   quiz_correct / quiz_wrong — multiple_choice answers.
OUTCOME_CAPTURE_REJECTED = "capture_rejected"
OUTCOME_NOT_RECOGNISED = "not_recognised"
OUTCOME_DIFFERENT_SIGN = "different_sign"
OUTCOME_TARGET_SIGN = "target_sign"
OUTCOME_QUIZ_CORRECT = "quiz_correct"
OUTCOME_QUIZ_WRONG = "quiz_wrong"
# Check my sign (mode='free'): what the camera thinks was signed.
OUTCOME_FREE_MATCH = "free_match"        # top confidence >= CONFIDENCE_THRESHOLD (0.6)
OUTCOME_FREE_MAYBE = "free_maybe"        # LOW_CONFIDENCE_CUTOFF (0.35) .. 0.6
OUTCOME_FREE_NO_MATCH = "free_no_match"  # below 0.35
FREE_SECOND_GUESS_MIN = 0.2              # a second suggestion is shown only from here

MODES = ("practice", "recall", "free")


class _Timings:
    """Task 6 instrumentation — records wall-clock ms per pipeline stage
    for one attempt. Additive only: exposed as an extra `timings` key on
    the response, no existing field changes. `stage()` is a context
    manager so stages can't be accidentally left unclosed."""

    def __init__(self):
        self._marks: dict[str, float] = {}
        self._t0 = time.perf_counter()
        # Sub-stage breakdowns (extraction, grading detail, Supabase calls).
        self.extra: dict = {}

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
        out.update(self.extra)
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
    """Returns the session this attempt belongs to. A session id that is
    missing, expired or not this caregiver's never blocks practice: a new
    session is started instead (the attempt is never added to someone
    else's session). The response's session_id tells the client which
    one was used."""
    if session_id:
        result = (
            supabase_client.table("gloss_learning_sessions")
            .select("id, caregiver_profile_id")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        if result.data and result.data[0]["caregiver_profile_id"] == caregiver_profile_id:
            logger.info("[GLOSS][DB] session verified | session=%s", str(session_id)[:8])
            return session_id
        logger.warning(
            "[GLOSS][DB][WARNING] session %s | session=%s — starting a new session",
            "belongs to another caregiver" if result.data else "not found",
            str(session_id)[:8],
        )

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
    mode: str = "practice",
) -> dict:
    """
    caregiver_profile_id: server-derived (never client-supplied).
    target_sign_id: the sign the caregiver was asked to perform (None for
      mode='free').
    mode: "practice" (lesson flow), "recall" (word only, from memory; graded
      exactly like practice) or "free" (Check my sign: no target, the camera
      names the sign; stored but never counted toward progress). Recall and
      free need migrations 0045-0047.
    attempt_type: "webcam" or "multiple_choice".
    session_id: optional existing gloss_learning_sessions id — used if it
      exists and belongs to this caregiver; otherwise (missing, expired,
      someone else's) a new session is created and practice carries on.
    video_path: path to the attempt clip — required for "webcam",
      forbidden for "multiple_choice".
    selected_sign_id: the sign the caregiver picked in the MC UI —
      required for "multiple_choice", forbidden for "webcam".
    model, class_names, class_thresholds: the same startup-loaded
      resources main.py's other endpoints use (the scaler and DTW
      references are grading.py's startup-loaded globals).

    Returns the response dict described in the Phase 8 design (see
    main.py's POST /gloss/attempts docstring).

    Raises: AttemptError for any 400 business-logic failure.
    """
    logger.info(
        "[GLOSS][ATTEMPT] processing | caregiver=%s | target=%s | type=%s",
        str(caregiver_profile_id)[:8], target_sign_id, attempt_type,
    )

    timings = _Timings()
    # Time every Supabase round trip (main.py passes one that already
    # holds the auth calls).
    if not isinstance(supabase_client, TimedDb):
        supabase_client = TimedDb(supabase_client)

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

    if mode not in MODES:
        raise AttemptError(400, f"mode must be one of {MODES}, got {mode!r}")
    if mode != "practice" and attempt_type != "webcam":
        raise AttemptError(400, f"{mode} attempts are camera attempts")
    if mode == "free":
        if target_sign_id:
            raise AttemptError(400, "free attempts have no target sign")
    elif not target_sign_id:
        raise AttemptError(400, "target_sign_id is required")
    # Migrations 0045-0047 applied? Until then the original practice write
    # path is used and the new modes are unavailable.
    progress_ready = schema_ready(supabase_client)
    if mode != "practice" and not progress_ready:
        raise AttemptError(503, MIGRATIONS_NEEDED)

    prefetch: dict = {}
    with timings.stage("validate_sign_and_session"):
        if progress_ready:
            # Catalogue from cache; the reads this attempt needs start now, on
            # worker threads, so they run while MediaPipe works.
            if mode != "free" and target_sign_id not in active_sign_ids(supabase_client):
                raise AttemptError(400, f"Unknown target_sign_id: {target_sign_id!r}")
            cg, tz = caregiver_profile_id, caregiver_timezone(supabase_client, caregiver_profile_id)
            prefetch["session"] = POOL.submit(_resolve_session, supabase_client, cg, session_id)
            if mode != "free":
                prefetch["mastery"] = POOL.submit(_fetch_existing_row, supabase_client, cg, target_sign_id)
                prefetch["all_mastery"] = POOL.submit(load_mastery_rows, supabase_client, cg)
                prefetch["context"] = POOL.submit(load_context, supabase_client, cg, target_sign_id, tz)
            prefetch["timezone"] = tz
        else:
            if mode != "free":
                sign_check = supabase_client.table("gloss_signs").select("id").eq("id", target_sign_id).limit(1).execute()
                if not sign_check.data:
                    raise AttemptError(400, f"Unknown target_sign_id: {target_sign_id!r}")
            session_id = _resolve_session(supabase_client, caregiver_profile_id, session_id)

    def session() -> str:
        """The session id (from the parallel read once it is needed)."""
        nonlocal session_id
        if "session" in prefetch:
            session_id = prefetch.pop("session").result()
        return session_id

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
        extraction_detail: dict = {}
        with timings.stage("landmark_extraction"):
            try:
                raw = extract_landmarks_via_subprocess(video_path, timings=extraction_detail)
            except NoLandmarksExtractedError:
                raise AttemptError(400, "Could not extract usable landmarks from video")
        timings.extra["extraction_detail"] = extraction_detail
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

        # Capture gates — before the model, so an empty frame or hands
        # out of view gets a camera message instead of a wrong sign name.
        capture = check_capture(raw, normalized)
        diagnostics["capture_check"] = capture
        if not capture["passed"]:
            logger.info(
                "[GLOSS][GATE] clip rejected before inference | reason=%s | hand_presence=%.3f "
                "| motion_extent=%.3f — not stored, mastery unchanged",
                capture["reason"], capture["hand_presence"], capture["motion_extent"],
            )
            return {
                "outcome": OUTCOME_CAPTURE_REJECTED,
                "mode": mode,
                "session_id": session(),
                "capture_check": capture,
                "message": capture["message"],
                "timings": {**timings.as_dict(), **db_summary(supabase_client.calls)},
                "diagnostics": diagnostics,
            }

        if mode == "free":
            return _free_attempt(supabase_client, caregiver_profile_id, session(), normalized, raw,
                                 model, class_names, capture, diagnostics, timings)

        logger.info("[GLOSS][INFERENCE] recognition + DTW grading started")
        start_detail()
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
        diagnostics["feedback_version"] = eval_result["feedback_version"]

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

        # Below the cut-off the notebook's own feedback never names a sign
        # ("couldn't confidently identify"), so neither does the stored
        # attempt nor the response — even when top-1 happens to equal the
        # target. Such an attempt is not graded and does not touch mastery.
        not_recognised = recognition_confidence < LOW_CONFIDENCE_CUTOFF
        if not_recognised:
            recognized_sign_id = None
            is_correct_sign = False
            outcome = OUTCOME_NOT_RECOGNISED
        else:
            is_correct_sign = eval_result["is_correct_sign"]
            outcome = OUTCOME_TARGET_SIGN if is_correct_sign else OUTCOME_DIFFERENT_SIGN
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
        elif not_recognised:
            logger.info(
                "[GLOSS][DTW] execution scoring skipped | confidence %.4f < %.2f — not recognised",
                recognition_confidence, LOW_CONFIDENCE_CUTOFF,
            )
        else:
            logger.info("[GLOSS][DTW] execution scoring skipped | predicted sign != target")

        # Guarded Gemini rewording of the notebook's rule-based text
        # (gloss_feedback_guard.safe_feedback_text). Falls back to the
        # rule-based text if GEMINI_API_KEY is unset, the call fails, or
        # the reply isn't faithful. The app's own mismatch sentence is
        # never sent to Gemini.
        # The Gemini rewording runs after the response (feedback_async) when
        # the new schema is in; before it, it runs inline as it always did.
        if eval_result["rewordable"] and not progress_ready:
            with timings.stage("feedback_rewording"):
                corrective_feedback["summary"] = feedback_text(grading_result, eval_result["base"])
        grading_detail = take_detail()
        if grading_detail:
            timings.extra["grading_detail"] = grading_detail

    else:  # multiple_choice
        not_recognised = False
        recognized_sign_id = selected_sign_id
        is_correct_sign = selected_sign_id == target_sign_id
        outcome = OUTCOME_QUIZ_CORRECT if is_correct_sign else OUTCOME_QUIZ_WRONG
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
        "session_id": session(),
        "target_sign_id": target_sign_id,
        "recognized_sign_id": recognized_sign_id,
        "recognition_confidence": recognition_confidence,
        "execution_score": execution_score,
        "quality_tier": quality_tier,
        "deviating_landmarks": deviating_landmarks,
        "corrective_feedback": corrective_feedback,
        "attempt_type": attempt_type,
    }
    new_milestones = []
    feedback_pending = False
    if progress_ready:
        # Attempt + mastery row + newly earned milestones, one transaction.
        attempt_row["mode"] = mode
        attempt_row["pipeline_version"] = PIPELINE_VERSION
        with timings.stage("mastery_update"):
            existing = prefetch["mastery"].result()
            if not_recognised:
                mastery_row = {"caregiver_profile_id": caregiver_profile_id, "sign_id": target_sign_id, **existing}
                pending_mastery = None
            else:
                mastery_row = pending_mastery = next_mastery_row(
                    supabase_client, caregiver_profile_id, target_sign_id, attempt_type=attempt_type,
                    is_correct_sign=is_correct_sign, quality_tier=quality_tier, execution_score=execution_score,
                    existing=existing,
                )
        with timings.stage("persist_attempt"):
            stored = record_attempt(supabase_client, attempt_row, pending_mastery,
                                    context=prefetch["context"].result(), timezone=prefetch["timezone"])
            attempt_id = stored["attempt_id"]
            new_milestones = stored["new_milestones"]
        feedback_pending = (
            attempt_type == "webcam" and eval_result["rewordable"]
            and feedback_async.start(supabase_client._client if isinstance(supabase_client, TimedDb) else supabase_client,
                                     attempt_id, caregiver_profile_id, grading_result, eval_result["base"], corrective_feedback)
        )
        logger.info(
            "[GLOSS][DB] attempt persisted | attempt_id=%s | mode=%s | new milestones=%s",
            str(attempt_id)[:8], mode, [m["key"] for m in new_milestones],
        )
    else:
        with timings.stage("persist_attempt"):
            inserted = supabase_client.table("gloss_attempts").insert(attempt_row).execute()
            attempt_id = inserted.data[0]["id"]
        logger.info("[GLOSS][DB] attempt persisted | attempt_id=%s", str(attempt_id)[:8])

        with timings.stage("mastery_update"):
            if not_recognised:
                mastery_row = get_mastery(supabase_client, caregiver_profile_id, target_sign_id)
            else:
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
            "[GLOSS][MASTERY] %s | sign=%s | status=%s | strong_streak=%s",
            "unchanged (not recognised)" if not_recognised else "updated",
            target_sign_id, mastery_row["mastery_status"], mastery_row["consecutive_strong_streak"],
        )

    with timings.stage("next_lesson_selection"):
        if progress_ready:
            next_sign = next_lesson_in_memory(active_sign_ids(supabase_client), prefetch["all_mastery"].result(),
                                              pending_mastery)
        else:
            next_sign = select_next_lesson(supabase_client, caregiver_profile_id)
    logger.info("[GLOSS][RECOMMENDATION] next sign selected | sign=%s", next_sign)

    stage_timings = {**timings.as_dict(), **db_summary(supabase_client.calls)}
    logger.info(
        "[GLOSS][ATTEMPT] pipeline timings (ms) | %s",
        " | ".join(f"{k}={v}" for k, v in stage_timings.items() if k != "supabase_calls"),
    )
    logger.info(
        "[GLOSS][ATTEMPT] supabase calls (ms) | %s",
        " | ".join(f"{c['call']}={c['ms']}" for c in stage_timings["supabase_calls"]),
    )

    return {
        "outcome": outcome,
        "mode": mode,
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
        # Milestones this attempt newly earned (empty before migrations 0045-0047).
        "new_milestones": new_milestones,
        # True while the guarded Gemini rewording is still running: the app
        # shows the rule text now and swaps in GET /gloss/attempts/{id}/feedback.
        "feedback_pending": bool(progress_ready and feedback_pending),
        "pipeline_version": PIPELINE_VERSION,
        # Task 6 instrumentation — additive; existing consumers ignore it.
        "timings": stage_timings,
        # Diagnostic summary — additive; predicted/expected/confidence/top-3,
        # capture quality, preprocessing description, mirroring flag.
        "diagnostics": diagnostics,
    }


def _free_attempt(db, caregiver_profile_id, session_id, normalized, raw, model, class_names,
                  capture, diagnostics, timings) -> dict:
    """Check my sign: the recogniser's best guesses, stored with mode='free'
    (no target; never counted toward streaks, Demonstrated, levels or badges)."""
    with timings.stage("recognition"):
        probs = grading.grade(normalized, model)["probs"]
    order = [int(i) for i in np.argsort(probs)[::-1][:3]]
    top3 = [{"sign_id": class_names[i], "confidence": float(probs[i])} for i in order]
    confidence = top3[0]["confidence"]
    if confidence >= CONFIDENCE_THRESHOLD:
        outcome, suggestions = OUTCOME_FREE_MATCH, top3[:1]
    elif confidence >= LOW_CONFIDENCE_CUTOFF:
        outcome = OUTCOME_FREE_MAYBE
        suggestions = top3[:1] + [t for t in top3[1:2] if t["confidence"] >= FREE_SECOND_GUESS_MIN]
    else:
        outcome, suggestions = OUTCOME_FREE_NO_MATCH, []
    diagnostics.update(top3=top3, confidence=confidence, raw_frame_count=int(raw.shape[0]),
                       predicted_sign_id=suggestions[0]["sign_id"] if suggestions else None)

    row = {
        "caregiver_profile_id": caregiver_profile_id,
        "session_id": session_id,
        "target_sign_id": None,
        "recognized_sign_id": top3[0]["sign_id"] if confidence >= LOW_CONFIDENCE_CUTOFF else None,
        "recognition_confidence": confidence,
        "attempt_type": "webcam",
        "mode": "free",
        "pipeline_version": PIPELINE_VERSION,
    }
    with timings.stage("persist_attempt"):
        stored = record_attempt(db, row, None)
    logger.info("[GLOSS][FREE] check my sign | outcome=%s | top3=%s", outcome,
                [(t["sign_id"], round(t["confidence"], 3)) for t in top3])
    return {
        "outcome": outcome,
        "mode": "free",
        "attempt_id": stored["attempt_id"],
        "session_id": session_id,
        "recognition_confidence": confidence,
        "suggestions": suggestions,
        "top3": top3,
        "capture_check": capture,
        "timings": {**timings.as_dict(), **db_summary(db.calls)},
        "diagnostics": diagnostics,
    }
