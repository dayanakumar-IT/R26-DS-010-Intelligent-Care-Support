"""
extract_landmarks_bridge.py
GLOSS component — subprocess bridge from .venv to .venv_mediapipe.

The main backend (.venv) cannot import mediapipe. This module shells
out to extract_landmarks_worker.py running under the separate
.venv_mediapipe interpreter, and loads back the raw (T, 49, 3)
landmark array it writes.

This module itself imports only numpy/stdlib — it is safe to import
from the main .venv without mediapipe installed.
"""

import json
import os
import subprocess
import tempfile
import time

import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORKER_SCRIPT = os.path.join(BASE_DIR, "extract_landmarks_worker.py")

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


def extract_landmarks_via_subprocess(
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
