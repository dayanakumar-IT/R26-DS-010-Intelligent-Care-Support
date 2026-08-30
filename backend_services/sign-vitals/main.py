"""GLOSS sign-vitals service — FastAPI app.

Loads the TCN model, feature scaler, class thresholds, class names,
and a Supabase connection on startup, and exposes their status via
GET /health. Also exposes POST /gloss/attempts/recognize for running
a video through the TCN recognition pipeline in isolation.
"""

import json
import logging
import os
import tempfile
import time
from contextlib import asynccontextmanager

import numpy as np
import tensorflow as tf
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client

from attempt_submission import AttemptError, submit_attempt
from auth_helper import AuthError, get_authenticated_caregiver
from execution_evaluator import evaluate_execution
from extract_landmarks_bridge import (
    NoLandmarksExtractedError,
    extract_landmarks_via_subprocess,
)
from history_report import build_history
from lesson_selector import select_next_lesson
from pdedu_lesson_selector import select_next_question
from pdedu_progress_report import build_pdedu_history, build_pdedu_progress
from pdedu_quiz_service import (
    QuizError,
    complete_session as pdedu_complete_session,
    record_answer as pdedu_record_answer,
    start_session as pdedu_start_session,
)
from pdedu_video import DemoVideoUnavailable, resolve_symptom_demo_video
from progress_report import build_progress_report
from r2_presign import DEFAULT_EXPIRES_IN as PRESIGN_EXPIRES_IN
from r2_presign import get_reference_video_url
from pdedu_mastery_engine import update_mastery as pdedu_update_mastery
from preprocessing import preprocess_landmarks_for_inference

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

