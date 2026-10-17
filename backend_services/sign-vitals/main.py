"""GLOSS sign-vitals service — FastAPI app.

Loads the recognition model (GLOSS_ensemble.keras), feature scaler,
class thresholds (v3), class names and DTW reference exemplars — all
from gloss_assets/ — and a Supabase connection on startup, and exposes
their status via GET /health. Also exposes POST
/gloss/attempts/recognize for running a video through the recognition
pipeline in isolation.
"""

import hashlib
import json
import logging
import os
import tempfile
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client

from attempt_submission import AttemptError, submit_attempt
from progress_store import MIGRATIONS_NEEDED, schema_ready
from progress_summary import load_attempts, load_milestones, load_summary
from recall_selector import pick_recall_sign
from auth_helper import (
    AuthError,
    forget_learner,
    get_authenticated_caregiver,
    get_authenticated_identity,
    get_authenticated_supervisor,
)
import supervisor_report
import grading
from execution_evaluator import evaluate_execution
import feedback_async
from extract_landmarks_bridge import (
    warm_up_worker,
    NoLandmarksExtractedError,
    extract_landmarks_via_subprocess,
)
from history_report import build_history_page
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
from preprocessing import normalize_raw_landmarks
from recogniser import ASSETS_DIR, MODEL_FILENAME, MODEL_PATH, load_ensemble
from sign_config import annotate_sign
from stage_timing import TimedDb

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

