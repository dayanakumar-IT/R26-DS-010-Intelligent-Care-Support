"""
Phase 1: re-extract richer MediaPipe data from each reference sign's source
video, for DISPLAY ONLY (the avatar). Grading never reads these files.

Per frame it stores, with missing detections as null (never zeros):
  pose:  33 image landmarks [x, y, z, visibility] + 33 world landmarks [x, y, z, visibility]
  left_hand / right_hand: 21 image + 21 world landmarks [x, y, z]
  face:  478 landmarks [x, y, z], 52 blendshape scores, 4x4 face transformation matrix

Two MediaPipe Tasks models run in VIDEO mode on the same frames:
  - HolisticLandmarker: pose, both hands (already labelled as the signer's
    left/right from the pose model, same convention as the grading data),
    face landmarks and blendshapes;
  - FaceLandmarker: only for the facial transformation matrix (head
    rotation), which HolisticLandmarker does not output.

Usage (local, .venv_avatar):
    python extract_motion.py hello please angry help
Colab (videos in Drive): add --video-root /content/drive/MyDrive/Sign_Language_PP2
Output: extracted/<sign>.json.gz (gitignored).
"""

import argparse
import gzip
import json
import os
import sys

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python import vision

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "models")


def round_list(values, nd=5):
    return [round(float(v), nd) for v in values]


def pose_image(lms):
    return [round_list([l.x, l.y, l.z, l.visibility]) for l in lms] if lms else None


def pose_world(lms):
    return [round_list([l.x, l.y, l.z, l.visibility]) for l in lms] if lms else None


def xyz(lms):
    return [round_list([l.x, l.y, l.z]) for l in lms] if lms else None


def make_landmarkers():
    holistic = vision.HolisticLandmarker.create_from_options(vision.HolisticLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=os.path.join(MODELS, "holistic_landmarker.task")),
        running_mode=vision.RunningMode.VIDEO,
        output_face_blendshapes=True,
    ))
    face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=os.path.join(MODELS, "face_landmarker.task")),
        running_mode=vision.RunningMode.VIDEO,
        num_faces=1,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=True,
    ))
    return holistic, face


def extract(video_path, frame_range):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    first, last = frame_range
    holistic, face = make_landmarkers()
    blendshape_names = None
    frames = []
    idx = -1
    try:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            idx += 1
            if idx < first:
                continue
            if idx > last:
                break
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            ts_ms = int(round(idx * 1000.0 / fps))
            h = holistic.detect_for_video(image, ts_ms)
            f = face.detect_for_video(image, ts_ms)

            blend = None
            if h.face_blendshapes:
                cats = h.face_blendshapes if hasattr(h.face_blendshapes[0], "score") else h.face_blendshapes[0]
                if blendshape_names is None:
                    blendshape_names = [c.category_name for c in cats]
                blend = round_list([c.score for c in cats], 4)
            matrix = None
            if f.facial_transformation_matrixes:
                matrix = round_list(f.facial_transformation_matrixes[0].flatten().tolist(), 6)

            frames.append({
                "frame": idx,
                "t": round(idx / fps, 5),
                "pose": pose_image(h.pose_landmarks),
                "pose_world": pose_world(h.pose_world_landmarks),
                "left_hand": xyz(h.left_hand_landmarks),
                "left_hand_world": xyz(h.left_hand_world_landmarks),
                "right_hand": xyz(h.right_hand_landmarks),
                "right_hand_world": xyz(h.right_hand_world_landmarks),
                "face": xyz(h.face_landmarks),
                "blendshapes": blend,
                "face_matrix": matrix,
            })
    finally:
        holistic.close()
        face.close()
        cap.release()
    return {"fps": fps, "width": width, "height": height, "frame_range": [first, last],
            "blendshape_names": blendshape_names, "frames": frames}


def detection_rates(frames):
    n = len(frames) or 1
    pct = lambda key: round(100.0 * sum(fr[key] is not None for fr in frames) / n, 1)
    return {"left_hand": pct("left_hand"), "right_hand": pct("right_hand"),
            "face": pct("face"), "pose": pct("pose"), "face_matrix": pct("face_matrix")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("signs", nargs="+")
    ap.add_argument("--sources", default=os.path.join(HERE, "reference_sources.json"))
    ap.add_argument("--video-root", default=None, help="Sign_Language_PP2 root (Colab)")
    ap.add_argument("--videos", default=os.path.join(HERE, "videos"), help="local copies: <sign>__<file>")
    ap.add_argument("--out", default=os.path.join(HERE, "extracted"))
    args = ap.parse_args()

    with open(args.sources) as f:
        sources = json.load(f)["signs"]
    with open(os.path.join(HERE, "model_versions.json"), encoding="utf-8-sig") as f:
        model_versions = json.load(f)
    os.makedirs(args.out, exist_ok=True)

    for sign in args.signs:
        src = sources.get(sign)
        if not src or src.get("status") != "matched":
            print(f"{sign}: skipped (source not matched; stays on the 2D guide)")
            continue
        path = (os.path.join(args.video_root, src["video_path"]) if args.video_root
                else os.path.join(args.videos, f"{sign}__{src['video_file']}"))
        if not os.path.exists(path):
            print(f"{sign}: video not found at {path}")
            continue
        data = extract(path, src["frame_range"])
        expected = src["frame_range"][1] - src["frame_range"][0] + 1
        if len(data["frames"]) != expected:
            sys.exit(f"{sign}: decoded {len(data['frames'])} frames, expected {expected}")
        data.update({
            "sign": sign,
            "source": {"dataset": src["dataset"], "video_id": os.path.splitext(src["video_file"])[0],
                       "video_path": src["video_path"], "frame_range": src["frame_range"]},
            "extraction_versions": {"mediapipe": mp.__version__, "opencv": cv2.__version__,
                                    "models": model_versions},
            "detection_pct": detection_rates(data["frames"]),
        })
        out = os.path.join(args.out, f"{sign}.json.gz")
        with gzip.open(out, "wt", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
        d = data["detection_pct"]
        print(f"{sign:8s} frames={len(data['frames'])} fps={data['fps']:.3f} "
              f"left_hand={d['left_hand']}% right_hand={d['right_hand']}% face={d['face']}% "
              f"pose={d['pose']}% head_matrix={d['face_matrix']}%  -> {os.path.relpath(out, HERE)}")


if __name__ == "__main__":
    main()
