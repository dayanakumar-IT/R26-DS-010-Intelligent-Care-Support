import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Allow importing paths.py from Codes folder
sys.path.append(str(Path(__file__).resolve().parent.parent))

from paths import UR_POSE_OUTPUT, NTU_POSE_OUTPUT, OUTPUTS


# =========================================================
# NORMALIZE SEQUENCES
# Purpose:
# Convert all skeleton sequences into fixed frame length
# =========================================================

TARGET_FRAMES = 100

UR_METADATA = UR_POSE_OUTPUT / "filtered_metadata.csv"
NTU_METADATA = NTU_POSE_OUTPUT / "metadata.csv"

NORMALIZED_OUTPUT = OUTPUTS / "Normalized_Sequences"
UR_NORMALIZED_OUTPUT = NORMALIZED_OUTPUT / "UR"
NTU_NORMALIZED_OUTPUT = NORMALIZED_OUTPUT / "NTU"

COMBINED_METADATA_PATH = NORMALIZED_OUTPUT / "combined_normalized_metadata.csv"


def normalize_sequence(sequence, target_frames=100):
    """
    Converts sequence to fixed number of frames.

    If sequence is longer than target_frames:
        evenly samples frames.
    If sequence is shorter than target_frames:
        repeats last frame until target length.
    """

    current_frames = sequence.shape[0]

    if current_frames == target_frames:
        return sequence

    # If sequence is longer, sample evenly
    if current_frames > target_frames:
        indices = np.linspace(0, current_frames - 1, target_frames).astype(int)
        return sequence[indices]

    # If sequence is shorter, upsample by linear interpolation
    # between consecutive frames. This avoids the label-leakage of
    # frame-freeze padding, where N copies of the final frame at the
    # tail would let the model learn "static tail = end of action".
    if current_frames < target_frames:
        indices = np.linspace(0, current_frames - 1, target_frames)
        floor_idx = np.floor(indices).astype(int)
        ceil_idx = np.minimum(floor_idx + 1, current_frames - 1)
        alpha = (indices - floor_idx).reshape(-1, 1, 1)
        return ((1 - alpha) * sequence[floor_idx]
                + alpha * sequence[ceil_idx]).astype(sequence.dtype)


def process_dataset(metadata_path, dataset_name, output_folder):
    print(f"\nProcessing {dataset_name} dataset...")

    output_folder.mkdir(parents=True, exist_ok=True)

    if not metadata_path.exists():
        print(f"Metadata file not found: {metadata_path}")
        return []

    metadata = pd.read_csv(metadata_path)
    normalized_rows = []

    for _, row in metadata.iterrows():

        sequence_id = row["sequence_id"]
        pose_path = Path(row["pose_array_path"])

        if not pose_path.exists():
            print(f"[SKIPPED] File not found: {sequence_id}")
            continue

        try:
            sequence = np.load(pose_path)

            normalized_sequence = normalize_sequence(sequence, TARGET_FRAMES)

            label_folder = output_folder / row["label"]
            label_folder.mkdir(parents=True, exist_ok=True)

            save_path = label_folder / f"{sequence_id}.npy"
            np.save(save_path, normalized_sequence)

            normalized_rows.append({
                "sequence_id": sequence_id,
                "dataset": dataset_name,
                "label": row["label"],
                "risk_level": row["risk_level"],
                "original_shape": str(sequence.shape),
                "normalized_shape": str(normalized_sequence.shape),
                "target_frames": TARGET_FRAMES,
                "pose_array_path": str(save_path)
            })

            print(f"[DONE] {sequence_id} -> {normalized_sequence.shape}")

        except Exception as e:
            print(f"[ERROR] {sequence_id}: {e}")

    return normalized_rows


def main():
    print("\nStarting sequence normalization...")

    NORMALIZED_OUTPUT.mkdir(parents=True, exist_ok=True)

    all_rows = []

    ur_rows = process_dataset(
        metadata_path=UR_METADATA,
        dataset_name="UR",
        output_folder=UR_NORMALIZED_OUTPUT
    )

    ntu_rows = process_dataset(
        metadata_path=NTU_METADATA,
        dataset_name="NTU",
        output_folder=NTU_NORMALIZED_OUTPUT
    )

    all_rows.extend(ur_rows)
    all_rows.extend(ntu_rows)

    combined_df = pd.DataFrame(all_rows)
    combined_df.to_csv(COMBINED_METADATA_PATH, index=False)

    print("\nSequence normalization completed.")
    print(f"Total normalized sequences: {len(combined_df)}")
    print(f"Combined metadata saved at: {COMBINED_METADATA_PATH}")

    print("\n------------- DATASET DISTRIBUTION -------------")
    print(combined_df["dataset"].value_counts())

    print("\n------------- LABEL DISTRIBUTION -------------")
    print(combined_df["label"].value_counts())


if __name__ == "__main__":
    main()