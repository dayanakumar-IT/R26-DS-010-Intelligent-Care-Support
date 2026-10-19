"""
Phase 0 (read-only): find the source video of each of the 59 DTW reference
signs and prove the match.

How the references were made (from notebook 01 / 03):
  - notebook 01 ran MediaPipe on EVERY frame of each video in
    Sign_Language_PP2/<category>/<sign>/<file>.mp4 (no trimming) and saved
    PP2_Preprocessed_RERUN/normalized/<sign>/<file>.npy, shape (T, 49, 3);
  - notebook 03 picked one medoid per sign and wrote reference_exemplars.npz
    (sign -> (T, 147)) plus reference_exemplars.csv (sign -> file name).

This script checks each reference against its normalized .npy with
np.array_equal (or max abs diff < 1e-6), then reads fps / resolution /
frame count from the video. Nothing is guessed: a sign whose file is
missing, ambiguous or not equal is reported as unmatched.

Run in Colab with Drive mounted:
    from google.colab import drive; drive.mount('/content/drive')
    !python colab_find_sources.py
or locally with the four paths below pointing at a copy.
Writes reference_sources.json next to this script (or OUT_PATH).
"""

import csv
import glob
import json
import os

import cv2
import numpy as np

# ---- set these ----
DATASET_ROOT = "/content/drive/MyDrive/Sign_Language_PP2"
NORMALIZED_ROOT = "/content/drive/MyDrive/PP2_Preprocessed_RERUN/normalized"
REFERENCE_NPZ = "/content/drive/MyDrive/CareSense_Layer3_DTW_RERUN/reference_exemplars.npz"
REFERENCE_CSV = "/content/drive/MyDrive/CareSense_Layer3_DTW_RERUN/reference_exemplars.csv"
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reference_sources.json")
# -------------------

TOLERANCE = 1e-6
VIDEO_EXTS = (".mp4", ".mov", ".avi", ".mkv", ".webm")


def video_info(path):
    cap = cv2.VideoCapture(path)
    info = {
        "fps": cap.get(cv2.CAP_PROP_FPS),
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        "frame_count_header": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
    }
    decoded = 0
    while cap.read()[0]:  # notebook 01 used every frame cv2 decoded
        decoded += 1
    cap.release()
    info["frame_count_decoded"] = decoded
    return info


def main():
    refs = np.load(REFERENCE_NPZ)
    with open(REFERENCE_CSV, newline="") as f:
        named = {r["class"]: r for r in csv.DictReader(f)}

    results = {}
    for sign in sorted(refs.files):
        ref = refs[sign]
        row = named.get(sign)
        rec = {"sign": sign, "reference_frames": int(ref.shape[0]), "dataset": None,
               "video_file": None, "video_path": None, "frame_range": None, "status": "unmatched"}
        if row is None:
            rec["reason"] = "sign missing from reference_exemplars.csv"
            results[sign] = rec
            continue

        stem = os.path.splitext(row["reference_video"])[0]
        rec["dataset"] = "ASL Citizen" if stem.startswith("asl_citizen_") else "WLASL"
        npy_path = os.path.join(NORMALIZED_ROOT, sign, stem + ".npy")
        videos = [p for p in glob.glob(os.path.join(DATASET_ROOT, "*", sign, stem + ".*"))
                  if p.lower().endswith(VIDEO_EXTS)]

        if not os.path.exists(npy_path):
            rec["reason"] = f"normalized array not found: {npy_path}"
        elif len(videos) != 1:
            rec["reason"] = f"expected exactly 1 video, found {len(videos)}: {videos}"
        else:
            arr = np.load(npy_path)
            flat = arr.reshape(arr.shape[0], -1).astype(np.float32)
            same_shape = flat.shape == ref.shape
            max_diff = float(np.abs(flat - ref).max()) if same_shape else None
            rec["max_abs_diff"] = max_diff
            rec["video_file"] = os.path.basename(videos[0])
            rec["video_path"] = os.path.relpath(videos[0], DATASET_ROOT).replace(os.sep, "/")
            rec.update(video_info(videos[0]))
            if not same_shape:
                rec["reason"] = f"shape {flat.shape} != reference {ref.shape}"
            elif max_diff > TOLERANCE:
                rec["reason"] = f"arrays differ (max abs diff {max_diff:.3g})"
            elif rec["frame_count_decoded"] != ref.shape[0]:
                rec["reason"] = (f"video decodes to {rec['frame_count_decoded']} frames, "
                                 f"reference has {ref.shape[0]}")
            else:
                rec["status"] = "matched"
                # whole video, as notebook 01 used it
                rec["frame_range"] = [0, int(ref.shape[0]) - 1]
        results[sign] = rec
        print(f"{sign:12s} {rec['status']:9s} {rec.get('video_path') or ''} {rec.get('reason', '')}")

    out = {
        "note": "ASL Citizen videos were renamed to asl_citizen_NNN when Sign_Language_PP2 was built; "
                "the original ASL Citizen file name / signer id was not recorded.",
        "dataset_root": DATASET_ROOT,
        "signs": results,
    }
    with open(OUT_PATH, "w") as f:
        json.dump(out, f, indent=2)
    n = sum(r["status"] == "matched" for r in results.values())
    print(f"\n{n}/{len(results)} matched -> {OUT_PATH}")


if __name__ == "__main__":
    main()
