from __future__ import annotations

import tempfile
from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from app.schemas import ObservationResponse
from app.services.observations import process_observation

router = APIRouter(prefix="/observations", tags=["observations"])


@router.post("", response_model=ObservationResponse)
async def create_observation(
    audio: UploadFile = File(...),
    patient_id: int = Form(...),
    caregiver_id: UUID = Form(...),
    client_recording_id: UUID = Form(...),
    recorded_at: datetime | None = Form(None),
    care_activity_id: UUID | None = Form(None),
) -> ObservationResponse:
    suffix = Path(audio.filename or "recording.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = Path(tmp.name)
        content = await audio.read()
        tmp.write(content)

    try:
        return process_observation(
            audio_path=tmp_path,
            patient_id=patient_id,
            caregiver_id=caregiver_id,
            client_recording_id=client_recording_id,
            recorded_at=recorded_at,
            care_activity_id=care_activity_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Observation processing failed: {exc}") from exc
    finally:
        if tmp_path.exists():
            tmp_path.unlink()
