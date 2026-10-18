"""Stage 1 — resample to 16 kHz mono WAV and trim leading/trailing silence.

Also provides the Change-1(a) long-recording support: splitting an already
preprocessed (16 kHz mono) array into the smallest number of equal chunks
that are each within Whisper's ~30s attention window, and reloading a
preprocessed WAV back into memory for that chunking step.
"""

from __future__ import annotations

import math
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

from app import config

# dB threshold for librosa silence detection (higher = more aggressive trim).
_TRIM_TOP_DB = 28
_MIN_SPEECH_MS = 450
_MIN_RMS = 0.008


def _duration_ms(audio: np.ndarray, sample_rate: int) -> float:
    return (len(audio) / sample_rate) * 1000.0


def trim_silence(audio: np.ndarray, *, sample_rate: int, top_db: float = _TRIM_TOP_DB) -> np.ndarray:
    """Keep only voiced segments; drops long silent gaps common in care-activity recordings."""
    if audio.size == 0:
        return audio

    intervals = librosa.effects.split(audio, top_db=top_db)
    if intervals.size == 0:
        return np.array([], dtype=audio.dtype)

    chunks = [audio[start:end] for start, end in intervals]
    if not chunks:
        return np.array([], dtype=audio.dtype)

    return np.concatenate(chunks)


def preprocess_audio(input_path: Path, output_path: Path, *, target_sr: int = 16000) -> Path:
    audio, _ = librosa.load(str(input_path), sr=target_sr, mono=True)
    audio = np.clip(audio, -1.0, 1.0)

    trimmed = trim_silence(audio, sample_rate=target_sr)
    speech_ms = _duration_ms(trimmed, target_sr)

    if speech_ms < _MIN_SPEECH_MS:
        raise ValueError(
            "No clear speech detected in the recording. "
            "Speak about the care activity while recording, then finish when done."
        )

    rms = float(np.sqrt(np.mean(trimmed ** 2)))
    if rms < _MIN_RMS:
        raise ValueError(
            "Audio level is too low. Move closer to the microphone or check mic permissions, then try again."
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), trimmed, target_sr)
    return output_path


def load_wav_array(path: Path) -> tuple[np.ndarray, int]:
    """Read back a WAV already written by preprocess_audio (16 kHz mono)."""
    audio, sample_rate = sf.read(str(path), dtype="float32", always_2d=False)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio, sample_rate


def split_into_chunks(
    audio: np.ndarray,
    sample_rate: int,
    max_chunk_seconds: float | None = None,
) -> list[np.ndarray]:
    """Split audio into the smallest number of EQUAL chunks, each at most
    max_chunk_seconds long (Change 1a). A 51s recording becomes 2 chunks of
    25.5s, not a 30s chunk plus a stray 20.5s one — fixed-size chunking
    leaves a short final piece that tends to make Whisper hallucinate.

    Audio at or under the limit is returned unchanged as a single chunk, so
    short recordings take exactly the same path as before this feature.
    """
    if max_chunk_seconds is None:
        max_chunk_seconds = config.MAX_CHUNK_SECONDS

    max_chunk_samples = int(max_chunk_seconds * sample_rate)
    if audio.size <= max_chunk_samples:
        return [audio]

    num_chunks = math.ceil(audio.size / max_chunk_samples)
    return [chunk for chunk in np.array_split(audio, num_chunks) if chunk.size > 0]
