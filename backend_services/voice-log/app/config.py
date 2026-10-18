"""SCRIBE backend configuration — loads from backend_services/voice-log/.env"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env")

COMPONENT = "scribe"


def _env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or value == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _is_model_bundle(directory: Path) -> bool:
    return (directory / "config.json").exists() or (directory / "adapter_config.json").exists()


def resolve_model_dir(path: str | Path) -> Path:
    """Accept model root or a ZIP extract folder with one nested model directory."""
    base = (_ROOT / path).resolve() if not Path(path).is_absolute() else Path(path)
    if not base.exists():
        raise FileNotFoundError(f"Model path not found: {base}")
    if _is_model_bundle(base):
        return base
    subdirs = [d for d in base.iterdir() if d.is_dir()]
    if len(subdirs) == 1 and _is_model_bundle(subdirs[0]):
        return subdirs[0]
    return base


API_HOST = os.environ.get("API_HOST", "0.0.0.0")
API_PORT = int(os.environ.get("API_PORT", "8004"))
MOCK_PIPELINE = _env_bool("SCRIBE_MOCK_PIPELINE", False)

SUPABASE_URL = lambda: _env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = lambda: _env("SUPABASE_SERVICE_ROLE_KEY")

WHISPER_BASE_MODEL = os.environ.get("SCRIBE_WHISPER_BASE_MODEL", "openai/whisper-small")
WHISPER_ADAPTER_PATH = os.environ.get("SCRIBE_WHISPER_ADAPTER_PATH", "models/whisper_lora")
BART_MODEL_PATH = os.environ.get("SCRIBE_BART_MODEL_PATH", "models/bart_disfluency")
T5_MODEL_PATH = os.environ.get("SCRIBE_T5_MODEL_PATH", "models/t5_stage5")

TMP_DIR = _ROOT / "tmp"
MODELS_DIR = _ROOT / "models"
PROTECTED_VOCAB_PATH = _ROOT / "protected_vocab.txt"

# Whisper only ever attends to ~30s per call — recordings longer than this
# are split into the smallest number of equal chunks that are each <= this
# many seconds (see app/pipeline/audio_preprocess.py: split_into_chunks).
MAX_CHUNK_SECONDS = float(os.environ.get("SCRIBE_MAX_CHUNK_SECONDS", "30"))

ADL_CATEGORIES = frozenset({
    "medication", "meal", "fluid_intake", "hygiene", "mobility",
    "symptom", "mood", "nurse_check", "family_visit",
})

# Sri Lanka has used a fixed UTC+05:30 offset (no daylight saving) since
# 1996, so a static offset is correct and avoids relying on the IANA tzdata
# package being installed (zoneinfo.ZoneInfo("Asia/Colombo") would need it
# on Windows). Shared by every place that queries by calendar day or
# displays a stored (UTC) timestamp as a human-readable local time.
COLOMBO_TZ = timezone(timedelta(hours=5, minutes=30))


def to_colombo(value: object) -> datetime | None:
    """Parses a stored UTC timestamp (str or datetime) and returns it
    converted to Sri Lanka time. Records are stored and queried in UTC —
    this conversion belongs only at the point a timestamp is formatted for
    a human to read, never before. Returns None if value can't be parsed."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(COLOMBO_TZ)


def colombo_today() -> date:
    return datetime.now(COLOMBO_TZ).date()
