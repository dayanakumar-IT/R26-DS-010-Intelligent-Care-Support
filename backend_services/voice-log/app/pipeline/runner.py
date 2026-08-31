"""Orchestrates SCRIBE pipeline stages 1–5."""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import uuid4

from app import config
from app.pipeline.audio_preprocess import preprocess_audio
from app.pipeline.transcript_quality import (
    sanitize_transcript,
    validate_polished_transcript,
    validate_transcript,
)
from app.schemas import AdlExtraction, PipelineResult

logger = logging.getLogger(__name__)


class ScribePipeline:
    def __init__(self) -> None:
        self._asr: WhisperAsr | None = None
        self._disfluency: DisfluencyRemover | None = None
        self._extractor: AdlExtractor | None = None

    @property
    def models_loaded(self) -> bool:
        return self._asr is not None and self._disfluency is not None and self._extractor is not None

    def load_models(self) -> None:
        if config.MOCK_PIPELINE:
            logger.warning("SCRIBE_MOCK_PIPELINE=true — ML models will not be loaded")
            return
        logger.info("Loading SCRIBE ML models (this may take a minute on first run)...")
        from app.pipeline.asr import WhisperAsr
        from app.pipeline.disfluency import DisfluencyRemover
        from app.pipeline.extraction import AdlExtractor

        self._asr = WhisperAsr()
        self._disfluency = DisfluencyRemover()
        self._extractor = AdlExtractor()
        logger.info("SCRIBE ML models loaded")

    def run(self, input_audio: Path) -> PipelineResult:
        config.TMP_DIR.mkdir(parents=True, exist_ok=True)
        work_id = uuid4().hex
        wav_path = config.TMP_DIR / f"{work_id}_16k.wav"
        preprocess_audio(input_audio, wav_path)

        if config.MOCK_PIPELINE:
            logger.warning(
                "SCRIBE_MOCK_PIPELINE=true — returning hardcoded demo transcript; "
                "recorded audio is NOT sent to Whisper. Set SCRIBE_MOCK_PIPELINE=false "
                "in .env and restart run.ps1 to use real ASR."
            )
            return _mock_result()

        if not self.models_loaded:
            self.load_models()

        if not self.models_loaded:
            raise RuntimeError(
                "SCRIBE ML models are not loaded. Extract models into models/ "
                "or set SCRIBE_MOCK_PIPELINE=true for demo-only mode."
            )
        raw = self._asr.transcribe(wav_path)
        logger.info("ASR transcript (%s): %s", wav_path.name, raw[:120] if raw else "(empty)")
        raw = validate_transcript(raw)
        cleaned = self._disfluency.clean(raw)
        cleaned = sanitize_transcript(cleaned)
        if not cleaned:
            raise ValueError(
                "Transcription was empty after cleaning. Please record a clear ADL observation and try again."
            )
        from app.pipeline.grammar import correct_grammar

        grammatical = sanitize_transcript(correct_grammar(cleaned))
        if not grammatical:
            raise ValueError(
                "Transcription was empty after grammar correction. Please record again with a clear ADL description."
            )
        grammatical = validate_polished_transcript(grammatical)
        extraction = self._extractor.extract(grammatical)
        logger.info(
            "Pipeline complete (%s): category=%s alert=%s transcript=%s",
            wav_path.name,
            extraction.category,
            extraction.alert_required,
            grammatical[:120],
        )
        return PipelineResult(
            raw_transcript=raw,
            cleaned_transcript=grammatical,
            extraction=extraction,
        )


def _mock_result() -> PipelineResult:
    extraction = AdlExtraction(
        category="medication",
        medication_name="Metformin",
        dosage="500mg",
        time_of_day="morning",
        alert_required=False,
    )
    return PipelineResult(
        raw_transcript="uh gave P01 her metformin this morning no issues",
        cleaned_transcript="Gave P01 her Metformin this morning, no issues.",
        extraction=extraction,
    )


_pipeline: ScribePipeline | None = None


def get_pipeline() -> ScribePipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = ScribePipeline()
    return _pipeline