load_dotenv(os.path.join(BASE_DIR, ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("sign_vitals")

state: dict = {"checks": {}}


def _check_model() -> dict:
    model_path = os.path.join(MODELS_DIR, "TCN_FINAL_layer2.keras")
    model = tf.keras.models.load_model(model_path, compile=False)
    state["model"] = model
    state["model_name"] = os.path.basename(model_path)
    state["model_input_shape"] = list(model.input_shape)
    return {
        "loaded": True,
        "input_shape": list(model.input_shape),
        "output_shape": list(model.output_shape),
    }


def _check_feature_scaler() -> dict:
    scaler_path = os.path.join(MODELS_DIR, "feature_scaler.npz")
    scaler = np.load(scaler_path)
    state["scaler_mean"] = scaler["mean"]
    state["scaler_std"] = scaler["std"]
    return {
        "loaded": True,
        "mean_shape": list(scaler["mean"].shape),
        "std_shape": list(scaler["std"].shape),
    }


def _check_class_thresholds() -> dict:
    thresholds_path = os.path.join(MODELS_DIR, "class_thresholds.json")
    with open(thresholds_path) as f:
        thresholds = json.load(f)
    state["class_thresholds"] = thresholds
    return {
        "loaded": True,
        "sign_count": len(thresholds),
    }


def _check_class_names() -> dict:
    class_names_path = os.path.join(MODELS_DIR, "class_names.json")
    with open(class_names_path) as f:
        class_names = json.load(f)
    state["class_names"] = class_names
    return {
        "loaded": True,
        "sign_count": len(class_names),
    }


def _check_supabase() -> dict:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase = create_client(url, key)
    result = supabase.table("gloss_signs").select("*", count="exact").limit(1).execute()
    state["supabase"] = supabase
    return {
        "connected": True,
        "gloss_signs_row_count": result.count,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    checks = {}
    for name, fn in (
        ("model", _check_model),
        ("feature_scaler", _check_feature_scaler),
        ("class_thresholds", _check_class_thresholds),
        ("class_names", _check_class_names),
        ("supabase", _check_supabase),
    ):
        try:
            checks[name] = fn()
        except Exception as e:
            checks[name] = {"loaded": False, "error": str(e)}
    state["checks"] = checks
    yield


app = FastAPI(title="sign-vitals", lifespan=lifespan)

# Local dev only: the Vite dev server (localhost:5173 by default, though Vite
# will pick the next free port if that's taken) runs on a different origin
# than this API (localhost:8000), so the browser blocks fetch() calls here
# without CORS headers — that's what surfaces as "Failed to fetch" in the
# frontend. Allow the common local Vite ports on both localhost and 127.0.0.1.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return state["checks"]


@app.post("/gloss/attempts/recognize")
async def recognize(video: UploadFile = File(...)):
    """Run a caregiver attempt clip through the TCN recognition pipeline
    and return the predicted sign + confidence.

    NOTE: this is an internal/testing utility for verifying recognition
    in isolation — NOT necessarily the final endpoint the frontend will
    call. Phase 8 (attempt persistence) will likely introduce a combined
    endpoint that takes a target sign + video and performs recognition +
    DTW + persistence + mastery update together in one call, rather than
    the frontend orchestrating multiple requests itself. Don't mistake
    this endpoint for that final integration point.
    """
    contents = await video.read()
    logger.info("video received: filename=%s size_bytes=%d", video.filename, len(contents))

    suffix = os.path.splitext(video.filename or "")[1] or ".mp4"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="gloss_attempt_")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(contents)

        try:
            raw = extract_landmarks_via_subprocess(tmp_path)
        except NoLandmarksExtractedError:
            logger.warning("no landmarks extracted from video: filename=%s", video.filename)
            raise HTTPException(status_code=400, detail="Could not extract usable landmarks from video")

        logger.info("landmarks extracted: shape=%s", raw.shape)

        mean, std = state["scaler_mean"], state["scaler_std"]
        tensor, positional, dtw_sequence = preprocess_landmarks_for_inference(raw, mean, std)

        if tensor is None:
            logger.warning("preprocessing produced no usable landmarks: filename=%s", video.filename)
            raise HTTPException(status_code=400, detail="Could not extract usable landmarks from video")

        logger.info("preprocessing done: tensor_shape=%s", tensor.shape)

        model = state["model"]
        prediction = model.predict(tensor, verbose=0)[0]  # (59,)
        class_index = int(np.argmax(prediction))
        confidence = float(prediction[class_index])
        predicted_sign = state["class_names"][class_index]

        logger.info("prediction done: sign=%s confidence=%.4f", predicted_sign, confidence)

        # Task 7 diagnostics — additive, on this internal/testing utility
        # only (NOT the frontend's POST /gloss/attempts path). Nothing
        # here changes the prediction; it only exposes capture-quality
        # and top-3 detail to help investigate why the same intended sign
        # can recognise differently across live attempts.
        top3_idx = np.argsort(prediction)[::-1][:3]
        top3 = [
            {"sign_id": state["class_names"][int(i)], "confidence": float(prediction[int(i)])}
            for i in top3_idx
        ]
        total_frames = int(raw.shape[0])
        fully_undetected = int(np.isnan(raw).all(axis=(1, 2)).sum())
        missing_landmark_fraction = float(np.isnan(raw).mean())

        return {
            "predicted_sign": predicted_sign,
            "confidence": confidence,
            "class_index": class_index,
            "diagnostics": {
                "top3": top3,
                "raw_frame_count": total_frames,
                "fully_undetected_frames": fully_undetected,
                "missing_landmark_fraction": round(missing_landmark_fraction, 4),
            },
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("recognition failed: filename=%s", video.filename)
        raise HTTPException(status_code=500, detail="Recognition failed")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/gloss/attempts/evaluate")
async def evaluate(video: UploadFile = File(...), target_sign_id: str = Form(...)):
    """Run a caregiver attempt clip through the DTW execution evaluator
    against a target sign and return the distance + quality tier.

    NOTE: this is an internal/testing utility for verifying DTW
    evaluation in isolation — NOT necessarily the final endpoint the
    frontend will call. Phase 8 (attempt persistence) will likely
    introduce a combined endpoint that takes a target sign + video and
    performs recognition + DTW + persistence + mastery update together
    in one call, rather than the frontend orchestrating multiple
    requests itself. Don't mistake this endpoint for that final
    integration point.
    """
    contents = await video.read()
    logger.info(
        "video received: filename=%s size_bytes=%d target_sign_id=%s",
        video.filename, len(contents), target_sign_id,
    )

    suffix = os.path.splitext(video.filename or "")[1] or ".mp4"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="gloss_attempt_")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(contents)

        try:
            raw = extract_landmarks_via_subprocess(tmp_path)
        except NoLandmarksExtractedError:
            logger.warning("no landmarks extracted from video: filename=%s", video.filename)
            raise HTTPException(status_code=400, detail="Could not extract usable landmarks from video")

        logger.info("landmarks extracted: shape=%s", raw.shape)

        mean, std = state["scaler_mean"], state["scaler_std"]
        _tensor, _positional, dtw_sequence = preprocess_landmarks_for_inference(raw, mean, std)

        if dtw_sequence is None:
            logger.warning("preprocessing produced no usable landmarks: filename=%s", video.filename)
            raise HTTPException(status_code=400, detail="Could not extract usable landmarks from video")

        logger.info("preprocessing done: dtw_sequence_shape=%s", dtw_sequence.shape)

        try:
            result = evaluate_execution(
                dtw_sequence, target_sign_id, state["supabase"], state["class_thresholds"]
            )
        except ValueError as e:
            logger.warning("evaluation failed: target_sign_id=%s error=%s", target_sign_id, e)
            raise HTTPException(status_code=400, detail=str(e))

        logger.info(
            "evaluation done: target_sign_id=%s distance=%.2f quality_tier=%s",
            target_sign_id, result["distance"], result["quality_tier"],
        )

        return {
            "distance": result["distance"],
            "quality_tier": result["quality_tier"],
            "target_sign_id": target_sign_id,
            "deviating_landmarks": result["deviating_landmarks"],
            "corrective_feedback": result["corrective_feedback"],
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("evaluation failed: filename=%s target_sign_id=%s", video.filename, target_sign_id)
        raise HTTPException(status_code=500, detail="Evaluation failed")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/gloss/attempts")
async def create_attempt(
    target_sign_id: str = Form(...),
    attempt_type: str = Form(...),
    session_id: str | None = Form(None),
    selected_sign_id: str | None = Form(None),
    video: UploadFile | None = File(None),
    authorization: str | None = Header(None),
):
    """Phase 8 — the real, combined attempt-submission endpoint the
    frontend calls. Runs recognition + DTW evaluation + corrective
    feedback (webcam) or a correct/incorrect check (multiple_choice),
    persists the attempt, updates mastery, and recommends the next
    lesson — all in one call. caregiver_profile_id is never a request
    field; it's derived from the caller's Supabase Auth session.

    Thin wrapper only: verifies auth, parses the multipart request,
    delegates everything else to attempt_submission.submit_attempt().
    """
    try:
        caregiver_profile_id = get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    tmp_path = None
    request_t0 = time.perf_counter()
    file_save_ms = 0.0
    try:
        if video is not None:
            file_save_t0 = time.perf_counter()
            contents = await video.read()
            suffix = os.path.splitext(video.filename or "")[1] or ".mp4"
            fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="gloss_attempt_")
            with os.fdopen(fd, "wb") as f:
                f.write(contents)
            file_save_ms = round((time.perf_counter() - file_save_t0) * 1000, 1)
            logger.info(
                "video received: filename=%s size_bytes=%d file_save_ms=%.1f",
                video.filename, len(contents), file_save_ms,
            )

        result = submit_attempt(
            state["supabase"],
            caregiver_profile_id,
            target_sign_id=target_sign_id,
            attempt_type=attempt_type,
            session_id=session_id,
            video_path=tmp_path,
            selected_sign_id=selected_sign_id,
            model=state["model"],
            class_names=state["class_names"],
            scaler_mean=state["scaler_mean"],
            scaler_std=state["scaler_std"],
            class_thresholds=state["class_thresholds"],
        )
        # Task 6 instrumentation — fold the endpoint-level timings (multipart
        # file save + total server request time) into the timings dict
        # submit_attempt already returns. Additive; existing fields unchanged.
        if isinstance(result, dict):
            timings = dict(result.get("timings") or {})
            timings["file_save_ms"] = file_save_ms
            timings["request_total_ms"] = round((time.perf_counter() - request_t0) * 1000, 1)
            result["timings"] = timings

            # Fold in the active model artifact identity so a wrong
            # recognition can be traced to the exact loaded model.
            diag = dict(result.get("diagnostics") or {})
            diag["model_name"] = state.get("model_name")
            diag["model_input_shape"] = state.get("model_input_shape")
            diag["class_count"] = len(state.get("class_names") or [])
            result["diagnostics"] = diag
            logger.info("attempt diagnostics: %s", diag)
        return result
    except AttemptError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except HTTPException:
        raise
    except Exception:
        logger.exception("attempt submission failed: caregiver_profile_id=%s", caregiver_profile_id)
        raise HTTPException(status_code=500, detail="Attempt submission failed")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/gloss/next-lesson")
async def next_lesson(authorization: str | None = Header(None)):
    """Lesson recommendation before any attempt has been submitted yet
    (e.g. right after login). Same auth requirement as POST
    /gloss/attempts — reuses get_authenticated_caregiver() and
    select_next_lesson() as-is, no new logic.
    """
    try:
        caregiver_profile_id = get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    next_sign = select_next_lesson(state["supabase"], caregiver_profile_id)
    logger.info("next lesson selected: caregiver_profile_id=%s sign_id=%s", caregiver_profile_id, next_sign)

    return {"next_recommended_sign_id": next_sign}


@app.get("/gloss/signs")
async def list_signs(authorization: str | None = Header(None)):
    """Lists active signs (id + display_name) — the GLOSS sign catalogue.
    Needed by the frontend for free browsing and for building
    multiple_choice fallback options; not part of the recognition/DTW
    pipeline itself, so this doesn't touch any of that working code.
    """
    try:
        get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    result = (
        state["supabase"]
        .table("gloss_signs")
        .select("id, display_name")
        .eq("is_active", True)
        .order("display_name")
        .execute()
    )
    return {"signs": result.data}


@app.get("/gloss/signs/{sign_id}/reference")
async def get_sign_reference(sign_id: str, authorization: str | None = Header(None)):
    """Returns one sign's reference landmark sequence, reshaped into a
    frontend-friendly per-frame/per-landmark structure, for the 3D
    signing avatar. Read-only relative to the ML pipeline — this does
    not touch recognition, DTW, preprocessing, mastery, or lesson
    selection in any way; it only reads the already-stored reference
    used by execution_evaluator.py's DTW comparison.

    Returns only spatial x/y/z positions — never TCN features,
    velocity/acceleration, DTW thresholds, or other caregiver data.
    """
    try:
        get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    sign_result = (
        state["supabase"]
        .table("gloss_signs")
        .select("id, display_name, is_active")
        .eq("id", sign_id)
        .limit(1)
        .execute()
    )
    if not sign_result.data or not sign_result.data[0]["is_active"]:
        raise HTTPException(status_code=404, detail=f"Unknown or inactive sign_id: {sign_id!r}")

    reference_result = (
        state["supabase"]
        .table("gloss_sign_references")
        .select("frame_count, landmark_sequence")
        .eq("sign_id", sign_id)
        .limit(1)
        .execute()
    )
    if not reference_result.data:
        raise HTTPException(status_code=404, detail=f"No reference sequence found for sign_id: {sign_id!r}")

    landmark_sequence = reference_result.data[0]["landmark_sequence"]
    frames = []
    for flat_frame in landmark_sequence:
        if len(flat_frame) != 147:
            raise HTTPException(
                status_code=500,
                detail=f"Corrupt reference data for sign_id={sign_id!r}: expected 147 values per frame, got {len(flat_frame)}",
            )
        landmarks = [
            {"x": flat_frame[i * 3], "y": flat_frame[i * 3 + 1], "z": flat_frame[i * 3 + 2]}
            for i in range(49)
        ]
        frames.append({"landmarks": landmarks})

    return {
        "sign_id": sign_id,
        "display_name": sign_result.data[0]["display_name"],
        "frame_count": len(frames),
        "frames": frames,
    }


@app.get("/gloss/signs/{sign_id}/demo-video")
async def get_sign_demo_video(sign_id: str, authorization: str | None = Header(None)):
    """Returns a ready-to-play URL for a sign's validated human reference
    video. The video binary lives in Cloudflare R2; this endpoint reads
    only the gloss_sign_demo_videos metadata row and returns a URL —
    never R2 credentials, never the Cloudflare API token, never the
    Supabase service-role key.

    URL resolution:
      1. If the row is active and already stores a real http(s) public
         URL (public bucket / custom domain), return it as-is.
      2. Otherwise mint a short-lived presigned GET URL from R2 using
         server-side credentials. This is the current path — the rows
         were uploaded before any public URL existed, so they hold a
         "pending:" placeholder and is_active=false; the presigned URL
         is real and time-limited, nothing is faked.

    Teaching reference only — NOT part of recognition / DTW / mastery.
    404 when the sign has no row and no playable R2 object; the frontend
    then falls back to the 2D Sign Guide.
    """
    try:
        get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    result = (
        state["supabase"]
        .table("gloss_sign_demo_videos")
        .select("sign_id, video_object_key, video_url, duration_seconds, is_active")
        .eq("sign_id", sign_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"No reference video for sign_id: {sign_id!r}")

    row = result.data[0]
    stored_url = row.get("video_url") or ""
    duration = row.get("duration_seconds")

    if row.get("is_active") and stored_url.startswith(("http://", "https://")):
        return {"sign_id": sign_id, "video_url": stored_url, "duration_seconds": duration}

    object_key = row.get("video_object_key") or f"gloss/sign-references/{sign_id}.mp4"
    presigned = get_reference_video_url(object_key, expires_in=PRESIGN_EXPIRES_IN)
    if not presigned:
        raise HTTPException(status_code=404, detail=f"No usable reference video for sign_id: {sign_id!r}")

    return {
        "sign_id": sign_id,
        "video_url": presigned,
        "duration_seconds": duration,
        "url_expires_in": PRESIGN_EXPIRES_IN,
    }


@app.get("/gloss/progress")
async def gloss_progress(authorization: str | None = Header(None)):
    """Caregiver learning-progress report for the Progress tab — counts,
    per-sign mastery summary, and a practice calendar. Read-only
    aggregation of the caller's own gloss_caregiver_mastery /
    gloss_attempts / gloss_signs. Does not touch the ML pipeline.
    """
    try:
        caregiver_profile_id = get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return build_progress_report(state["supabase"], caregiver_profile_id)


@app.get("/gloss/history")
async def gloss_history(limit: int = 30, authorization: str | None = Header(None)):
    """The caller's most recent attempts (newest first) for the History
    tab. Read-only; returns only per-attempt summary fields — never raw
    landmarks, video, or auth data.
    """
    try:
        caregiver_profile_id = get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return {"attempts": build_history(state["supabase"], caregiver_profile_id, limit)}


# ============================================================
# Parkinson's-Disease EDUcation (pdedu_) — caregiver education
# feature. NOT a diagnostic tool, NOT an AI/ML model. Kept entirely
# separate from GLOSS's gloss_ tables/pipeline above.
# ============================================================


class PdeduResponseRequest(BaseModel):
    question_id: str
    selected_symptom_id: str


def _serialize_pdedu_question(question: dict, symptom: dict) -> dict:
    return {
        "question_id": question["id"],
        "symptom_id": question["symptom_id"],
        "symptom_display_name": symptom["display_name"],
        "symptom_definition": symptom["definition"],
        "question_type": question["question_type"],
        "prompt": question["prompt"],
        "choices": question["choices"],
    }


@app.get("/pdedu/next-question")
async def pdedu_next_question(authorization: str | None = Header(None)):
    """Returns the next adaptively-selected Parkinson's education quiz
    question. Never reveals the correct answer, a correct-choice flag,
    or an answer index — only the question content itself.
    """
    try:
        caregiver_profile_id = get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    try:
        question_id = select_next_question(state["supabase"], caregiver_profile_id)
    except ValueError as e:
        logger.exception("pdedu question selection failed: caregiver_profile_id=%s", caregiver_profile_id)
        raise HTTPException(status_code=500, detail=str(e))

    question_result = (
        state["supabase"]
        .table("pdedu_questions")
        .select("id, symptom_id, question_type, prompt, choices")
        .eq("id", question_id)
        .limit(1)
        .execute()
    )
    question = question_result.data[0]

    symptom_result = (
        state["supabase"]
        .table("pdedu_symptoms")
        .select("display_name, definition")
        .eq("id", question["symptom_id"])
        .limit(1)
        .execute()
    )
    symptom = symptom_result.data[0]

    logger.info(
        "pdedu next question selected: caregiver_profile_id=%s question_id=%s symptom_id=%s",
        caregiver_profile_id, question_id, question["symptom_id"],
    )

    return _serialize_pdedu_question(question, symptom)


@app.post("/pdedu/responses")
async def pdedu_submit_response(body: PdeduResponseRequest, authorization: str | None = Header(None)):
    """Records one Parkinson's education quiz answer, updates mastery
    for the symptom being tested (not the incorrectly selected one),
    and returns the next adaptively-selected question.
    """
    try:
        caregiver_profile_id = get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    logger.info(
        "pdedu response received: caregiver_profile_id=%s question_id=%s selected_symptom_id=%s",
        caregiver_profile_id, body.question_id, body.selected_symptom_id,
    )

    question_result = (
        state["supabase"]
        .table("pdedu_questions")
        .select("id, symptom_id, choices, extra_fact")
        .eq("id", body.question_id)
        .limit(1)
        .execute()
    )
    if not question_result.data:
        raise HTTPException(status_code=400, detail=f"Unknown question_id: {body.question_id!r}")
    question = question_result.data[0]

    correct_symptom_id = question["symptom_id"]
    choice_symptom_ids = {choice["symptom_id"] for choice in question["choices"]}
    if body.selected_symptom_id not in choice_symptom_ids:
        raise HTTPException(
            status_code=400,
            detail=f"selected_symptom_id {body.selected_symptom_id!r} is not one of this question's choices",
        )

    is_correct = body.selected_symptom_id == correct_symptom_id

    state["supabase"].table("pdedu_responses").insert(
        {
            "caregiver_profile_id": caregiver_profile_id,
            "question_id": body.question_id,
            "selected_symptom_id": body.selected_symptom_id,
            "is_correct": is_correct,
        }
    ).execute()
    logger.info("pdedu response persisted: is_correct=%s", is_correct)

    mastery_row = pdedu_update_mastery(state["supabase"], caregiver_profile_id, correct_symptom_id, is_correct)
    logger.info(
        "pdedu mastery updated: symptom_id=%s mastery_score=%s",
        correct_symptom_id, mastery_row["mastery_score"],
    )

    next_question_id = select_next_question(state["supabase"], caregiver_profile_id)
    logger.info("pdedu next question selected: question_id=%s", next_question_id)

    return {
        "is_correct": is_correct,
        "correct_symptom_id": correct_symptom_id,
        "extra_fact": question["extra_fact"],
        "mastery": mastery_row,
        "next_question_id": next_question_id,
    }


# ============================================================
# Parkinson's Symptom Trainer — the gamified caregiver tutoring
# layer built on top of the pdedu_ tables. Fixed-length quiz
# sessions with XP / streak / per-symptom progress, plus video
# MCQs whose clips come from Cloudflare R2 via presigned URLs.
#
# EDUCATION ONLY — symptom-recognition training. Not diagnostic,
# not an AI/ML model. Separate from GLOSS's gloss_ endpoints above;
# the older /pdedu/next-question + /pdedu/responses endpoints keep
# working unchanged.
# ============================================================


class PdeduQuizAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    selected_symptom_id: str


def _pdedu_caregiver(authorization: str | None) -> str:
    try:
        return get_authenticated_caregiver(state["supabase"], authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.get("/pdedu/symptoms")
async def pdedu_list_symptoms(authorization: str | None = Header(None)):
    """The symptom education catalogue for the Explore Symptoms section:
    definition, learning tip, memory trick, and whether a demo video is
    available. Read-only reference data."""
    _pdedu_caregiver(authorization)

    symptoms = (
        state["supabase"]
        .table("pdedu_symptoms")
        .select("id, display_name, definition, learning_tip, memory_trick, display_order")
        .eq("is_active", True)
        .order("display_order")
        .execute()
    ).data or []

    videos = (
        state["supabase"]
        .table("pdedu_symptom_demo_videos")
        .select("symptom_id")
        .execute()
    ).data or []
    with_video = {v["symptom_id"] for v in videos}

    return {
        "symptoms": [
            {
                "symptom_id": s["id"],
                "display_name": s["display_name"],
                "definition": s["definition"],
                "learning_tip": s.get("learning_tip"),
                "memory_trick": s.get("memory_trick"),
                "display_order": s.get("display_order"),
                "has_video": s["id"] in with_video,
            }
            for s in symptoms
        ]
    }


@app.get("/pdedu/symptoms/{symptom_id}/demo-video")
async def pdedu_symptom_demo_video(symptom_id: str, authorization: str | None = Header(None)):
    """A ready-to-play URL for a symptom's educational movement-pattern
    clip (Explore Symptoms -> Watch Example). The binary lives in
    Cloudflare R2; only a short-lived URL is returned — never R2
    credentials. 404 when no usable video exists yet."""
    _pdedu_caregiver(authorization)
    try:
        resolved = resolve_symptom_demo_video(state["supabase"], symptom_id)
    except DemoVideoUnavailable as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"symptom_id": symptom_id, **resolved}


@app.post("/pdedu/quiz/start")
async def pdedu_quiz_start(authorization: str | None = Header(None)):
    """Starts a Symptom Trainer quiz: creates a session and returns
    ~10 questions in random order (video + text, adapting to which
    symptoms actually have a video). Correct answers are never
    included in this payload."""
    caregiver_profile_id = _pdedu_caregiver(authorization)
    try:
        return pdedu_start_session(state["supabase"], caregiver_profile_id)
    except QuizError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.get("/pdedu/quiz/questions/{question_id}/demo-video")
async def pdedu_quiz_question_video(question_id: str, authorization: str | None = Header(None)):
    """The clip for a video quiz question. Resolved by question id and
    the response deliberately omits the symptom_id, so watching the
    clip never reveals the answer. 404 when the question is not a video
    question or has no usable clip."""
    _pdedu_caregiver(authorization)

    result = (
        state["supabase"]
        .table("pdedu_questions")
        .select("id, symptom_id, format, is_active")
        .eq("id", question_id)
        .limit(1)
        .execute()
    )
    if not result.data or result.data[0]["format"] != "video" or not result.data[0]["is_active"]:
        raise HTTPException(status_code=404, detail="No video for this question")

    try:
        resolved = resolve_symptom_demo_video(state["supabase"], result.data[0]["symptom_id"])
    except DemoVideoUnavailable as e:
        raise HTTPException(status_code=404, detail=str(e))
    # Note: symptom_id intentionally NOT returned.
    return resolved


@app.post("/pdedu/quiz/answer")
async def pdedu_quiz_answer(body: PdeduQuizAnswerRequest, authorization: str | None = Header(None)):
    """Grades one answer server-side, persists the attempt, updates
    mastery + session totals, and returns correctness, the correct
    answer, explanation, tip, XP awarded and the current streak."""
    caregiver_profile_id = _pdedu_caregiver(authorization)
    try:
        return pdedu_record_answer(
            state["supabase"],
            caregiver_profile_id,
            body.session_id,
            body.question_id,
            body.selected_symptom_id,
        )
    except QuizError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.post("/pdedu/quiz/{session_id}/complete")
async def pdedu_quiz_complete(session_id: str, authorization: str | None = Header(None)):
    """Finalises a session and returns the end-of-quiz summary: score,
    XP, best streak, per-symptom breakdown, strongest / needs-review
    symptoms, milestone badges, and the list of incorrect answers for
    review."""
    caregiver_profile_id = _pdedu_caregiver(authorization)
    try:
        return pdedu_complete_session(state["supabase"], caregiver_profile_id, session_id)
    except QuizError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.get("/pdedu/progress")
async def pdedu_progress(authorization: str | None = Header(None)):
    """The caller's Parkinson's learning progress: overall quiz score,
    totals, XP, best streak, and recognition accuracy in training per
    symptom. Read-only aggregation of the caller's own rows."""
    caregiver_profile_id = _pdedu_caregiver(authorization)
    return build_pdedu_progress(state["supabase"], caregiver_profile_id)


@app.get("/pdedu/history")
async def pdedu_history(limit: int = 20, authorization: str | None = Header(None)):
    """The caller's most recent completed Symptom Trainer quizzes
    (newest first)."""
    caregiver_profile_id = _pdedu_caregiver(authorization)
    return {"sessions": build_pdedu_history(state["supabase"], caregiver_profile_id, limit)}
