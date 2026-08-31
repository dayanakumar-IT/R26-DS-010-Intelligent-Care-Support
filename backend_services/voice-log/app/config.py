"""SCRIBE backend configuration — loads from backend_services/voice-log/.env"""

from __future__ import annotations

import os
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

ADL_CATEGORIES = frozenset({
    "medication", "meal", "fluid_intake", "hygiene", "mobility",
    "symptom", "mood", "nurse_check", "family_visit",
})
