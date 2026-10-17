"""
sign_config.py
GLOSS component — per-sign configuration lists.

NOT_RECOMMENDED: signs whose reference demonstration is weak (the reference
video shows the hands too little for a reliable motion file). They are never
chosen automatically — not for "Recommended next", "Continue practising",
the result screen's next sign, or the Recall challenge — but stay in the
dictionary (Browse Signs) and can be practised from there as normal.
Grading, mastery and history for them are unchanged.

UNRELIABLE (below) is a different list: signs the camera check cannot judge
reliably (recognition accuracy, not demonstration quality). "me" is on both.
"""

NOT_RECOMMENDED: dict[str, str] = {
    "me": "reference video: the pointing hand is never detected",
    "good": "reference video: hands barely visible (low frame rate clip)",
    "stand": "reference video: hands visible only in brief flickers",
    "welcome": "reference video: hands visible only in brief flickers",
    "arm": "reference video: hands barely visible",
}

QUALITY_NOTE = "Demonstration quality is limited for this sign. Compare carefully with the 2D guide."


# Shown instead of a camera verdict for UNRELIABLE signs.
UNRELIABLE_NOTE = "Camera check unreliable - compare with the avatar"

# Signs the recogniser cannot judge reliably (confused with each other or
# rarely detected): never counted for or against the learner — no
# Demonstrated / Retained, not needed for categories, levels or Master.
UNRELIABLE: dict[str, str] = {
    "hurt": "often recognised as pain",
    "pain": "often recognised as hurt",
    "me": "the pointing hand is rarely detected",
    "sleep": "often recognised as eat",
}

# The grading pipeline whose camera attempts count toward Demonstrated,
# Retained and levels: the final thesis recogniser + DTW grading bundle,
# named after its go-live month and the gloss_assets/manifest.json sha256.
# tests/test_progress_rules.py fails if the manifest changes without a bump.
# Attempts before 2026-10-10 01:43 Asia/Colombo are tagged LEGACY_PIPELINE
# (migration 0045): they count as practice, never toward skill.
PIPELINE_VERSION = "2026.10-ecf91068"
PIPELINE_MANIFEST_SHA256_PREFIX = "ecf91068"
LEGACY_PIPELINE = "legacy"

DEFAULT_TIMEZONE = "Asia/Colombo"

# Dataset categories (Sign_Language_PP2/<Category>_Organized/<sign>);
# slugs match gloss_signs.category.
CATEGORIES: dict[str, dict] = {
    "greetings": {"name": "Greetings", "signs": ["afternoon", "good", "hello", "me", "meet", "morning", "please", "sorry", "welcome"]},
    "food_drink": {"name": "Food & Drink", "signs": ["bread", "coffee", "egg", "fruit", "hungry", "milk", "tea", "thirsty", "water"]},
    "daily_actions": {"name": "Daily Actions", "signs": ["close", "drink", "eat", "give", "open", "sit", "sleep", "stand", "take", "walk"]},
    "body_parts": {"name": "Body Parts", "signs": ["arm", "back", "head", "mouth", "nose", "stomach"]},
    "health_medical": {"name": "Health & Medical", "signs": ["cough", "dizzy", "pain", "sick", "weak"]},
    "emotion": {"name": "Emotions & Responses", "signs": ["angry", "comfortable", "confused", "happy", "no", "sad", "scared", "tired", "yes"]},
    "emergency": {"name": "Emergency", "signs": ["call", "come", "danger", "doctor", "go", "help", "hospital", "hot", "hurt", "stop", "wait"]},
}
CATEGORY_OF = {s: slug for slug, c in CATEGORIES.items() for s in c["signs"]}
ALL_SIGNS = sorted(CATEGORY_OF)


def is_countable(sign_id: str) -> bool:
    """Counts toward Demonstrated / Retained, categories and levels."""
    return sign_id in CATEGORY_OF and sign_id not in UNRELIABLE


def countable_signs(category: str | None = None) -> list[str]:
    signs = CATEGORIES[category]["signs"] if category else ALL_SIGNS
    return [s for s in signs if is_countable(s)]


# Skill levels, in order (current-pipeline camera attempts only).
LEVELS = [
    {"key": "starter", "name": "Starter", "rule": "first camera attempt"},
    {"key": "learner", "name": "Learner", "rule": "5 signs Demonstrated", "demonstrated": 5},
    {"key": "communicator", "name": "Communicator", "rule": "every countable sign in one category Demonstrated"},
    {"key": "care_signer", "name": "Care Signer", "rule": "30 signs Demonstrated", "demonstrated": 30},
    {"key": "master", "name": "Master", "rule": "every countable sign Demonstrated and Retained"},
]

# Practice badges: effort over ALL history (earlier pipeline versions too).
# Different signs practised with the camera, counting only attempts that
# passed the hand and movement checks (rejected clips are never stored).
PRACTICE_SIGN_COUNTS = [5, 10, 25, 40]
MONTHLY_TIERS = [5, 10, 15]              # active days in a calendar month

DEMONSTRATED_STREAK = 3                  # strong camera attempts in a row
RETAINED_AFTER_DAYS = 7                  # strong recall attempt this long after Demonstrated


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
