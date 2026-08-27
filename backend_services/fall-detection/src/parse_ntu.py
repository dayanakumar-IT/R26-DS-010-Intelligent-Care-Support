# backend/src/parse_ntu.py
import os
import zipfile
import numpy as np

from config.settings import (
    NTU_SOURCE_DIR,
    PROCESSED_DATA_DIR,
    NTU_TARGET_CLASSES,
    NTU_JOINT_MAP,
    NUM_JOINTS,
    CLASS_MAPPING,
)
from src.data_processor import DataProcessor


def parse_skeleton_text(lines):
    """Parse one NTU .skeleton file (text lines) into (frames, 14, 3)."""
    try:
        frame_count = int(lines[0].strip())
        sequence = []
        cursor = 1

        for _ in range(frame_count):
            if cursor >= len(lines):
                break
            body_count = int(lines[cursor].strip())
            cursor += 1
            if body_count == 0:
                continue

            cursor += 1  # skip body-info line
            joint_count = int(lines[cursor].strip())
            cursor += 1

            frame = np.zeros((NUM_JOINTS, 4), dtype=np.float32)
            visible_mask = np.zeros(NUM_JOINTS, dtype=bool)

            reverse_map = {ntu_idx: our_idx for our_idx, ntu_idx in NTU_JOINT_MAP.items()}
            for j in range(joint_count):
                tokens = lines[cursor].strip().split()
                cursor += 1
                if j in reverse_map:
                    our_idx = reverse_map[j]
                    frame[our_idx, 0] = float(tokens[0])
                    frame[our_idx, 1] = float(tokens[1])
                    frame[our_idx, 2] = float(tokens[2])
                    frame[our_idx, 3] = 1.0     # NTU: fully-tracked joint
                    visible_mask[our_idx] = True

            if visible_mask.all():
                sequence.append(frame)

            # Discard secondary bodies (interactions).
            for _ in range(body_count - 1):
                cursor += 1  # body-info
                jc = int(lines[cursor].strip())
                cursor += 1 + jc

        return np.asarray(sequence) if sequence else None
    except Exception as exc:
        print(f"[parse_ntu] skipping a sequence: {exc}")
        return None


def _parse_subject_id(f_name: str) -> int:
    """NTU filename convention: S###C###P###R###A###.skeleton  → subject = P###."""
    idx = f_name.find("P")
    if idx < 0 or len(f_name) < idx + 4:
        return -1
    try:
        return int(f_name[idx + 1 : idx + 4])
    except ValueError:
        return -1


def run_ntu_pipeline():
    data_list, labels_list, subjects_list, raw_lengths = [], [], [], []
    class_label = {
        "A043": CLASS_MAPPING["FALL"],
        "A008": CLASS_MAPPING["NORMAL"],
        "A009": CLASS_MAPPING["NORMAL"],
        "A027": CLASS_MAPPING["NORMAL"],
    }
    zip_files = [
        "nturgbd_skeletons_s001_to_s017.zip",
        "nturgbd_skeletons_s018_to_s032.zip",
    ]

    for z_name in zip_files:
        path = os.path.join(NTU_SOURCE_DIR, z_name)
        if not os.path.exists(path):
            print(f"[parse_ntu] missing archive: {path}")
            continue

        print(f"[parse_ntu] streaming {z_name} ...")
        with zipfile.ZipFile(path, "r") as archive:
            for member in archive.namelist():
                if not member.endswith(".skeleton"):
                    continue
                f_name = os.path.basename(member)
                action_key = f_name[-13:-9]
                if action_key not in NTU_TARGET_CLASSES:
                    continue

                with archive.open(member) as fh:
                    lines = [ln.decode("utf-8") for ln in fh.readlines()]
                seq = parse_skeleton_text(lines)
                if seq is None or len(seq) < 30:
                    continue

                raw_len = len(seq)
                seq = DataProcessor.apply_clip_normalization(seq)
                seq = DataProcessor.enforce_temporal_uniformity(seq)
                data_list.append(seq)
                labels_list.append(class_label[action_key])
                subjects_list.append(_parse_subject_id(f_name))
                raw_lengths.append(raw_len)

    if not data_list:
        print("[parse_ntu] no sequences parsed; check NTU_SOURCE_DIR")
        return

    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    data_arr = np.asarray(data_list, dtype=np.float32)
    labels_arr = np.asarray(labels_list, dtype=np.int64)
    subjects_arr = np.asarray(subjects_list, dtype=np.int32)
    np.save(os.path.join(PROCESSED_DATA_DIR, "ntu_data.npy"), data_arr)
    np.save(os.path.join(PROCESSED_DATA_DIR, "ntu_labels.npy"), labels_arr)
    np.save(os.path.join(PROCESSED_DATA_DIR, "ntu_subjects.npy"), subjects_arr)
    n_subj = int(len(np.unique(subjects_arr[subjects_arr >= 0])))
    raw_arr = np.asarray(raw_lengths, dtype=np.int32)
    fall_len = raw_arr[labels_arr == 1]
    norm_len = raw_arr[labels_arr == 0]
    print(
        f"[parse_ntu] done. shape={data_arr.shape}  "
        f"fall={int((labels_arr == 1).sum())}  normal={int((labels_arr == 0).sum())}  "
        f"unique_subjects={n_subj}"
    )
    print(
        f"[parse_ntu] raw length (B6 check) — "
        f"fall: mean={fall_len.mean():.1f} std={fall_len.std():.1f}  "
        f"normal: mean={norm_len.mean():.1f} std={norm_len.std():.1f}"
    )


if __name__ == "__main__":
    run_ntu_pipeline()
