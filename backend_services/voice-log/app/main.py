"""SCRIBE (voice-log) FastAPI application entry point."""

from __future__ import annotations

import logging
import os

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.pipeline.runner import get_pipeline
from app.routers import assignments, care_activities, health, observations, patients
from app.services.supabase_client import shutdown_supabase_client
from app.services.supabase_queries import TRANSIENT_SUPABASE_HTTP_ERRORS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SCRIBE API",
    description="Voice ADL logging backend for CareSense (voice-log component)",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(observations.router)
app.include_router(patients.router)
app.include_router(care_activities.router)
app.include_router(assignments.router)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_request: Request, exc: RuntimeError) -> JSONResponse:
    message = str(exc)
    if "Missing required environment variable" in message:
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    f"{message} — open backend_services/voice-log/.env, set the value, "
                    "then restart the API (run.ps1)."
                ),
            },
        )
    return JSONResponse(status_code=500, content={"detail": message})


@app.exception_handler(httpx.HTTPError)
async def httpx_error_handler(_request: Request, exc: httpx.HTTPError) -> JSONResponse:
    if isinstance(exc, TRANSIENT_SUPABASE_HTTP_ERRORS):
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    "Temporary connection issue while talking to Supabase. "
                    "Please retry in a moment."
                ),
            },
        )
    return JSONResponse(status_code=502, content={"detail": f"Upstream request failed: {exc}"})


@app.on_event("startup")
def startup() -> None:
    config.TMP_DIR.mkdir(parents=True, exist_ok=True)
    config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    if not config.MOCK_PIPELINE:
        try:
            get_pipeline().load_models()
        except FileNotFoundError as exc:
            logger.error("Model files missing: %s", exc)
            logger.error(
                "Extract ZIPs into backend_services/voice-log/models/ "
                "or set SCRIBE_MOCK_PIPELINE=true in .env"
            )
    else:
        logger.warning("Running with SCRIBE_MOCK_PIPELINE=true")

    if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        logger.error(
            "SUPABASE_SERVICE_ROLE_KEY is not set — /patients and /observations will return 503 "
            "until you add the service_role JWT to backend_services/voice-log/.env"
        )


@app.on_event("shutdown")
def shutdown() -> None:
    shutdown_supabase_client()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=config.API_HOST, port=config.API_PORT, reload=True)
