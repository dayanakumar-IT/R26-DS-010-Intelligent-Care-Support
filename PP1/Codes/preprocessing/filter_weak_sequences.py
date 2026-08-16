import os
import sys
import pandas as pd
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import UR_POSE_OUTPUT

# =========================================================
# FILTER WEAK POSE SEQUENCES
# Purpose:
# Remove unreliable pose sequences before model training
# =========================================================

OUTPUT_BASE = str(UR_POSE_OUTPUT)

QUALITY_REPORT_PATH = os.path.join(OUTPUT_BASE, "pose_quality_report.csv")
METADATA_PATH = os.path.join(OUTPUT_BASE, "metadata.csv")

FILTERED_METADATA_PATH = os.path.join(OUTPUT_BASE, "filtered_metadata.csv")
REMOVED_SEQUENCES_PATH = os.path.join(OUTPUT_BASE, "removed_weak_sequences.csv")

# Keep only these quality levels
ALLOWED_QUALITY = ["excellent", "good", "acceptable"]


def main():

    print("\nStarting weak sequence filtering...")

    if not os.path.exists(QUALITY_REPORT_PATH):
        print("pose_quality_report.csv not found.")
        return

    if not os.path.exists(METADATA_PATH):
        print("metadata.csv not found.")
        return

    quality_df = pd.read_csv(QUALITY_REPORT_PATH)
    metadata_df = pd.read_csv(METADATA_PATH)

    print(f"Total sequences before filtering: {len(metadata_df)}")

    # Merge metadata with quality report
    merged_df = metadata_df.merge(
        quality_df[["sequence_id", "missing_ratio", "quality"]],
        on="sequence_id",
        how="left"
    )

    # Keep good quality sequences
    filtered_df = merged_df[
        merged_df["quality"].isin(ALLOWED_QUALITY)
    ].copy()

    # Removed weak sequences
    removed_df = merged_df[
        ~merged_df["quality"].isin(ALLOWED_QUALITY)
    ].copy()

    # Save outputs
    filtered_df.to_csv(FILTERED_METADATA_PATH, index=False)
    removed_df.to_csv(REMOVED_SEQUENCES_PATH, index=False)

    print("\nFiltering completed.")
    print(f"Training-ready sequences: {len(filtered_df)}")
    print(f"Removed weak sequences: {len(removed_df)}")

    print(f"\nFiltered metadata saved at:")
    print(FILTERED_METADATA_PATH)

    print(f"\nRemoved weak sequences saved at:")
    print(REMOVED_SEQUENCES_PATH)

    print("\n--------------- FILTERED DATA SUMMARY ---------------")
    print(filtered_df["label"].value_counts())

    print("\n--------------- QUALITY SUMMARY AFTER FILTERING ---------------")
    print(filtered_df["quality"].value_counts())

    print("\n--------------- REMOVED SEQUENCES ---------------")

    if len(removed_df) == 0:
        print("No weak sequences removed.")
    else:
        print(removed_df[[
            "sequence_id",
            "category",
            "label",
            "missing_ratio",
            "quality"
        ]])


if __name__ == "__main__":
    main()