"""Smoke-test SCRIBE API endpoints (use with SCRIBE_MOCK_PIPELINE=true)."""

from __future__ import annotations

import sys
from uuid import uuid4

import httpx

BASE = "http://127.0.0.1:8004"


def main() -> None:
    print("1. Health check...")
    health = httpx.get(f"{BASE}/health", timeout=30)
    health.raise_for_status()
    print("   ", health.json())

    print("2. List patients...")
    patients = httpx.get(f"{BASE}/patients", timeout=30)
    patients.raise_for_status()
    data = patients.json()
    print(f"   Found {len(data)} patient(s)")
    if not data:
        print("   WARNING: no patients in database — add test rows in Supabase first")
        sys.exit(0)

    patient_id = data[0]["id"]
    caregiver_id = uuid4()
    client_recording_id = uuid4()

    print("3. POST /observations (mock pipeline)...")
    # Minimal silent WAV header bytes — mock pipeline ignores audio content
    wav_bytes = (
        b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
        b"\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    )
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    form = {
        "patient_id": str(patient_id),
        "caregiver_id": str(caregiver_id),
        "client_recording_id": str(client_recording_id),
    }
    obs = httpx.post(f"{BASE}/observations", files=files, data=form, timeout=120)
    if obs.status_code >= 400:
        print("   FAILED:", obs.status_code, obs.text)
        sys.exit(1)
    print("   ", obs.json())
    print("\nAll smoke tests passed.")


if __name__ == "__main__":
    main()
