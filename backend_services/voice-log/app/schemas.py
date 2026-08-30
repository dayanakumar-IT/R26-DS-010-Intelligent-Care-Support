"""Pydantic schemas for SCRIBE pipeline output and API responses."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class AdlExtraction(BaseModel):
    category: str
    medication_name: str | None = None
    dosage: str | None = None
    food_item: str | None = None
    meal_type: str | None = None
    intake_level: str | None = None
    fluid_type: str | None = None
    fluid_amount: str | None = None
    hygiene_activity: str | None = None
    mobility_type: str | None = None
    destination: str | None = None
    symptom_type: str | None = None
    vital_type: str | None = None
    vital_reading: str | None = None
    vital_status: str | None = None
    visitor_type: str | None = None
    visit_reason: str | None = None
    time_of_day: str | None = None
    alert_required: bool = False

    def to_db_row(self) -> dict[str, Any]:
        row: dict[str, Any] = {}
        for key, value in self.model_dump().items():
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            row[key] = value
        return row


class PipelineResult(BaseModel):
    raw_transcript: str
    cleaned_transcript: str
    extraction: AdlExtraction


class ObservationResponse(BaseModel):
    id: UUID
    patient_id: int
    caregiver_id: UUID
    client_recording_id: UUID
    category: str
    alert_required: bool
    r2_audio_key: str | None
    recorded_at: datetime
    duplicate: bool = False


class PatientSummary(BaseModel):
    id: int
    patient_code: str
    gender: str | None = None
    room_id: str | None = None


class CaregiverSummary(BaseModel):
    id: UUID
    display_name: str
    ward: str | None = None


class DailyReportResponse(BaseModel):
    patient_id: int
    patient_code: str
    report_date: date
    report_text: str
    records: list[dict[str, Any]]


class PeriodSummaryResponse(BaseModel):
    patient_id: int
    patient_code: str
    start_date: date
    end_date: date
    summary_text: str
    audio_url: str | None = None
    cached: bool = False


class AvailableDatesResponse(BaseModel):
    patient_id: int
    patient_code: str
    dates: list[date] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    component: str = "scribe"
    mock_pipeline: bool
    models_loaded: bool
    pipeline_mode: str = "unknown"
    r2_configured: bool
    supabase_configured: bool


class CareActivityResponse(BaseModel):
    id: UUID
    patient_id: int
    caregiver_id: UUID
    status: str
    started_at: str
    completed_at: str | None = None
    daily_summary_text: str | None = None
