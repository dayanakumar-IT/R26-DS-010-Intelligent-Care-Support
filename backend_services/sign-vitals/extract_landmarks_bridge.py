"""
extract_landmarks_bridge.py
GLOSS component — subprocess bridge from .venv to .venv_mediapipe.

The main backend (.venv) cannot import mediapipe. This module shells
out to extract_landmarks_worker.py running under the separate
.venv_mediapipe interpreter, and loads back the raw (T, 49, 3)
landmark array it writes.

Two ways, same landmarks:
  - a long-running worker (extract_landmarks_server.py, started once and
    kept alive; a fresh Holistic per video) — the default, saves the
    ~2-3 s Python + mediapipe start-up per attempt;
  - the one-shot worker (extract_landmarks_worker.py, one process per
    video) — used if the long-running worker is unavailable or fails.

This module itself imports only numpy/stdlib — it is safe to import
from the main .venv without mediapipe installed.
"""

import atexit
import json
import logging
import os
import subprocess
import tempfile
import threading
import time

import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORKER_SCRIPT = os.path.join(BASE_DIR, "extract_landmarks_worker.py")
SERVER_SCRIPT = os.path.join(BASE_DIR, "extract_landmarks_server.py")
logger = logging.getLogger("sign_vitals")

# Candidate locations for the .venv_mediapipe interpreter — Windows
# (Scripts/python.exe) first since that's the current dev environment,
# with a POSIX (bin/python) fallback for portability.
_MEDIAPIPE_PYTHON_CANDIDATES = [
    os.path.join(BASE_DIR, ".venv_mediapipe", "Scripts", "python.exe"),
    os.path.join(BASE_DIR, ".venv_mediapipe", "bin", "python"),
]

DEFAULT_TIMEOUT_SECONDS = 180


class LandmarkExtractionError(RuntimeError):
    """Raised for infrastructure-level subprocess failures (bad interpreter
    path, worker crash, unexpected output) — not the video's fault."""


class NoLandmarksExtractedError(LandmarkExtractionError):
    """Raised when the video itself produced no usable frames/landmarks
    (worker exit code 2, per extract_landmarks_worker.py's documented
    contract) — e.g. a corrupt, empty, or unreadable video file."""


def _find_mediapipe_python() -> str:
    for candidate in _MEDIAPIPE_PYTHON_CANDIDATES:
        if os.path.isfile(candidate):
            return candidate
    raise FileNotFoundError(
        "Could not find the .venv_mediapipe Python interpreter. Checked: "
        + ", ".join(_MEDIAPIPE_PYTHON_CANDIDATES)
    )


def _stage_timings(stdout: str, launched: float, returned: float) -> dict:
    """Split the subprocess time using the worker's TIMINGS line (ms)."""
    for line in stdout.splitlines():
        if line.startswith("TIMINGS "):
            m = json.loads(line[len("TIMINGS "):])
            ms = lambda a, b: round((b - a) * 1000, 1)  # noqa: E731
            return {
                "process_start_ms": ms(launched, m["start"]),
                "imports_ms": ms(m["start"], m["imported"]),
                "model_load_ms": ms(m["imported"], m["model_loaded"]),
                "frames_ms": ms(m["model_loaded"], m["frames_done"]),
                "save_ms": ms(m["frames_done"], m["saved"]),
                "process_exit_ms": ms(m["saved"], returned),
                "frames": m["frames"],
            }
    return {}


def _extract_one_shot(
    video_path: str, timeout: float = DEFAULT_TIMEOUT_SECONDS, timings: dict | None = None
) -> np.ndarray:
    """
    Runs extract_landmarks_worker.py under .venv_mediapipe to extract
    raw landmarks from video_path, and returns the resulting array.
    If `timings` is given, it is filled with the subprocess stage times.

    Returns: np.ndarray of shape (T, 49, 3).
    Raises: FileNotFoundError, ValueError, RuntimeError, or
      subprocess.TimeoutExpired on any failure.
    """
    video_path = os.path.abspath(video_path)
    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    mediapipe_python = _find_mediapipe_python()
    if not os.path.isfile(WORKER_SCRIPT):
        raise FileNotFoundError(f"Worker script not found: {WORKER_SCRIPT}")

    fd, output_path = tempfile.mkstemp(suffix=".npy", prefix="gloss_landmarks_")
    os.close(fd)

    try:
        launched = time.time()
        result = subprocess.run(
            [mediapipe_python, WORKER_SCRIPT, video_path, output_path],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if timings is not None:
            timings.update(_stage_timings(result.stdout, launched, time.time()))

        if result.returncode == 2:
            raise NoLandmarksExtractedError(
                f"No landmarks could be extracted from video: {video_path}\n"
                f"stderr: {result.stderr}"
            )

        if result.returncode != 0:
            raise LandmarkExtractionError(
                f"MediaPipe extraction subprocess failed (exit code {result.returncode}).\n"
                f"stdout: {result.stdout}\nstderr: {result.stderr}"
            )

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise LandmarkExtractionError(
                "MediaPipe extraction subprocess reported success but produced no output file.\n"
                f"stdout: {result.stdout}\nstderr: {result.stderr}"
            )

        raw = np.load(output_path)

        if raw.ndim != 3 or raw.shape[1:] != (49, 3):
            raise LandmarkExtractionError(
                f"Unexpected raw landmark shape {raw.shape} (expected (T, 49, 3))"
            )

        return raw
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)


