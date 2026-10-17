"""Verify SCRIBE model folders exist before starting the full API."""

from __future__ import annotations

import sys
from pathlib import Path

from app import config

EXPECTED = {
    "Whisper LoRA adapter": config.WHISPER_ADAPTER_PATH,
    "BART disfluency": config.BART_MODEL_PATH,
    "T5 Stage 5": config.T5_MODEL_PATH,
}


def main() -> None:
    print("SCRIBE model path check\n")
    ok = True
    for label, rel_path in EXPECTED.items():
        try:
            resolved = config.resolve_model_dir(rel_path)
            is_lora = "whisper" in rel_path.lower()
            if is_lora:
                has_files = (resolved / "adapter_config.json").exists() and (
                    (resolved / "adapter_model.safetensors").exists()
                    or (resolved / "adapter_model.bin").exists()
                )
                status = "OK" if has_files else "MISSING adapter files"
            else:
                has_files = (resolved / "config.json").exists() and (
                    (resolved / "model.safetensors").exists()
                    or (resolved / "pytorch_model.bin").exists()
                )
                status = "OK" if has_files else "MISSING model files"
            print(f"  [{status}] {label}: {resolved}")
            if not has_files:
                ok = False
        except FileNotFoundError:
            print(f"  [MISSING] {label}: {Path(rel_path)}")
            ok = False

    if ok:
        print("\nAll model folders found. You can start the API without SCRIBE_MOCK_PIPELINE.")
        sys.exit(0)
    print("\nExtract your ZIP files into backend_services/voice-log/models/ — see setup guide.")
    print("Or set SCRIBE_MOCK_PIPELINE=true in .env to test the API without models.")
    sys.exit(1)


if __name__ == "__main__":
    main()
