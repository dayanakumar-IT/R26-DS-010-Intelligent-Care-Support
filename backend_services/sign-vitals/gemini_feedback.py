"""
gemini_feedback.py
GLOSS component — guarded Gemini rewording of the rule-based feedback.

The only thing Gemini is ever asked to do is reword the rule-based
feedback text, and only through gloss_assets/gloss_feedback_guard.py
(v2, used unchanged): safe_feedback_text() builds the prompt, skips
Gemini entirely on very-low-confidence attempts, checks every reply for
faithfulness, and falls back to the rule-based text if anything is off.
There is no other prompt in the app.

The API key comes from the GEMINI_API_KEY environment variable and
nowhere else. If it is unset, or any call fails, the learner sees the
rule-based text unchanged.
"""

import logging
import os
import sys

from recogniser import ASSETS_DIR

if ASSETS_DIR not in sys.path:
    sys.path.insert(0, ASSETS_DIR)

from gloss_feedback_guard import safe_feedback_text  # noqa: E402

logger = logging.getLogger("sign_vitals")

GEMINI_MODEL = "gemini-3.5-flash-lite"
GEMINI_TEMPERATURE = 0.6
GEMINI_MAX_OUTPUT_TOKENS = 300
# The rewording runs inside the attempt request — don't let a slow
# Gemini call hold the caregiver's feedback up for long.
GEMINI_TIMEOUT_MS = 10_000

_client = None


def _get_client():
    """The Gemini client, created on first use; None if GEMINI_API_KEY
    is not set."""
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return None
        from google import genai
        from google.genai import types

        _client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS))
    return _client


def call_gemini(prompt: str) -> str:
    """Sends one prompt string to Gemini and returns the reply text.
    Raises on any failure — safe_feedback_text() catches it and falls
    back to the rule-based text."""
    from google.genai import types

    client = _get_client()
    if client is None:
        raise RuntimeError("GEMINI_API_KEY is not set")
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=GEMINI_TEMPERATURE,
            max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
        ),
    )
    return response.text


def feedback_text(result: dict, base: dict) -> str:
    """
    result: grading.grade_learner_attempt() dict.
    base: feedback_generator.generate_feedback(result) dict.

    Returns the text to show the learner: the guarded Gemini rewording
    when it passes every check, otherwise base["full_text"] unchanged.
    """
    rule_text = base["full_text"]
    try:
        if _get_client() is None:
            return rule_text
        text = safe_feedback_text(result, base, call_gemini)
    except Exception:
        logger.exception("[GLOSS][FEEDBACK][ERROR] Gemini rewording failed — using rule-based text")
        return rule_text
    logger.info(
        "[GLOSS][FEEDBACK] feedback text ready | source=%s",
        "rule_based" if text == rule_text else "gemini_guarded",
    )
    return text
