"""
Phase 0 follow-up for references that did not match the file named in
reference_exemplars.csv (arm, back).

For each sign it compares the reference against
  1. every normalized sequence in that sign's own folder, and
  2. every normalized sequence anywhere in the dataset with the same frame count,
and prints the closest candidates by max abs diff. If exactly one candidate is
exact (max abs diff < 1e-6) the mapping in reference_sources.json is corrected;
otherwise nothing is written and the candidates are left for a human decision.

Run in Colab with Drive mounted (same paths as colab_find_sources.py):
    !python colab_find_closest.py arm back
To search another preprocessing run (e.g. the original August one):
    !python colab_find_closest.py arm back --normalized-root /content/drive/MyDrive/PP2_Preprocessed_Sign_Language/normalized
"""

import argparse
import glob
import json
import os

import numpy as np

from colab_find_sources import (DATASET_ROOT, NORMALIZED_ROOT, OUT_PATH, REFERENCE_NPZ,
                                TOLERANCE, VIDEO_EXTS, video_info)

TOP_N = 5


def candidates(ref, paths):
    out = []
    for p in paths:
        arr = np.load(p, mmap_mode="r")
        if arr.shape[0] != ref.shape[0]:
            continue
        flat = np.asarray(arr).reshape(arr.shape[0], -1).astype(np.float32)
        diff = np.abs(flat - ref)
        # max diff, mean diff, share of frames that are identical
        out.append((float(diff.max()), p, float(diff.mean()), float((diff.max(axis=1) < TOLERANCE).mean())))
    return sorted(out)


def show(rows, root):
    for d, p, mean, same in rows[:TOP_N]:
        print(f"    max {d:.3g}  mean {mean:.3g}  identical frames {same:.0%}  {os.path.relpath(p, root)}")


def main(signs, normalized_root):
    refs = np.load(REFERENCE_NPZ)
    all_npy = glob.glob(os.path.join(normalized_root, "*", "*.npy"))
    with open(OUT_PATH) as f:
        sources = json.load(f)

    changed = False
    for sign in signs:
        ref = refs[sign]
        own = candidates(ref, glob.glob(os.path.join(normalized_root, sign, "*.npy")))
        anywhere = candidates(ref, all_npy)
        print(f"\n== {sign} (T={ref.shape[0]}) in {normalized_root} ==")
        print(f"  own folder: {len(own)} same-length sequences")
        show(own, normalized_root)
        print(f"  whole dataset: {len(anywhere)} same-length sequences")
        show(anywhere, normalized_root)

        exact = [p for d, p, _, _ in anywhere if d < TOLERANCE]
        rec = sources["signs"][sign]
        rec["closest_candidates"] = [
            {"normalized_root": normalized_root,
             "npy": os.path.relpath(p, normalized_root).replace(os.sep, "/"),
             "max_abs_diff": d, "mean_abs_diff": mean, "identical_frames": same}
            for d, p, mean, same in anywhere[:TOP_N]
        ]
        if len(exact) != 1:
            print(f"  -> {len(exact)} exact matches: left unmatched for review")
            changed = True
            continue

        folder_sign = os.path.basename(os.path.dirname(exact[0]))
        stem = os.path.splitext(os.path.basename(exact[0]))[0]
        videos = [p for p in glob.glob(os.path.join(DATASET_ROOT, "*", folder_sign, stem + ".*"))
                  if p.lower().endswith(VIDEO_EXTS)]
        if len(videos) != 1:
            print(f"  -> exact array found but {len(videos)} videos for it: left unmatched")
            changed = True
            continue
        info = video_info(videos[0])
        if info["frame_count_decoded"] != ref.shape[0]:
            print("  -> exact array found but the video frame count differs: left unmatched")
            changed = True
            continue
        rec.update(info)
        rec.update({
            "status": "matched",
            "dataset": "ASL Citizen" if stem.startswith("asl_citizen_") else "WLASL",
            "video_file": os.path.basename(videos[0]),
            "video_path": os.path.relpath(videos[0], DATASET_ROOT).replace(os.sep, "/"),
            "frame_range": [0, int(ref.shape[0]) - 1],
            "max_abs_diff": 0.0,
            "reason": "corrected: reference_exemplars.csv named a different file",
        })
        print(f"  -> corrected to {rec['video_path']}")
        changed = True

    if changed:
        with open(OUT_PATH, "w") as f:
            json.dump(sources, f, indent=2)
        print(f"\nupdated {OUT_PATH}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("signs", nargs="*", default=["arm", "back"])
    ap.add_argument("--normalized-root", default=NORMALIZED_ROOT)
    a = ap.parse_args()
    main(a.signs or ["arm", "back"], a.normalized_root)
