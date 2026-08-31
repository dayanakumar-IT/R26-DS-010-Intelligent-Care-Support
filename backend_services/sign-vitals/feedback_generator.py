"""
feedback_generator.py
GLOSS component — corrective feedback generation (Phase 7).

Given a DTW alignment path between an attempt and a reference
sequence, identifies which of 9 friendly body regions deviated most,
and turns that into a short plain-language message alongside the
existing strong/moderate/weak quality_tier.

This is a rough guide, not a certified movement assessment — the
wording is deliberately kept general/hedged rather than diagnostic-
sounding.
"""

# ---------------------------------------------------------------
# Landmark grouping: 49 landmarks (indices 0-48, per
# models/landmark_names.json's fixed order) -> 9 friendly regions.
# ---------------------------------------------------------------
LANDMARK_GROUPS = [
    {"group": "nose", "friendly_name": "nose", "indices": [0]},
    {"group": "left_shoulder", "friendly_name": "left shoulder", "indices": [1]},
    {"group": "right_shoulder", "friendly_name": "right shoulder", "indices": [2]},
    {"group": "left_elbow", "friendly_name": "left elbow", "indices": [3]},
    {"group": "right_elbow", "friendly_name": "right elbow", "indices": [4]},
    {"group": "left_wrist", "friendly_name": "left wrist", "indices": [5]},
    {"group": "right_wrist", "friendly_name": "right wrist", "indices": [6]},
    {"group": "left_hand", "friendly_name": "left hand", "indices": list(range(7, 28))},
    {"group": "right_hand", "friendly_name": "right hand", "indices": list(range(28, 49))},
]

N_LANDMARKS = 49
N_COORDS = 3  # x, y, z per landmark


def compute_group_deviations(attempt_seq, reference_seq, path):
    """
    attempt_seq, reference_seq: (T, 147) arrays — the flat
      49-landmarks x (x,y,z) DTW sequences being compared (same
      sequences dtw_distance_with_path() was called on).
    path: the DTW alignment path from dtw.dtw_distance_with_path(),
      a list of (i, j) tuples aligning attempt_seq[i] to
      reference_seq[j].

    For each of the 9 groups, sums the Euclidean distance between
    the attempt's and reference's landmark position(s) in that group,
    across every aligned frame pair in the path (for left_hand/
    right_hand, the 21 individual per-landmark 3D distances are
    summed together).

    Returns: list of {"group", "friendly_name", "deviation_score"}
      dicts, sorted descending by deviation_score.
    """
    attempt_frames = attempt_seq.reshape(-1, N_LANDMARKS, N_COORDS)
    reference_frames = reference_seq.reshape(-1, N_LANDMARKS, N_COORDS)

    scores = {g["group"]: 0.0 for g in LANDMARK_GROUPS}

    for i, j in path:
        a_frame = attempt_frames[i]
        r_frame = reference_frames[j]
        for g in LANDMARK_GROUPS:
            indices = g["indices"]
            diff = a_frame[indices] - r_frame[indices]
            per_landmark_dist = (diff ** 2).sum(axis=-1) ** 0.5
            scores[g["group"]] += float(per_landmark_dist.sum())

    results = [
        {
            "group": g["group"],
            "friendly_name": g["friendly_name"],
            "deviation_score": scores[g["group"]],
        }
        for g in LANDMARK_GROUPS
    ]
    results.sort(key=lambda r: r["deviation_score"], reverse=True)
    return results


def generate_feedback(quality_tier, group_deviations):
    """
    quality_tier: "strong" | "moderate" | "weak".
    group_deviations: the sorted output of compute_group_deviations().

    Returns: {"summary": str, "top_deviating_groups": [...]}
      top_deviating_groups is empty for "strong".
    """
    if quality_tier == "strong":
        return {
            "summary": "Great job — this sign was performed well.",
            "top_deviating_groups": [],
        }

    top_two = group_deviations[:2]
    names = [g["friendly_name"] for g in top_two]

    if len(names) >= 2:
        summary = (
            f"Your {names[0]} position and {names[1]} position seem to need the most "
            f"adjustment compared to the reference — this is a rough guide, not an exact "
            f"measurement, so use it as a general pointer rather than a precise correction."
        )
    elif len(names) == 1:
        summary = (
            f"Your {names[0]} position seems to need the most adjustment compared to the "
            f"reference — this is a rough guide, not an exact measurement."
        )
    else:
        summary = "This attempt didn't match the reference closely — try comparing your movement to the reference sign again."

    return {
        "summary": summary,
        "top_deviating_groups": top_two,
    }
