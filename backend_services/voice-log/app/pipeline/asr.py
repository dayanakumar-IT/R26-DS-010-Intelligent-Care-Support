"""Stage 2 — Whisper-small + LoRA ASR with anti-hallucination generation settings."""

from __future__ import annotations

from pathlib import Path

from app import config


class WhisperAsr:
    def __init__(self) -> None:
        import torch
        from peft import PeftModel
        from transformers import WhisperForConditionalGeneration, WhisperProcessor

        adapter_path = config.resolve_model_dir(config.WHISPER_ADAPTER_PATH)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = WhisperProcessor.from_pretrained(config.WHISPER_BASE_MODEL)
        base = WhisperForConditionalGeneration.from_pretrained(config.WHISPER_BASE_MODEL)
        self.model = PeftModel.from_pretrained(base, str(adapter_path))
        self.model.to(self.device)
        self.model.eval()

    def transcribe(self, wav_path: Path) -> str:
        import librosa
        import torch

        audio, _ = librosa.load(str(wav_path), sr=16000, mono=True)
        if audio.size == 0:
            return ""

        inputs = self.processor(audio, sampling_rate=16000, return_tensors="pt")
        input_features = inputs.input_features.to(self.device)
        attention_mask = inputs.get("attention_mask")
        if attention_mask is not None:
            attention_mask = attention_mask.to(self.device)

        generate_kwargs: dict = {
            "max_new_tokens": 256,
            "num_beams": 1,
            "do_sample": False,
            "temperature": 0.0,
            "language": "en",
            "task": "transcribe",
            # transformers >=5.x renamed this from condition_on_previous_text.
            "condition_on_prev_tokens": False,
            "compression_ratio_threshold": 1.35,
            "logprob_threshold": -1.0,
            "no_speech_threshold": 0.6,
        }
        if attention_mask is not None:
            generate_kwargs["attention_mask"] = attention_mask

        with torch.no_grad():
            predicted_ids = self.model.generate(input_features, **generate_kwargs)

        text = self.processor.batch_decode(
            predicted_ids,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False,
        )[0]
        return text.strip()
