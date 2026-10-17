"""
scripts/diagnose_recognition.py
GLOSS component — recognition diagnosis. NOT part of the app.

Runs video files through the live attempt path, submit_attempt() itself:
MediaPipe subprocess -> preprocessing -> capture gates -> recognition +
DTW -> feedback. The database is an offline fake: nothing is read from
or written to Supabase. Each video's landmarks are extracted once, then
the rest of the path runs twice: gates ON (as live) and gates OFF
(diagnosis only: the gate values are still recorded).

The sign is the file name before the first "." (hello.mp4, hello.webm).

Usage (.venv):
  python scripts/diagnose_recognition.py --out results.json <video files or folders>
"""

import argparse
import json
import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)
os.environ.pop("GLOSS_TIMING_DETAIL", None)  # live default
os.environ.pop("GEMINI_API_KEY", None)  # no network: rule-based feedback only

import numpy as np  # noqa: E402

import attempt_submission  # noqa: E402
import grading  # noqa: E402
from capture_gates import check_capture  # noqa: E402
from extract_landmarks_bridge import extract_landmarks_via_subprocess  # noqa: E402
from preprocessing import N_HAND_LANDMARKS, N_POSE_LANDMARKS  # noqa: E402
from recogniser import load_ensemble  # noqa: E402

VIDEO_EXT = (".mp4", ".webm", ".mov", ".mkv")


# ---- offline stand-in for the Supabase client (no network, no writes) ----
class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, table, class_names):
        self.table, self.class_names = table, class_names
        self.filters, self.row = {}, None

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self.filters[col] = val
        return self

    def limit(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def insert(self, row, *a, **k):
        self.row = row
        return self

    upsert = insert

    def execute(self):
        if self.row is not None:
            return _Result([{"id": str(uuid.uuid4()), **self.row}])
        if self.table == "gloss_signs":
            if "id" in self.filters:
                return _Result([{"id": self.filters["id"]}] if self.filters["id"] in self.class_names else [])
            return _Result([{"id": s} for s in self.class_names])
        return _Result([])


class OfflineDb:
    def __init__(self, class_names):
        self.class_names = class_names

    def table(self, name):
        return _Query(name, self.class_names)


# ---- helpers ----
def hand_detection(raw: np.ndarray) -> dict:
    """% of frames with each MediaPipe hand detected (left = signer's left)."""
    left = raw[:, N_POSE_LANDMARKS:N_POSE_LANDMARKS + N_HAND_LANDMARKS]
    right = raw[:, N_POSE_LANDMARKS + N_HAND_LANDMARKS:]
    seen = lambda h: float((~np.isnan(h).all(axis=(1, 2))).mean() * 100)  # noqa: E731
    return {"left_hand_pct": round(seen(left), 1), "right_hand_pct": round(seen(right), 1),
            "pose_pct": round(float((~np.isnan(raw[:, :N_POSE_LANDMARKS]).all(axis=(1, 2))).mean() * 100), 1)}


def run_path(raw, sign, model, class_names, thresholds, gates_on: bool) -> dict:
    """submit_attempt() on already-extracted landmarks."""
    attempt_submission.extract_landmarks_via_subprocess = lambda *a, **k: raw
    if gates_on:
        attempt_submission.check_capture = check_capture
    else:
        attempt_submission.check_capture = lambda r, n: {**check_capture(r, n), "passed": True}
    res = attempt_submission.submit_attempt(
        OfflineDb(class_names), str(uuid.uuid4()), sign, "webcam",
        video_path="(landmarks already extracted)", model=model,
        class_names=class_names, class_thresholds=thresholds,
    )
    d = res.get("diagnostics", {})
    cap = d.get("capture_check") or res.get("capture_check") or {}
    top3 = d.get("top3") or []
    if res["outcome"] == "capture_rejected":
        decided_by = f"{cap.get('reason')} gate"
    elif res["outcome"] == "not_recognised":
        decided_by = "confidence gate (< 0.35)"
    else:
        decided_by = "model"
    return {
        "outcome": res["outcome"],
        "decided_by": decided_by,
        "confidence": d.get("confidence"),
        "top3": [(t["sign_id"], round(t["confidence"], 3)) for t in top3],
        "hand_presence": cap.get("hand_presence"),
        "motion_extent": cap.get("motion_extent"),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("paths", nargs="+")
    args = ap.parse_args()

    videos = []
    for p in args.paths:
        if os.path.isdir(p):
            videos += [os.path.join(p, f) for f in sorted(os.listdir(p)) if f.lower().endswith(VIDEO_EXT)]
        else:
            videos.append(p)

    model = load_ensemble()
    grading.load_assets()
    class_names = grading.load_class_names()
    thresholds = grading.load_thresholds()

    def extract(path):
        try:
            return path, extract_landmarks_via_subprocess(path), None
        except Exception as e:  # recorded, not fatal
            return path, None, f"{type(e).__name__}: {str(e)[:200]}"

    with ThreadPoolExecutor(args.workers) as pool:
        extracted = list(pool.map(extract, videos))

    rows = []
    for path, raw, err in extracted:
        sign = os.path.basename(path).split(".")[0]
        row = {"file": os.path.basename(path), "sign": sign}
        if raw is None:
            row["error"] = err
        else:
            gate_values = check_capture(raw, attempt_submission.normalize_raw_landmarks(raw))
            row.update(frames=int(raw.shape[0]), **hand_detection(raw),
                       gate_reason_if_on=gate_values["reason"],
                       gates_on=run_path(raw, sign, model, class_names, thresholds, True),
                       gates_off=run_path(raw, sign, model, class_names, thresholds, False))
        rows.append(row)
        g = row.get("gates_on", {})
        print(f"{row['file']:<22} frames={row.get('frames', '-'):>4} L={row.get('left_hand_pct', '-'):>5}% "
              f"R={row.get('right_hand_pct', '-'):>5}% -> {g.get('outcome', row.get('error'))} "
              f"conf={g.get('confidence')} top3={g.get('top3')}")

    with open(args.out, "w") as f:
        json.dump(rows, f, indent=1)

    ok = [r for r in rows if "gates_on" in r]
    for mode in ("gates_on", "gates_off"):
        correct = sum(r[mode]["outcome"] == "target_sign" for r in ok)
        print(f"{mode}: {correct}/{len(rows)} recognised as the right sign")


if __name__ == "__main__":
    main()
