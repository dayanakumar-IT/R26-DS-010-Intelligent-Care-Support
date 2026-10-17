"""
Display-video candidates (read-only on the dataset): copies EVERY video of
the listed signs from Sign_Language_PP2 into one zip, so they can be scored
locally with the same extraction + bake pipeline as the references.

The grading references are not touched; a chosen video only becomes the
sign's "display_source" (what the 3D Signer shows).

Run in Colab with Drive mounted:
    from google.colab import drive; drive.mount('/content/drive')
    !python colab_collect_candidates.py
Then download GLOSS_display_candidates.zip from MyDrive and unzip it into
scripts/avatar/videos/candidates/ (gitignored, like all source videos):
    candidates/<sign>/<file>.mp4  plus  candidates/manifest.json
"""

import glob
import json
import os
import shutil

import cv2

# ---- set these ----
DATASET_ROOT = "/content/drive/MyDrive/Sign_Language_PP2"
OUT_DIR = "/content/GLOSS_display_candidates"
ZIP_PATH = "/content/drive/MyDrive/GLOSS_display_candidates"  # .zip is added
SIGNS = ["me", "good", "stand", "welcome", "arm", "water", "nose", "hello", "angry"]
# -------------------


def main():
    manifest = {}
    os.makedirs(OUT_DIR, exist_ok=True)
    for sign in SIGNS:
        paths = sorted(glob.glob(os.path.join(DATASET_ROOT, "*", sign, "*.mp4")))
        os.makedirs(os.path.join(OUT_DIR, sign), exist_ok=True)
        manifest[sign] = []
        for p in paths:
            cap = cv2.VideoCapture(p)
            info = {
                "video_file": os.path.basename(p),
                "video_path": os.path.relpath(p, DATASET_ROOT),
                "fps": cap.get(cv2.CAP_PROP_FPS),
                "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                "frame_count_header": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
            }
            cap.release()
            shutil.copy2(p, os.path.join(OUT_DIR, sign, info["video_file"]))
            manifest[sign].append(info)
        print(f"{sign}: {len(paths)} videos")
    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
        json.dump({"dataset_root": DATASET_ROOT, "signs": manifest}, f, indent=1)
    shutil.make_archive(ZIP_PATH, "zip", OUT_DIR)
    print("wrote", ZIP_PATH + ".zip")


if __name__ == "__main__":
    main()
