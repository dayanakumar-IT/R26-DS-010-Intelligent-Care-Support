"""
feedback_generator.py
GLOSS component — rule-based explainable feedback (Layer 4 of the thesis).

generate_feedback() and its helpers are copied VERBATIM from
gloss_assets/gloss_reference_pipeline.py (notebook 03, cell A2). The
thesis reports and evaluates this exact wording, and
gloss_feedback_guard.py keys on its phrases ("wasn't fully certain",
"couldn't confidently identify") — do not reword it here.

to_api_deviations() / to_api_feedback() are app-side only: they map the
notebook's values into the response fields the API already had
(deviating_landmarks, corrective_feedback.summary /
.top_deviating_groups). They add no wording of their own.
"""

HAND_LANDMARK_NAMES = {
    0: "wrist", 1: "thumb base", 2: "thumb knuckle", 3: "thumb joint", 4: "thumb tip",
    5: "index finger base", 6: "index finger middle joint", 7: "index finger upper joint", 8: "index fingertip",
    9: "middle finger base", 10: "middle finger middle joint", 11: "middle finger upper joint", 12: "middle fingertip",
    13: "ring finger base", 14: "ring finger middle joint", 15: "ring finger upper joint", 16: "ring fingertip",
    17: "pinky base", 18: "pinky middle joint", 19: "pinky upper joint", 20: "pinky tip",
}

def landmark_to_plain_english(landmark_name):
    for joint in ("wrist", "elbow", "shoulder"):
        if landmark_name in (f"left_{joint}", f"right_{joint}"):
            return f"{'left' if 'left' in landmark_name else 'right'} {joint}"
    if landmark_name == "nose":
        return "head position"
    if "_hand_" in landmark_name:
        side = "left" if landmark_name.startswith("left") else "right"
        return f"{side} {HAND_LANDMARK_NAMES.get(int(landmark_name.split('_')[-1]), 'hand')}"
    return landmark_name.replace("_", " ")


NON_ACTIONABLE_LANDMARKS = {"nose"}

def get_actionable_landmarks(top_deviating_landmarks, max_items=2):
    filtered = [d for d in top_deviating_landmarks if d["landmark"] not in NON_ACTIONABLE_LANDMARKS]
    return filtered[:max_items] if filtered else top_deviating_landmarks[:max_items]


def join_landmarks_naturally(names):
    return names[0] if len(names) == 1 else " and ".join(names)


def generate_feedback(result, confidence_threshold=0.6, low_confidence_cutoff=0.35):
    predicted, confidence, tier = result["predicted_class"], result["tcn_confidence"], result["quality_tier"]
    if confidence < low_confidence_cutoff:
        return {"full_text": "The system couldn't confidently identify which sign was performed. "
                             "Please try the sign again, making sure your hands are clearly visible.",
                "headline": "Sign not clearly recognized.", "quality_tier": "unclear", "cited_landmarks": [],
                "evidence": {"tcn_confidence": confidence, "dtw_distance": None, "raw_top_landmarks": []}}

    landmarks = get_actionable_landmarks(result["top_deviating_landmarks"])
    parts = []
    if confidence < confidence_threshold:
        parts.append(f"This looked like it might be '{predicted}', though the system wasn't fully certain.")
    else:
        parts.append(f"The sign was recognized as '{predicted}'.")
    if result.get("was_multi_attempt"):
        parts.append(f"It looks like you signed this {result['n_repetitions_detected']} times — "
                     f"your best attempt was used for grading.")
    if tier == "strong":
        parts.append("Your execution closely matched the reference sign. Well done.")
    elif tier == "moderate":
        parts.append(f"Your movement was reasonably close to the reference, with the largest "
                     f"difference around your {landmark_to_plain_english(landmarks[0]['landmark'])}.")
        parts.append("Try again, paying a little more attention to that movement.")
    elif tier == "weak":
        named = join_landmarks_naturally([landmark_to_plain_english(d["landmark"]) for d in landmarks])
        parts.append(f"Your movement differed noticeably from the reference sign, mainly around your {named}.")
        parts.append("Try slowing down and focusing on that part of the movement, then attempt it again.")
    else:
        parts.append("Not enough calibration data was available to grade this sign's execution quality yet.")

    return {"full_text": " ".join(parts), "headline": parts[0], "quality_tier": tier,
            "cited_landmarks": [landmark_to_plain_english(d["landmark"]) for d in landmarks],
            "evidence": {"tcn_confidence": confidence, "dtw_distance": result["dtw_distance"],
                         "raw_top_landmarks": result["top_deviating_landmarks"]}}


# ---------------------------------------------------------------
# App-side mapping into the existing API response fields.
# ---------------------------------------------------------------
def to_api_deviations(landmarks):
    """landmarks: notebook-style [{"landmark", "deviation"}, ...].
    Returns the API's [{"group", "friendly_name", "deviation_score"}, ...]
    — "group" is now the landmark name (e.g. "left_hand_8")."""
    return [
        {
            "group": d["landmark"],
            "friendly_name": landmark_to_plain_english(d["landmark"]),
            "deviation_score": d["deviation"],
        }
        for d in landmarks
    ]


def to_api_feedback(result, base, summary=None):
    """result: grade_learner_attempt() dict. base: generate_feedback(result).
    summary: the text to show (defaults to base["full_text"]; pass the
    guarded Gemini rewording here when there is one).

    Returns {"summary": str, "top_deviating_groups": [...]}.
    top_deviating_groups are the landmarks the feedback cites
    (base["cited_landmarks"]); empty for "strong", as before, and when
    the sign wasn't confidently recognised.
    """
    cited = []
    if base["cited_landmarks"] and base["quality_tier"] != "strong":
        cited = get_actionable_landmarks(result["top_deviating_landmarks"])
    return {
        "summary": base["full_text"] if summary is None else summary,
        "top_deviating_groups": to_api_deviations(cited),
    }
