# backend/src/parse_ur.py
"""
UR Fall Detection ingestion.

The CSVs shipped locally under `Datasets/UR Fall Detection Dataset/` only
contain (frame_index, time_ms, scalar) — they do NOT contain per-joint
3D skeleton coordinates. The Kinect-v1 skeleton ships in a separate
upstream archive that we do not currently have on disk.

Until either of the following is done, this pipeline produces NO UR
sequences (so training is NTU-only, which is the honest behaviour):

1. Download `skeleton.zip` from the UR Fall Detection project page and
   point UR_SKELETON_SOURCE_DIR at it; or
2. Run MediaPipe Pose offline on the UR RGB videos and dump per-frame
   skeletons of shape (T, 14, 3) to `data/processed/ur_mediapipe/`.

Both paths are tracked under P0-2 in `backend/docs/improvement_plan.md`.

If `data/processed/ur_mediapipe/` already exists, this script will load
those `.npz` files instead. Each file is expected to contain:

    arr_0     -> float32 (T, 14, 3)
    label     -> int     (0 NORMAL or 1 FALL)
"""
import os
import numpy as np

from config.settings import (
    UR_ADL_SOURCE_DIR,
    UR_FALL_SOURCE_DIR,
    PROCESSED_DATA_DIR,
    CLASS_MAPPING,
)
from src.data_processor import DataProcessor

UR_MEDIAPIPE_DIR = os.path.join(PROCESSED_DATA_DIR, "ur_mediapipe")


def _load_mediapipe_dump():
    """If a MediaPipe-on-UR dump exists, ingest it. Otherwise return None."""
    if not os.path.isdir(UR_MEDIAPIPE_DIR):
        return None

    data_list, labels_list = [], []
    for name in sorted(os.listdir(UR_MEDIAPIPE_DIR)):
        if not name.endswith(".npz"):
            continue
        rec = np.load(os.path.join(UR_MEDIAPIPE_DIR, name))
        seq = rec["arr_0"]
        label = int(rec["label"])
        if seq.shape[1] != 14 or seq.shape[2] not in (3, 4) or len(seq) < 30:
            print(f"[parse_ur] skipping malformed dump: {name} shape={seq.shape}")
            continue
        seq = DataProcessor.apply_clip_normalization(seq)
        seq = DataProcessor.enforce_temporal_uniformity(seq)
        data_list.append(seq)
        labels_list.append(label)

    if not data_list:
        return None
    return np.asarray(data_list, dtype=np.float32), np.asarray(labels_list, dtype=np.int64)


def run_ur_pipeline():
    # Verify the source folders exist; warn if they do not.
    n_adl = len(os.listdir(UR_ADL_SOURCE_DIR)) if os.path.isdir(UR_ADL_SOURCE_DIR) else 0
    n_fall = len(os.listdir(UR_FALL_SOURCE_DIR)) if os.path.isdir(UR_FALL_SOURCE_DIR) else 0
    print(f"[parse_ur] UR raw CSVs found: adl={n_adl}, fall={n_fall} (these are NOT per-joint files)")

    bundle = _load_mediapipe_dump()
    if bundle is None:
        print(
            "[parse_ur] no UR skeletons available yet -- skipping UR.\n"
            "           See backend/docs/improvement_plan.md (P0-2) for how to\n"
            "           produce data/processed/ur_mediapipe/*.npz."
        )
        return

    data_arr, labels_arr = bundle
    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    np.save(os.path.join(PROCESSED_DATA_DIR, "ur_data.npy"), data_arr)
    np.save(os.path.join(PROCESSED_DATA_DIR, "ur_labels.npy"), labels_arr)
    print(
        f"[parse_ur] done. shape={data_arr.shape}  "
        f"fall={int((labels_arr == 1).sum())}  normal={int((labels_arr == 0).sum())}"
    )


if __name__ == "__main__":
    run_ur_pipeline()