load_dotenv(os.path.join(BASE_DIR, ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("sign_vitals")

# Quieten the routine "HTTP Request: GET https://…supabase… 200 OK" line
# that supabase-py's httpx client emits for every query — it drowns out
# the application pipeline story in the terminal. Warnings and errors
# from httpx still surface.
logging.getLogger("httpx").setLevel(logging.WARNING)

state: dict = {"checks": {}}


def _short(value) -> str:
    """First 8 chars of an id — enough to correlate log lines without
    printing a full internal UUID during a live demo."""
    return str(value)[:8] if value is not None else "-"


def _ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 1)


def _check_model() -> dict:
    model = load_ensemble()
    state["model"] = model
    state["model_name"] = os.path.basename(MODEL_PATH)
    state["model_input_shape"] = list(model.input_shape)
    return {
        "loaded": True,
        "input_shape": list(model.input_shape),
        "output_shape": list(model.output_shape),
    }


def _check_feature_scaler() -> dict:
    scaler = grading.load_feature_scaler()
    return {
        "loaded": True,
        "mean_shape": list(scaler["mean"].shape),
        "std_shape": list(scaler["std"].shape),
    }


def _check_class_thresholds() -> dict:
    thresholds = grading.load_thresholds()
    state["class_thresholds"] = thresholds
    return {
        "loaded": True,
        "sign_count": len(thresholds),
    }


def _check_class_names() -> dict:
    class_names = grading.load_class_names()
    state["class_names"] = class_names
    return {
        "loaded": True,
        "sign_count": len(class_names),
    }


def _check_reference_exemplars() -> dict:
    references = grading.load_references()
    return {
        "loaded": True,
        "sign_count": len(references),
    }


def _check_supabase() -> dict:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase = create_client(url, key)
    result = supabase.table("gloss_signs").select("*", count="exact").limit(1).execute()
    state.update(supabase=supabase)
    return {
        "connected": True,
        "gloss_signs_row_count": result.count,
    }


def _fingerprint(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]


def _check_fingerprints() -> dict:
    """Every gloss_assets/ file listed in manifest.json must match its
    SHA-256 fingerprint (first 12 hex chars) — the same check as
    tests/test_parity.py, run at startup so a wrong model / scaler /
    threshold file can't be served silently. Files the manifest lists
    but the bundle doesn't ship (the two ensemble members) are skipped."""
    with open(os.path.join(ASSETS_DIR, "manifest.json")) as f:
        manifest = json.load(f)
    checked, mismatched = 0, []
    for name, entry in manifest.items():
        path = os.path.join(ASSETS_DIR, name)
        if not os.path.exists(path):
            continue
        checked += 1
        if _fingerprint(path) != entry["fingerprint"]:
            mismatched.append(name)
    if mismatched:
        raise ValueError(f"fingerprint mismatch vs manifest.json: {', '.join(mismatched)}")
    return {
        "loaded": True,
        "files_checked": checked,
        "model_fingerprint": manifest[MODEL_FILENAME]["fingerprint"],
    }


_STARTUP_LABELS = {
    "fingerprints": "asset fingerprints (manifest.json)",
    "model": "recognition model (GLOSS_ensemble.keras)",
    "feature_scaler": "standardization parameters",
    "class_thresholds": "class thresholds",
    "class_names": "class names",
    "reference_exemplars": "DTW reference exemplars",
    "supabase": "Supabase connection",
}


def _db():
    """The Supabase client. If the startup connection failed (e.g. a
    network blip during boot), connect now instead of failing every
    request until the server is restarted."""
    client = state.get("supabase")
    if client is not None:
        return client
    logger.warning("[SIGN_VITALS][DB] no startup Supabase connection — reconnecting")
    try:
        client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    except Exception as e:
        logger.error("[SIGN_VITALS][DB][ERROR] reconnect failed: %s: %s", type(e).__name__, e)
        raise HTTPException(status_code=503, detail="The database is unreachable right now. Please try again shortly.")
    state.update(supabase=client)
    state["checks"]["supabase"] = {"connected": True, "reconnected_after_startup": True}
    logger.info("[SIGN_VITALS][DB] Supabase reconnected")
    return client


@asynccontextmanager
async def lifespan(app: FastAPI):
    checks = {}
    failed = []
    for name, fn in (
        ("fingerprints", _check_fingerprints),
        ("model", _check_model),
        ("feature_scaler", _check_feature_scaler),
        ("class_thresholds", _check_class_thresholds),
        ("class_names", _check_class_names),
        ("reference_exemplars", _check_reference_exemplars),
        ("supabase", _check_supabase),
    ):
        label = _STARTUP_LABELS.get(name, name)
        logger.info("[SIGN_VITALS][STARTUP] loading %s ...", label)
        try:
            checks[name] = fn()
            detail = " | ".join(
                f"{k}={v}" for k, v in checks[name].items() if k not in ("loaded", "connected")
            )
            logger.info("[SIGN_VITALS][STARTUP] %s ready%s", label, f" | {detail}" if detail else "")
        except Exception as e:
            checks[name] = {"loaded": False, "error": str(e)}
            failed.append(label)
            logger.error("[SIGN_VITALS][STARTUP][ERROR] %s failed: %s: %s", label, type(e).__name__, e)
    state["checks"] = checks
    if failed:
        logger.warning(
            "[SIGN_VITALS][STARTUP] backend started with FAILED checks: %s — /health has details",
            ", ".join(failed),
        )
    else:
        logger.info("[SIGN_VITALS][STARTUP] backend ready for inference")
    # Warm-up in the background (does not delay start-up): the first real
    # attempt then finds the model graph built and the MediaPipe worker loaded.
    threading.Thread(target=_warm_up, name="gloss-warmup", daemon=True).start()
    yield


def _warm_up():
    t0 = time.perf_counter()
    try:
        if state.get("model") is not None:
            grading.predict_probs(state["model"], np.zeros((60, 441), dtype=np.float32))
    except Exception:
        logger.exception("[SIGN_VITALS][STARTUP] model warm-up failed (first attempt will build the graph)")
    worker_ok = warm_up_worker()
    logger.info("[SIGN_VITALS][STARTUP] warm-up done | mediapipe_worker=%s | ms=%s",
                "ready" if worker_ok else "one-shot fallback", _ms(t0))


app = FastAPI(title="sign-vitals", lifespan=lifespan)


# Registered BEFORE the CORS middleware so it sits inside it: an
# unhandled exception becomes a JSON 500 that still carries CORS headers.
# Without this, Starlette's outermost error handler answers without them
# and the browser reports a bare "Failed to fetch" instead of the error.
@app.middleware("http")
async def json_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception("[SIGN_VITALS][ERROR] unhandled error | %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})

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


# Upload limits for attempt clips. A recorded sign is a few seconds of
# webcam video — a few MB at most — so 50 MB leaves a wide margin while
# stopping someone filling the server's disk.
MAX_VIDEO_BYTES = 50 * 1024 * 1024
ALLOWED_VIDEO_EXTENSIONS = {".webm", ".mp4", ".mov", ".mkv"}
_UPLOAD_CHUNK = 1024 * 1024


async def _save_upload(video: UploadFile) -> tuple[str, int]:
    """Streams an uploaded clip to a temp file, enforcing type and size.
    Returns (tmp_path, size_bytes). The caller deletes the file."""
    suffix = os.path.splitext(video.filename or "")[1].lower()
    content_type = (video.content_type or "").lower()
    if not content_type.startswith("video/") and suffix not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Please upload a video clip (WebM or MP4).")
    if suffix not in ALLOWED_VIDEO_EXTENSIONS:
        suffix = ".mp4"

    fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="gloss_attempt_")
    size = 0
    try:
        with os.fdopen(fd, "wb") as f:
            while chunk := await video.read(_UPLOAD_CHUNK):
                size += len(chunk)
                if size > MAX_VIDEO_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"The video is too large (limit {MAX_VIDEO_BYTES // (1024 * 1024)} MB). "
                        "Record a shorter clip of just the sign.",
                    )
                f.write(chunk)
    except BaseException:
        os.remove(tmp_path)
        raise
    if size == 0:
        os.remove(tmp_path)
        raise HTTPException(status_code=400, detail="The uploaded video is empty.")
    return tmp_path, size


def _require_debug_endpoints():
    """The two /gloss/attempts/{recognize,evaluate} utilities take no
    login, so they only exist when GLOSS_ENABLE_DEBUG_ENDPOINTS=1 is set
    (local diagnostics, e.g. scripts/diagnose_attempt_stability.py)."""
    if os.environ.get("GLOSS_ENABLE_DEBUG_ENDPOINTS") != "1":
        raise HTTPException(status_code=404, detail="Not Found")


