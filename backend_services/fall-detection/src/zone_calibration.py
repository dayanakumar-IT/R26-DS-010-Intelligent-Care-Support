"""
Zone calibration from passive observation.

Watches the camera for `duration_s` seconds, records the body-centre position
(midpoint of left and right hip joints) for each frame where both hips are
visible, then clusters the positions into three zones with K-Means:

  Cluster with lowest  centroid-y  → BED   (patient spends most time lying/sitting)
  Cluster with middle  centroid-y  → CHAIR (seated activity area)
  Cluster with highest centroid-y  → WALKING (standing / ambulatory area)

(Y increases downward in image space, so lowest y-value = highest in the frame.)

The convex hull of each cluster's points is saved as a polygon in the same
normalised [0,1] format that the manual zone editor produces, so the rest of
the system (context_engine.py, web dashboard) can load it without any changes.

Output: backend_services/fall-detection/config/zones_auto.json

Usage
-----
    python -m src.zone_calibration            # 75-second capture, camera 0
    python -m src.zone_calibration --duration 60 --camera 1
    python -m src.zone_calibration --video path/to/video.mp4

Then in .env set:  ZONES_FILE=config/zones_auto.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import List, Tuple

import cv2
import mediapipe as mp
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import JOINT

# MediaPipe landmark indices for hips
_MP_L_HIP = 23
_MP_R_HIP = 24

_CONFIG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "config",
)
OUTPUT_PATH = os.path.join(_CONFIG_DIR, "zones_auto.json")

# Minimum body-centre samples needed for a meaningful calibration
_MIN_SAMPLES = 30


def _collect_body_centres(
    source: int | str,
    duration_s: float,
) -> np.ndarray:
    """
    Open `source` (camera index or video path), run MediaPipe Pose for
    `duration_s` seconds, and return an (N, 2) array of normalised (x, y)
    body-centre positions.
    """
    pose = mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=0,       # fastest — calibration does not need accuracy
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    if isinstance(source, int):
        cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
    else:
        cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video source: {source!r}")

    centres: List[Tuple[float, float]] = []
    t_start = time.time()
    print(f"[zone_calibration] Collecting for {duration_s:.0f} s from source {source!r} …")

    while True:
        elapsed = time.time() - t_start
        if elapsed >= duration_s:
            break

        ok, frame = cap.read()
        if not ok:
            if isinstance(source, str):
                break   # video ended
            time.sleep(0.033)
            continue

        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = pose.process(rgb)

        if res.pose_landmarks:
            lm = res.pose_landmarks.landmark
            lh = lm[_MP_L_HIP]
            rh = lm[_MP_R_HIP]
            # Both hips must be reasonably visible
            if lh.visibility >= 0.4 and rh.visibility >= 0.4:
                cx = (lh.x + rh.x) / 2.0
                cy = (lh.y + rh.y) / 2.0
                centres.append((cx, cy))

        remaining = duration_s - elapsed
        print(f"\r  {elapsed:5.1f}/{duration_s:.0f} s  —  {len(centres)} samples", end="", flush=True)

    print()  # newline after progress
    cap.release()
    pose.close()

    return np.array(centres, dtype=np.float32) if centres else np.empty((0, 2), dtype=np.float32)


def _cluster_to_zones(centres: np.ndarray) -> dict:
    """
    K-Means (k=3) on body-centre positions → BED / CHAIR / WALKING zones.
    Returns a dict in the same format as the manual zone editor.
    """
    from sklearn.cluster import KMeans
    try:
        from scipy.spatial import ConvexHull as _ConvexHull
        _HAS_SCIPY = True
    except ImportError:
        _HAS_SCIPY = False

    k = min(3, len(centres))
    if k < 2:
        raise ValueError(
            f"Only {len(centres)} samples collected — not enough to fit zones. "
            "Ensure the patient moves through all activity areas during calibration."
        )

    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(centres)
    centroids = km.cluster_centers_   # shape (k, 2): [x, y]

    # Sort clusters by centroid Y ascending (lowest Y = highest in frame = WALKING area)
    order = np.argsort(centroids[:, 1])   # ascending y → top of frame first
    zone_names = ["WALKING", "CHAIR", "BED"] if k == 3 else (["WALKING", "BED"] if k == 2 else ["WALKING"])

    zones: dict = {}
    for rank, cluster_idx in enumerate(order):
        name = zone_names[rank]
        pts = centres[labels == cluster_idx]

        if len(pts) >= 3 and _HAS_SCIPY:
            try:
                hull = _ConvexHull(pts)
                polygon = pts[hull.vertices].tolist()
            except Exception:
                polygon = pts.tolist()
        elif len(pts) >= 3:
            # Fallback: bounding-box rectangle when scipy not available
            x_min, y_min = pts.min(axis=0)
            x_max, y_max = pts.max(axis=0)
            polygon = [[x_min, y_min], [x_max, y_min], [x_max, y_max], [x_min, y_max]]
        else:
            polygon = pts.tolist()

        # Clamp to [0,1]
        polygon = [[float(np.clip(p[0], 0.0, 1.0)), float(np.clip(p[1], 0.0, 1.0))] for p in polygon]
        zones[name] = polygon

    return zones


def calibrate(
    source: int | str = 0,
    duration_s: float = 75.0,
    output_path: str = OUTPUT_PATH,
) -> str:
    """
    Run full calibration pipeline. Returns the path of the saved JSON file.
    """
    centres = _collect_body_centres(source, duration_s)

    if len(centres) < _MIN_SAMPLES:
        raise ValueError(
            f"Only {len(centres)} valid frames captured (need ≥{_MIN_SAMPLES}). "
            "Check that the patient/subject moves through the room during calibration "
            "and that the camera has a clear view."
        )

    print(f"[zone_calibration] {len(centres)} samples — fitting K-Means (k=3) …")
    zones = _cluster_to_zones(centres)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    payload = {
        "source": "auto_calibration",
        "captured_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "sample_count": int(len(centres)),
        "zones": zones,
    }
    with open(output_path, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"[zone_calibration] Zones saved → {output_path}")
    for name, poly in zones.items():
        print(f"  {name}: {len(poly)} hull vertices")

    return output_path


# ── API endpoint helper ────────────────────────────────────────────────────────

def run_calibration_background(
    source: int | str = 0,
    duration_s: float = 75.0,
    output_path: str = OUTPUT_PATH,
) -> None:
    """
    Intended to be called from a FastAPI background task.
    Writes progress to stdout; result saved to output_path.
    """
    try:
        calibrate(source=source, duration_s=duration_s, output_path=output_path)
    except Exception as exc:
        print(f"[zone_calibration] FAILED: {exc}")


# ── CLI ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SENTRY zone auto-calibration")
    parser.add_argument("--duration", type=float, default=75.0,
                        help="Observation window in seconds (default 75)")
    parser.add_argument("--camera", type=int, default=0,
                        help="Camera index (default 0)")
    parser.add_argument("--video", type=str, default=None,
                        help="Path to a video file (overrides --camera)")
    parser.add_argument("--output", type=str, default=OUTPUT_PATH,
                        help=f"Output JSON path (default {OUTPUT_PATH})")
    args = parser.parse_args()

    src = args.video if args.video else args.camera
    calibrate(source=src, duration_s=args.duration, output_path=args.output)
