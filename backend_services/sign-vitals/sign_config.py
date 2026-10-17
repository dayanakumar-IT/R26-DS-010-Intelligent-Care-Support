"""
sign_config.py
GLOSS component — per-sign configuration lists.

NOT_RECOMMENDED: signs whose reference demonstration is weak (the reference
video shows the hands too little for a reliable motion file). They are never
chosen automatically — not for "Recommended next", "Continue practising",
the result screen's next sign, or the Recall challenge — but stay in the
dictionary (Browse Signs) and can be practised from there as normal.
Grading, mastery and history for them are unchanged.

This is NOT the model-unreliable list (hurt, pain, me, sleep) planned for the
levels work, which is about recognition accuracy, not demonstration quality.
"me" is on both.
"""

NOT_RECOMMENDED: dict[str, str] = {
    "me": "reference video: the pointing hand is never detected",
    "good": "reference video: hands barely visible (low frame rate clip)",
    "stand": "reference video: hands visible only in brief flickers",
    "welcome": "reference video: hands visible only in brief flickers",
    "arm": "reference video: hands barely visible",
}

QUALITY_NOTE = "Demonstration quality is limited for this sign. Compare carefully with the 2D guide."


def is_recommendable(sign_id: str) -> bool:
    return sign_id not in NOT_RECOMMENDED


def recommendable(sign_ids):
    """The signs that may be chosen automatically, in the given order."""
    return [s for s in sign_ids if is_recommendable(s)]


def annotate_sign(row: dict) -> dict:
    """A gloss_signs catalogue row with the dictionary-only flag and note."""
    sign_id = row["id"]
    return {
        **row,
        "recommendable": is_recommendable(sign_id),
        "quality_note": None if is_recommendable(sign_id) else QUALITY_NOTE,
    }