@app.post("/gloss/attempts/recognize")
async def recognize(video: UploadFile = File(...)):
    """Run a caregiver attempt clip through the recognition pipeline
    and return the predicted sign + confidence.

    NOTE: this is an internal/testing utility for verifying recognition
    in isolation — NOT necessarily the final endpoint the frontend will
    call. Phase 8 (attempt persistence) will likely introduce a combined
    endpoint that takes a target sign + video and performs recognition +
    DTW + persistence + mastery update together in one call, rather than
    the frontend orchestrating multiple requests itself. Don't mistake
    this endpoint for that final integration point.
    """
    _require_debug_endpoints()
    tmp_path, size = await _save_upload(video)
    logger.info("video received: filename=%s size_bytes=%d", video.filename, size)

    try:
        try:
            raw = extract_landmarks_via_subprocess(tmp_path)
        except NoLandmarksExtractedError:
            logger.warning("no landmarks extracted from video: filename=%s", video.filename)
            raise HTTPException(status_code=400, detail="Could not extract usable landmarks from video")

        logger.info("landmarks extracted: shape=%s", raw.shape)

        normalized = normalize_raw_landmarks(raw)

        if normalized is None:
            logger.warning("preprocessing produced no usable landmarks: filename=%s", video.filename)
            raise HTTPException(status_code=400, detail="Could not extract usable landmarks from video")

        logger.info("preprocessing done: normalized_shape=%s", normalized.shape)

        # Same recognise-then-grade call as POST /gloss/attempts, so this
        # utility reports exactly what the real endpoint would recognise.
        prediction = grading.grade(normalized, state["model"])["probs"]  # (59,)
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
    """Run a caregiver attempt clip through recognition + the DTW
    execution evaluator against a target sign and return the distance +
    quality tier. distance / quality_tier / deviating_landmarks are
    null when the clip isn't recognised as the target sign.

    NOTE: this is an internal/testing utility for verifying DTW
    evaluation in isolation — NOT necessarily the final endpoint the
    frontend will call. Phase 8 (attempt persistence) will likely
    introduce a combined endpoint that takes a target sign + video and
    performs recognition + DTW + persistence + mastery update together
    in one call, rather than the frontend orchestrating multiple
    requests itself. Don't mistake this endpoint for that final
    integration point.
    """
    _require_debug_endpoints()
    tmp_path, size = await _save_upload(video)
    logger.info(
        "video received: filename=%s size_bytes=%d target_sign_id=%s",
        video.filename, size, target_sign_id,
    )

    try:
        try:
            raw = extract_landmarks_via_subprocess(tmp_path)
        except NoLandmarksExtractedError:
            logger.warning("no landmarks extracted from video: filename=%s", video.filename)
            raise HTTPException(status_code=400, detail="Could not extract usable landmarks from video")

        logger.info("landmarks extracted: shape=%s", raw.shape)

        normalized = normalize_raw_landmarks(raw)

        if normalized is None:
            logger.warning("preprocessing produced no usable landmarks: filename=%s", video.filename)
            raise HTTPException(status_code=400, detail="Could not extract usable landmarks from video")

        logger.info("preprocessing done: normalized_shape=%s", normalized.shape)

        try:
            result = evaluate_execution(normalized, target_sign_id, state["model"])
        except ValueError as e:
            logger.warning("evaluation failed: target_sign_id=%s error=%s", target_sign_id, e)
            raise HTTPException(status_code=400, detail=str(e))

        logger.info(
            "evaluation done: target_sign_id=%s recognized=%s distance=%s quality_tier=%s",
            target_sign_id, result["result"]["predicted_class"], result["distance"], result["quality_tier"],
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
    target_sign_id: str | None = Form(None),
    attempt_type: str = Form(...),
    mode: str = Form("practice"),
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
    request_t0 = time.perf_counter()
    logger.info(
        "[GLOSS][ATTEMPT] request received | target=%s | type=%s", target_sign_id, attempt_type
    )
    # One timed client per request: every Supabase round trip (auth
    # included) ends up in result["timings"]["supabase_calls"].
    db = TimedDb(_db())
    auth_t0 = time.perf_counter()
    try:
        caregiver_profile_id = await run_in_threadpool(
            get_authenticated_caregiver, db, authorization, context="GLOSS"
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    auth_ms = _ms(auth_t0)

    tmp_path = None
    file_save_ms = 0.0
    try:
        if video is not None:
            file_save_t0 = time.perf_counter()
            tmp_path, size = await _save_upload(video)
            file_save_ms = round((time.perf_counter() - file_save_t0) * 1000, 1)
            logger.info(
                "[GLOSS][ATTEMPT] video received | file=%s | size_kb=%d | file_save_ms=%.1f",
                video.filename, size // 1024, file_save_ms,
            )

        # MediaPipe subprocess, model inference, DTW and the Supabase
        # calls all block — run them on a worker thread so one attempt
        # doesn't stall every other request on the event loop.
        result = await run_in_threadpool(
            submit_attempt,
            db,
            caregiver_profile_id,
            target_sign_id=target_sign_id,
            attempt_type=attempt_type,
            session_id=session_id,
            video_path=tmp_path,
            selected_sign_id=selected_sign_id,
            model=state["model"],
            class_names=state["class_names"],
            class_thresholds=state["class_thresholds"],
            mode=mode,
        )
        # Task 6 instrumentation — fold the endpoint-level timings (multipart
        # file save + total server request time) into the timings dict
        # submit_attempt already returns. Additive; existing fields unchanged.
        if isinstance(result, dict):
            timings = dict(result.get("timings") or {})
            timings["auth_ms"] = auth_ms
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
            logger.debug("[GLOSS][ATTEMPT] diagnostics | %s", diag)
        logger.info(
            "[GLOSS][ATTEMPT] request completed | status=200 | total_ms=%s", _ms(request_t0)
        )
        return result
    except AttemptError as e:
        logger.warning(
            "[GLOSS][ATTEMPT][WARNING] rejected | status=%d | reason=%s", e.status_code, e.detail
        )
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "[GLOSS][ATTEMPT][ERROR] attempt processing failed | caregiver=%s",
            _short(caregiver_profile_id),
        )
        raise HTTPException(status_code=500, detail="Attempt submission failed")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/gloss/next-lesson")
def next_lesson(authorization: str | None = Header(None)):
    """Lesson recommendation before any attempt has been submitted yet
    (e.g. right after login). Same auth requirement as POST
    /gloss/attempts — reuses get_authenticated_caregiver() and
    select_next_lesson() as-is, no new logic.
    """
    t0 = time.perf_counter()
    logger.info("[GLOSS][NEXT_LESSON] request received")
    try:
        caregiver_profile_id = get_authenticated_caregiver(
            _db(), authorization, context="GLOSS"
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    next_sign = select_next_lesson(_db(), caregiver_profile_id)
    logger.info("[GLOSS][RECOMMENDATION] next sign selected | sign=%s", next_sign)
    logger.info(
        "[GLOSS][NEXT_LESSON] request completed | status=200 | duration_ms=%s", _ms(t0)
    )
    return {"next_recommended_sign_id": next_sign}


@app.get("/gloss/signs")
def list_signs(authorization: str | None = Header(None)):
    """Lists active signs (id + display_name) — the GLOSS sign catalogue.
    Needed by the frontend for free browsing and for building
    multiple_choice fallback options; not part of the recognition/DTW
    pipeline itself, so this doesn't touch any of that working code.
    """
    t0 = time.perf_counter()
    logger.info("[GLOSS][SIGNS] request received")
    try:
        get_authenticated_caregiver(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    result = (
        _db()
        .table("gloss_signs")
        .select("id, display_name")
        .eq("is_active", True)
        .order("display_name")
        .execute()
    )
    logger.info("[GLOSS][DB] sign catalogue loaded | rows=%d", len(result.data or []))
    logger.info("[GLOSS][SIGNS] request completed | status=200 | duration_ms=%s", _ms(t0))
    # Every active sign stays in the dictionary; dictionary-only ones carry a quality note.
    return {"signs": [annotate_sign(row) for row in result.data or []]}


@app.get("/gloss/signs/{sign_id}/reference")
def get_sign_reference(sign_id: str, authorization: str | None = Header(None)):
    """Returns one sign's reference landmark sequence, reshaped into a
    frontend-friendly per-frame/per-landmark structure, for the 3D
    signing avatar. Read-only relative to the ML pipeline — this does
    not touch recognition, DTW, preprocessing, mastery, or lesson
    selection in any way; it only reads the reference stored in
    Supabase's gloss_sign_references (DTW grading itself reads
    gloss_assets/reference_exemplars.npz — see grading.py).

    Returns only spatial x/y/z positions — never model features,
    velocity/acceleration, DTW thresholds, or other caregiver data.
    """
    t0 = time.perf_counter()
    logger.info("[GLOSS][REFERENCE] request received | sign=%s", sign_id)
    try:
        get_authenticated_caregiver(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    sign_result = (
        _db()
        .table("gloss_signs")
        .select("id, display_name, is_active")
        .eq("id", sign_id)
        .limit(1)
        .execute()
    )
    if not sign_result.data or not sign_result.data[0]["is_active"]:
        raise HTTPException(status_code=404, detail=f"Unknown or inactive sign_id: {sign_id!r}")

    reference_result = (
        _db()
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

    logger.info(
        "[GLOSS][REFERENCE] request completed | status=200 | frames=%d | duration_ms=%s",
        len(frames), _ms(t0),
    )
    return {
        "sign_id": sign_id,
        "display_name": sign_result.data[0]["display_name"],
        "frame_count": len(frames),
        "frames": frames,
    }


@app.get("/gloss/signs/{sign_id}/demo-video")
def get_sign_demo_video(sign_id: str, authorization: str | None = Header(None)):
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
    t0 = time.perf_counter()
    logger.info("[GLOSS][VIDEO] request received | sign=%s", sign_id)
    try:
        get_authenticated_caregiver(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    result = (
        _db()
        .table("gloss_sign_demo_videos")
        .select("sign_id, video_object_key, video_url, duration_seconds, is_active")
        .eq("sign_id", sign_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        logger.warning("[GLOSS][VIDEO][WARNING] no reference video row | sign=%s", sign_id)
        raise HTTPException(status_code=404, detail=f"No reference video for sign_id: {sign_id!r}")

    row = result.data[0]
    stored_url = row.get("video_url") or ""
    duration = row.get("duration_seconds")

    if row.get("is_active") and stored_url.startswith(("http://", "https://")):
        logger.info(
            "[GLOSS][VIDEO] request completed | status=200 | source=public_url | duration_ms=%s", _ms(t0)
        )
        return {"sign_id": sign_id, "video_url": stored_url, "duration_seconds": duration}

    object_key = row.get("video_object_key") or f"gloss/sign-references/{sign_id}.mp4"
    presigned = get_reference_video_url(object_key, expires_in=PRESIGN_EXPIRES_IN)
    if not presigned:
        logger.warning("[GLOSS][VIDEO][WARNING] no usable R2 object | sign=%s", sign_id)
        raise HTTPException(status_code=404, detail=f"No usable reference video for sign_id: {sign_id!r}")

    logger.info(
        "[GLOSS][VIDEO] request completed | status=200 | source=presigned | expires_in=%ss | duration_ms=%s",
        PRESIGN_EXPIRES_IN, _ms(t0),
    )
    return {
        "sign_id": sign_id,
        "video_url": presigned,
        "duration_seconds": duration,
        "url_expires_in": PRESIGN_EXPIRES_IN,
    }


@app.get("/gloss/progress")
def gloss_progress(authorization: str | None = Header(None)):
    """Caregiver learning-progress report for the Progress tab — counts,
    per-sign mastery summary, and a practice calendar. Read-only
    aggregation of the caller's own gloss_caregiver_mastery /
    gloss_attempts / gloss_signs. Does not touch the ML pipeline.
    """
    t0 = time.perf_counter()
    logger.info("[GLOSS][PROGRESS] request received")
    try:
        caregiver_profile_id = get_authenticated_caregiver(
            _db(), authorization, context="GLOSS"
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    report = build_progress_report(_db(), caregiver_profile_id)
    logger.info("[GLOSS][PROGRESS] request completed | status=200 | duration_ms=%s", _ms(t0))
    return report


@app.get("/gloss/attempts/{attempt_id}/feedback")
def gloss_attempt_feedback(attempt_id: str, authorization: str | None = Header(None)):
    """The guarded Gemini rewording of an attempt's feedback, which runs
    after the attempt response (feedback_async). {"status": "pending" |
    "ready" | "unchanged", "summary"}: the app shows the rule text first and
    swaps this in when ready. Only the attempt's own caregiver can read it."""
    try:
        caregiver_profile_id = get_authenticated_caregiver(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return feedback_async.get(attempt_id, caregiver_profile_id)


LEARNERS_NEEDED = "Supervisor learning needs the Sign & Vitals database migration 0049 to be applied first."


@app.get("/gloss/me")
def gloss_me(authorization: str | None = Header(None)):
    """Who is calling: {role, name, learner_id | null, is_supervisor}. Drives
    which Sign & Vitals screens the app shows; the server still checks the
    role on every supervisor endpoint."""
    try:
        me = get_authenticated_identity(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return {"role": me["role"], "name": me["name"], "learner_id": me["learner_id"],
            "is_supervisor": me["role"] == "supervisor"}


@app.get("/gloss/supervisor/overview")
def gloss_supervisor_overview(authorization: str | None = Header(None)):
    """Supervisors only (role checked here): every caregiver with a GLOSS
    account, sorted by name — Demonstrated / Retained / practised, pace,
    active days, last active, Parkinson's education — and the neutral
    one-line notes for the daily popup. Read-only; no rankings."""
    t0 = time.perf_counter()
    try:
        get_authenticated_supervisor(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    if not schema_ready(_db()):
        raise HTTPException(status_code=503, detail=MIGRATIONS_NEEDED)
    out = supervisor_report.load_overview(_db())
    logger.info("[GLOSS][SUPERVISOR] overview | caregivers=%d | duration_ms=%s", len(out["caregivers"]), _ms(t0))
    return out


@app.get("/gloss/supervisor/caregivers/{caregiver_profile_id}")
def gloss_supervisor_caregiver(caregiver_profile_id: str, authorization: str | None = Header(None)):
    """Supervisors only: one caregiver's numbers plus their progress summary
    (the same data as their own My Journey and progress report)."""
    try:
        get_authenticated_supervisor(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    if not schema_ready(_db()):
        raise HTTPException(status_code=503, detail=MIGRATIONS_NEEDED)
    detail = supervisor_report.load_caregiver(_db(), caregiver_profile_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="No such caregiver")
    return detail


@app.post("/gloss/supervisor/learner-profile")
def gloss_supervisor_learner_profile(authorization: str | None = Header(None)):
    """Supervisors only: create (or return) the caller's own learner profile,
    so they can practise signs and do Parkinson's education with their own
    progress. Name from profiles.name. Idempotent."""
    try:
        sup = get_authenticated_supervisor(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    try:
        learner_id = supervisor_report.create_supervisor_learner(_db(), sup["user_id"], sup["name"])
    except Exception as e:
        if "gloss_learners" in str(e):
            raise HTTPException(status_code=503, detail=LEARNERS_NEEDED)
        raise
    forget_learner(authorization)
    logger.info("[GLOSS][SUPERVISOR] learner profile ready | learner=%s", str(learner_id)[:8])
    return {"learner_id": learner_id}


@app.get("/gloss/progress/summary")
def gloss_progress_summary(authorization: str | None = Header(None)):
    """Levels, badges and My Journey for the caller: current level, the
    next level and exactly what is missing, per-category and per-sign
    status, skill / practice / monthly badges with dates, and active days
    this month. Built only from gloss_milestones and gloss_attempts
    (progress_summary.py). Needs migrations 0045-0047."""
    t0 = time.perf_counter()
    try:
        caregiver_profile_id = get_authenticated_caregiver(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    if not schema_ready(_db()):
        raise HTTPException(status_code=503, detail=MIGRATIONS_NEEDED)
    summary = load_summary(_db(), caregiver_profile_id)
    logger.info("[GLOSS][PROGRESS] summary | level=%s | demonstrated=%d | duration_ms=%s",
                (summary["level"] or {}).get("key"), summary["counts"]["demonstrated"], _ms(t0))
    return summary


@app.get("/gloss/recall/next")
def gloss_recall_next(authorization: str | None = Header(None)):
    """The word for the next Recall challenge: a sign the caller has
    practised, never a not-recommended one (recall_selector.py)."""
    try:
        caregiver_profile_id = get_authenticated_caregiver(_db(), authorization, context="GLOSS")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    if not schema_ready(_db()):
        raise HTTPException(status_code=503, detail=MIGRATIONS_NEEDED)
    sign_id = pick_recall_sign(load_attempts(_db(), caregiver_profile_id), load_milestones(_db(), caregiver_profile_id))
    if sign_id is None:
        raise HTTPException(status_code=404, detail="Practise a few signs first; the Recall challenge uses signs you have practised.")
    return {"sign_id": sign_id}


@app.get("/gloss/history")
def gloss_history(
    limit: int = 30,
    before: str | None = None,
    start: str | None = None,
    end: str | None = None,
    authorization: str | None = Header(None),
):
    """The caller's attempts, newest first, for the practice history list
    (Progress tab). before: older than this attempted_at (load more);
    start / end: one day only (calendar filter). Read-only; returns only
    per-attempt summary fields — never raw landmarks, video, or auth data.
    """
    t0 = time.perf_counter()
    logger.info("[GLOSS][HISTORY] request received | limit=%d", limit)
    try:
        caregiver_profile_id = get_authenticated_caregiver(
            _db(), authorization, context="GLOSS"
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    for value in (before, start, end):
        if value is not None:
            try:
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(status_code=400, detail="before / start / end must be ISO date-times")
    page = build_history_page(_db(), caregiver_profile_id, limit, before=before, start=start, end=end)
    logger.info("[GLOSS][HISTORY] response prepared | rows=%d | has_more=%s", len(page["attempts"]), page["has_more"])
    logger.info("[GLOSS][HISTORY] request completed | status=200 | duration_ms=%s", _ms(t0))
    return page


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
def pdedu_next_question(authorization: str | None = Header(None)):
    """Returns the next adaptively-selected Parkinson's education quiz
    question. Never reveals the correct answer, a correct-choice flag,
    or an answer index — only the question content itself.
    """
    t0 = time.perf_counter()
    logger.info("[PDEDU][NEXT_QUESTION] request received")
    try:
        caregiver_profile_id = get_authenticated_caregiver(
            _db(), authorization, context="PDEDU"
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    try:
        question_id = select_next_question(_db(), caregiver_profile_id)
    except ValueError as e:
        logger.exception(
            "[PDEDU][NEXT_QUESTION][ERROR] question selection failed | caregiver=%s",
            _short(caregiver_profile_id),
        )
        raise HTTPException(status_code=500, detail=str(e))

    question_result = (
        _db()
        .table("pdedu_questions")
        .select("id, symptom_id, question_type, prompt, choices")
        .eq("id", question_id)
        .limit(1)
        .execute()
    )
    question = question_result.data[0]

    symptom_result = (
        _db()
        .table("pdedu_symptoms")
        .select("display_name, definition")
        .eq("id", question["symptom_id"])
        .limit(1)
        .execute()
    )
    symptom = symptom_result.data[0]

    logger.info(
        "[PDEDU][QUIZ] next question selected | question=%s | symptom=%s",
        _short(question_id), question["symptom_id"],
    )
    logger.info(
        "[PDEDU][NEXT_QUESTION] request completed | status=200 | duration_ms=%s", _ms(t0)
    )
    return _serialize_pdedu_question(question, symptom)


@app.post("/pdedu/responses")
def pdedu_submit_response(body: PdeduResponseRequest, authorization: str | None = Header(None)):
    """Records one Parkinson's education quiz answer, updates mastery
    for the symptom being tested (not the incorrectly selected one),
    and returns the next adaptively-selected question.
    """
    t0 = time.perf_counter()
    logger.info("[PDEDU][RESPONSE] request received")
    try:
        caregiver_profile_id = get_authenticated_caregiver(
            _db(), authorization, context="PDEDU"
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    logger.info(
        "[PDEDU][QUIZ] answer received | question=%s | selected=%s",
        _short(body.question_id), body.selected_symptom_id,
    )

    question_result = (
        _db()
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

    _db().table("pdedu_responses").insert(
        {
            "caregiver_profile_id": caregiver_profile_id,
            "question_id": body.question_id,
            "selected_symptom_id": body.selected_symptom_id,
            "is_correct": is_correct,
        }
    ).execute()
    logger.info("[PDEDU][QUIZ] answer evaluated | is_correct=%s", is_correct)

    mastery_row = pdedu_update_mastery(_db(), caregiver_profile_id, correct_symptom_id, is_correct)
    logger.info(
        "[PDEDU][MASTERY] updated | symptom=%s | mastery_score=%s",
        correct_symptom_id, mastery_row["mastery_score"],
    )

    next_question_id = select_next_question(_db(), caregiver_profile_id)
    logger.info("[PDEDU][QUIZ] next question selected | question=%s", _short(next_question_id))
    logger.info("[PDEDU][RESPONSE] request completed | status=200 | duration_ms=%s", _ms(t0))

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
        return get_authenticated_caregiver(_db(), authorization, context="PDEDU")
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.get("/pdedu/symptoms")
def pdedu_list_symptoms(authorization: str | None = Header(None)):
    """The symptom education catalogue for the Explore Symptoms section:
    definition, learning tip, memory trick, and whether a demo video is
    available. Read-only reference data."""
    t0 = time.perf_counter()
    logger.info("[PDEDU][SYMPTOMS] request received")
    _pdedu_caregiver(authorization)

    symptoms = (
        _db()
        .table("pdedu_symptoms")
        .select("id, display_name, definition, learning_tip, memory_trick, display_order")
        .eq("is_active", True)
        .order("display_order")
        .execute()
    ).data or []

    videos = (
        _db()
        .table("pdedu_symptom_demo_videos")
        .select("symptom_id")
        .execute()
    ).data or []
    with_video = {v["symptom_id"] for v in videos}

    logger.info(
        "[PDEDU][DB] symptom catalogue loaded | active symptoms=%d | with video=%d",
        len(symptoms), len(with_video),
    )
    logger.info("[PDEDU][SYMPTOMS] request completed | status=200 | duration_ms=%s", _ms(t0))
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
def pdedu_symptom_demo_video(symptom_id: str, authorization: str | None = Header(None)):
    """A ready-to-play URL for a symptom's educational movement-pattern
    clip (Explore Symptoms -> Watch Example). The binary lives in
    Cloudflare R2; only a short-lived URL is returned — never R2
    credentials. 404 when no usable video exists yet."""
    t0 = time.perf_counter()
    logger.info("[PDEDU][VIDEO] request received | symptom=%s", symptom_id)
    _pdedu_caregiver(authorization)
    try:
        resolved = resolve_symptom_demo_video(_db(), symptom_id)
    except DemoVideoUnavailable as e:
        logger.warning("[PDEDU][VIDEO][WARNING] no usable clip | symptom=%s", symptom_id)
        raise HTTPException(status_code=404, detail=str(e))
    logger.info("[PDEDU][VIDEO] request completed | status=200 | duration_ms=%s", _ms(t0))
    return {"symptom_id": symptom_id, **resolved}


@app.post("/pdedu/quiz/start")
def pdedu_quiz_start(authorization: str | None = Header(None)):
    """Starts a Symptom Trainer quiz: creates a session and returns
    ~10 questions in random order (video + text, adapting to which
    symptoms actually have a video). Correct answers are never
    included in this payload."""
    t0 = time.perf_counter()
    logger.info("[PDEDU][QUIZ] start request received")
    caregiver_profile_id = _pdedu_caregiver(authorization)
    try:
        result = pdedu_start_session(_db(), caregiver_profile_id)
    except QuizError as e:
        logger.warning("[PDEDU][QUIZ][WARNING] start rejected | status=%d | reason=%s", e.status_code, e.detail)
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    logger.info(
        "[PDEDU][QUIZ] start completed | status=200 | questions=%d | duration_ms=%s",
        len(result.get("questions", [])), _ms(t0),
    )
    return result


@app.get("/pdedu/quiz/questions/{question_id}/demo-video")
def pdedu_quiz_question_video(question_id: str, authorization: str | None = Header(None)):
    """The clip for a video quiz question. Resolved by question id and
    the response deliberately omits the symptom_id, so watching the
    clip never reveals the answer. 404 when the question is not a video
    question or has no usable clip."""
    t0 = time.perf_counter()
    logger.info("[PDEDU][VIDEO] quiz-question clip requested | question=%s", _short(question_id))
    _pdedu_caregiver(authorization)

    result = (
        _db()
        .table("pdedu_questions")
        .select("id, symptom_id, format, is_active")
        .eq("id", question_id)
        .limit(1)
        .execute()
    )
    if not result.data or result.data[0]["format"] != "video" or not result.data[0]["is_active"]:
        logger.warning("[PDEDU][VIDEO][WARNING] not a playable video question | question=%s", _short(question_id))
        raise HTTPException(status_code=404, detail="No video for this question")

    try:
        resolved = resolve_symptom_demo_video(_db(), result.data[0]["symptom_id"])
    except DemoVideoUnavailable as e:
        logger.warning("[PDEDU][VIDEO][WARNING] no usable clip for quiz question | question=%s", _short(question_id))
        raise HTTPException(status_code=404, detail=str(e))
    logger.info("[PDEDU][VIDEO] quiz-question clip served | status=200 | duration_ms=%s", _ms(t0))
    # Note: symptom_id intentionally NOT returned.
    return resolved


@app.post("/pdedu/quiz/answer")
def pdedu_quiz_answer(body: PdeduQuizAnswerRequest, authorization: str | None = Header(None)):
    """Grades one answer server-side, persists the attempt, updates
    mastery + session totals, and returns correctness, the correct
    answer, explanation, tip, XP awarded and the current streak."""
    t0 = time.perf_counter()
    logger.info(
        "[PDEDU][QUIZ] answer received | session=%s | question=%s",
        _short(body.session_id), _short(body.question_id),
    )
    caregiver_profile_id = _pdedu_caregiver(authorization)
    try:
        result = pdedu_record_answer(
            _db(),
            caregiver_profile_id,
            body.session_id,
            body.question_id,
            body.selected_symptom_id,
        )
    except QuizError as e:
        logger.warning("[PDEDU][QUIZ][WARNING] answer rejected | status=%d | reason=%s", e.status_code, e.detail)
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    logger.info(
        "[PDEDU][QUIZ] answer evaluated | is_correct=%s | xp_awarded=%s | current_streak=%s | duration_ms=%s",
        result.get("is_correct"), result.get("xp_awarded"), result.get("current_streak"), _ms(t0),
    )
    return result


@app.post("/pdedu/quiz/{session_id}/complete")
def pdedu_quiz_complete(session_id: str, authorization: str | None = Header(None)):
    """Finalises a session and returns the end-of-quiz summary: score,
    XP, best streak, per-symptom breakdown, strongest / needs-review
    symptoms, milestone badges, and the list of incorrect answers for
    review."""
    t0 = time.perf_counter()
    logger.info("[PDEDU][QUIZ] complete request received | session=%s", _short(session_id))
    caregiver_profile_id = _pdedu_caregiver(authorization)
    try:
        result = pdedu_complete_session(_db(), caregiver_profile_id, session_id)
    except QuizError as e:
        logger.warning("[PDEDU][QUIZ][WARNING] complete rejected | status=%d | reason=%s", e.status_code, e.detail)
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    logger.info(
        "[PDEDU][QUIZ] quiz completed | status=200 | score=%s/%s | xp=%s | best_streak=%s | duration_ms=%s",
        result.get("correct_answers"), result.get("answered"),
        result.get("xp_earned"), result.get("best_streak"), _ms(t0),
    )
    return result


@app.get("/pdedu/progress")
def pdedu_progress(authorization: str | None = Header(None)):
    """The caller's Parkinson's learning progress: overall quiz score,
    totals, XP, best streak, and recognition accuracy in training per
    symptom. Read-only aggregation of the caller's own rows."""
    t0 = time.perf_counter()
    logger.info("[PDEDU][PROGRESS] request received")
    caregiver_profile_id = _pdedu_caregiver(authorization)
    report = build_pdedu_progress(_db(), caregiver_profile_id)
    logger.info("[PDEDU][PROGRESS] request completed | status=200 | duration_ms=%s", _ms(t0))
    return report


@app.get("/pdedu/history")
def pdedu_history(limit: int = 20, authorization: str | None = Header(None)):
    """The caller's most recent completed Symptom Trainer quizzes
    (newest first)."""
    t0 = time.perf_counter()
    logger.info("[PDEDU][HISTORY] request received | limit=%d", limit)
    caregiver_profile_id = _pdedu_caregiver(authorization)
    sessions = build_pdedu_history(_db(), caregiver_profile_id, limit)
    logger.info(
        "[PDEDU][HISTORY] request completed | status=200 | rows=%d | duration_ms=%s",
        len(sessions), _ms(t0),
    )
    return {"sessions": sessions}