# ---------------------------------------------------------------
# Long-running worker
# ---------------------------------------------------------------
class _PersistentWorker:
    """One extract_landmarks_server.py process, used one video at a time."""

    def __init__(self):
        self._proc = None
        self._lock = threading.Lock()

    def _start(self):
        self._proc = subprocess.Popen(
            [_find_mediapipe_python(), SERVER_SCRIPT],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, bufsize=1, cwd=BASE_DIR,
        )
        hello = self._read()
        if not hello.get("ready"):
            raise LandmarkExtractionError(f"MediaPipe worker did not start: {hello}")
        logger.info("[GLOSS][MEDIAPIPE] long-running worker started | imports_s=%s | unthrottled=%s",
                    hello.get("imports_s"), hello.get("unthrottled"))

    def _read(self) -> dict:
        while True:
            line = self._proc.stdout.readline()
            if not line:
                raise LandmarkExtractionError("MediaPipe worker exited")
            line = line.strip()
            if line.startswith("{"):
                return json.loads(line)

    def request(self, payload: dict) -> dict:
        with self._lock:
            if self._proc is None or self._proc.poll() is not None:
                self._start()
            self._proc.stdin.write(json.dumps(payload) + "\n")
            self._proc.stdin.flush()
            return self._read()

    def stop(self):
        if self._proc and self._proc.poll() is None:
            self._proc.kill()


_worker = _PersistentWorker()
atexit.register(_worker.stop)


def warm_up_worker() -> bool:
    """Start the long-running worker and load its models (server start)."""
    try:
        return bool(_worker.request({"warmup": True}).get("ok"))
    except Exception:
        logger.exception("[GLOSS][MEDIAPIPE] warm-up failed — the one-shot worker will be used")
        return False


def _extract_persistent(video_path: str, timings: dict | None) -> np.ndarray:
    video_path = os.path.abspath(video_path)
    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    fd, output_path = tempfile.mkstemp(suffix=".npy", prefix="gloss_landmarks_")
    os.close(fd)
    try:
        sent = time.time()
        reply = _worker.request({"video": video_path, "out": output_path})
        done = time.time()
        if not reply.get("ok"):
            if reply.get("code") == 2:
                raise NoLandmarksExtractedError(reply.get("error", "no landmarks"))
            raise LandmarkExtractionError(reply.get("error", "worker error"))
        if timings is not None:
            m = reply["timings"]
            ms = lambda a, b: round((b - a) * 1000, 1)  # noqa: E731
            timings.update({
                "worker": "long-running",
                "process_start_ms": 0.0, "imports_ms": 0.0,
                "model_load_ms": ms(m["start"], m["model_loaded"]),
                "frames_ms": ms(m["model_loaded"], m["frames_done"]),
                "save_ms": ms(m["frames_done"], m["saved"]),
                "handoff_ms": round((done - sent) * 1000 - (m["saved"] - m["start"]) * 1000, 1),
                "frames": reply["frames"],
            })
        raw = np.load(output_path)
        if raw.ndim != 3 or raw.shape[1:] != (49, 3):
            raise LandmarkExtractionError(f"Unexpected raw landmark shape {raw.shape} (expected (T, 49, 3))")
        return raw
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)


def extract_landmarks_via_subprocess(
    video_path: str, timeout: float = DEFAULT_TIMEOUT_SECONDS, timings: dict | None = None
) -> np.ndarray:
    """
    Raw (T, 49, 3) landmarks for video_path, NaN where not detected.
    Uses the long-running worker; falls back to the one-shot worker if it is
    unavailable (both run the same extraction code, same landmarks).
    `timings`, if given, is filled with the stage times.
    """
    if os.environ.get("GLOSS_MEDIAPIPE_ONE_SHOT") != "1":
        try:
            return _extract_persistent(video_path, timings)
        except (NoLandmarksExtractedError, FileNotFoundError):
            raise
        except Exception:
            logger.exception("[GLOSS][MEDIAPIPE] long-running worker failed — using the one-shot worker")
            _worker.stop()
    if timings is not None:
        timings["worker"] = "one-shot"
    return _extract_one_shot(video_path, timeout=timeout, timings=timings)
