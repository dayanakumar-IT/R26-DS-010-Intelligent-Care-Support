"""
extract_landmarks_server.py
GLOSS component — long-running MediaPipe extraction worker.

Same job and same code as extract_landmarks_worker.py, but started once
(under .venv_mediapipe) and kept alive, so the ~2-3 s of Python start-up
and mediapipe imports is paid once per server start instead of once per
attempt. Landmarks are identical: every video gets a NEW Holistic instance
with the training settings (landmark_extraction.make_holistic), exactly
like the one-shot worker, so no tracking state carries over between videos
(tests/test_persistent_worker.py compares the two byte for byte).

Protocol: one JSON object per line on stdin
    {"video": "<path>", "out": "<path to .npy>"}
and one JSON line per request on stdout
    {"ok": true, "frames": T, "timings": {...}}   landmarks saved to "out"
    {"ok": false, "code": 2, "error": "..."}      no landmarks (like exit code 2)
    {"ok": false, "code": 1, "error": "..."}      any other failure
A {"warmup": true} request runs one blank frame through a fresh Holistic so
the models are loaded before the first real attempt.
"""

import time

_T_START = time.time()

import json  # noqa: E402
import sys  # noqa: E402
import traceback  # noqa: E402

import numpy as np  # noqa: E402

from landmark_extraction import extract_landmarks_from_video, make_holistic  # noqa: E402

_T_IMPORTED = time.time()


def handle(req: dict) -> dict:
    if req.get("warmup"):
        holistic = make_holistic()
        try:
            holistic.process(np.zeros((480, 640, 3), dtype=np.uint8))
        finally:
            holistic.close()
        return {"ok": True, "warmup": True, "imports_s": round(_T_IMPORTED - _T_START, 2)}

    t0 = time.time()
    holistic = make_holistic()          # fresh instance per video: no state carried over
    t_model = time.time()
    try:
        raw = extract_landmarks_from_video(req["video"], holistic)
    finally:
        t_frames = time.time()
        holistic.close()
    if raw is None:
        return {"ok": False, "code": 2, "error": f"No frames/landmarks could be extracted from: {req['video']}"}
    np.save(req["out"], raw)
    return {"ok": True, "frames": int(raw.shape[0]), "timings": {
        "start": t0, "model_loaded": t_model, "frames_done": t_frames, "saved": time.time()}}


def main():
    out = sys.stdout
    out.write(json.dumps({"ready": True, "imports_s": round(_T_IMPORTED - _T_START, 2)}) + "\n")
    out.flush()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            reply = handle(json.loads(line))
        except Exception as e:  # report and keep serving
            reply = {"ok": False, "code": 1, "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()[-800:]}
        out.write(json.dumps(reply) + "\n")
        out.flush()


if __name__ == "__main__":
    main()
