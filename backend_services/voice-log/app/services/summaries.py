"""Stage 7 — period summary text + gTTS audio cached on R2."""

from __future__ import annotations

import tempfile
from datetime import date
from pathlib import Path

from gtts import gTTS

from r2_storage import summary_object_key, upload_file


def synthesize_summary_audio(spoken_text: str, output_path: Path) -> Path:
    tts = gTTS(text=spoken_text, lang="en", tld="co.in")
    tts.save(str(output_path))
    return output_path


def cache_period_summary_audio(
    *,
    patient_code: str,
    start_date: date,
    end_date: date,
    spoken_text: str,
) -> str:
    """spoken_text is the short TTS script from build_spoken_period_summary —
    NOT the full summary_text (which stays the written report used for
    "View full text" and PDF/Excel exports)."""
    key = summary_object_key(patient_code, start_date.isoformat(), end_date.isoformat())
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        synthesize_summary_audio(spoken_text, tmp_path)
        upload_file(tmp_path, key)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()
    return key
