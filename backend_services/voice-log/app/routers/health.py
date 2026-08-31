from __future__ import annotations

import os

from fastapi import APIRouter

from app import config
from app.pipeline.runner import get_pipeline
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


def _r2_configured() -> bool:
    required = ("R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME")
    return all(os.environ.get(key) for key in required)


def _supabase_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    pipeline = get_pipeline()
    if config.MOCK_PIPELINE:
        mode = "mock"
    elif pipeline.models_loaded:
        mode = "live"
    else:
        mode = "live_on_first_request"
    return HealthResponse(
        status="ok",
        mock_pipeline=config.MOCK_PIPELINE,
        models_loaded=pipeline.models_loaded,
        pipeline_mode=mode,
        r2_configured=_r2_configured(),
        supabase_configured=_supabase_configured(),
    )
