import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Allow this script to import paths.py from the Codes folder
sys.path.append(str(Path(__file__).resolve().parent.parent))

from paths import NTU_POSE_OUTPUT


# =========================================================
# CHECK NTU POSE OUTPUT
# Purpose:
# Validate converted NTU .npy skeleton files and metadata
# =========================================================

SHORT_SEQUENCE_LIMIT = 20


def main():
    print("\nStarting NTU output validation...\n")

    metadata_path = NTU_POSE_OUTPUT / "metadata.csv"

    if not metadata_path.exists():
        print("Metadata file not found!")
        print(f"Expected path: {metadata_path}")
        return

    metadata = pd.read_csv(metadata_path)

    print("Metadata loaded successfully.")
    print(f"Total sequences in metadata: {len(metadata)}")

    missing_files = []
    invalid_shapes = []
    short_sequences = []
    frame_counts = []

    for _, row in metadata.iterrows():
        sequence_id = row["sequence_id"]
        npy_path = Path(row["pose_array_path"])

        if not npy_path.exists():
            missing_files.append(sequence_id)
            continue

        try:
            pose_data = np.load(npy_path)
            shape = pose_data.shape

            # Expected NTU shape: (frames, 25, 3)
            if len(shape) != 3 or shape[1] != 25 or shape[2] != 3:
                invalid_shapes.append({
                    "sequence_id": sequence_id,
                    "shape": str(shape)
                })
                continue

            frame_count = shape[0]
            frame_counts.append(frame_count)

            if frame_count < SHORT_SEQUENCE_LIMIT:
                short_sequences.append({
                    "sequence_id": sequence_id,
                    "label": row["label"],
                    "risk_level": row["risk_level"],
                    "frames": frame_count,
                    "pose_array_path": str(npy_path)
                })

        except Exception as e:
            invalid_shapes.append({
                "sequence_id": sequence_id,
                "shape": f"load_error: {e}"
            })

    print("\n------------- SUMMARY -------------")
    print(f"Missing files: {len(missing_files)}")
    print(f"Invalid shapes/load errors: {len(invalid_shapes)}")
    print(f"Short sequences (<{SHORT_SEQUENCE_LIMIT} frames): {len(short_sequences)}")

    if frame_counts:
        print(f"\nMin frames: {min(frame_counts)}")
        print(f"Max frames: {max(frame_counts)}")
        print(f"Average frames: {round(np.mean(frame_counts), 2)}")

    print("\n------------- LABEL DISTRIBUTION -------------")
    print(metadata["label"].value_counts())

    print("\n------------- RISK LEVEL DISTRIBUTION -------------")
    print(metadata["risk_level"].value_counts())

    if short_sequences:
        print("\n------------- SHORT SEQUENCES SAMPLE -------------")
        short_df = pd.DataFrame(short_sequences)
        print(short_df.head(20))

        short_report_path = NTU_POSE_OUTPUT / "short_sequences_report.csv"
        short_df.to_csv(short_report_path, index=False)
        print(f"\nShort sequence report saved at: {short_report_path}")

    if invalid_shapes:
        invalid_df = pd.DataFrame(invalid_shapes)
        invalid_report_path = NTU_POSE_OUTPUT / "invalid_shapes_report.csv"
        invalid_df.to_csv(invalid_report_path, index=False)
        print(f"\nInvalid shape report saved at: {invalid_report_path}")

    if missing_files:
        missing_df = pd.DataFrame({"sequence_id": missing_files})
        missing_report_path = NTU_POSE_OUTPUT / "missing_files_report.csv"
        missing_df.to_csv(missing_report_path, index=False)
        print(f"\nMissing files report saved at: {missing_report_path}")

    print("\nNTU validation completed.")


if __name__ == "__main__":
    main()