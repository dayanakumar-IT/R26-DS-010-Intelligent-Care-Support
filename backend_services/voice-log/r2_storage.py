"""
SCRIBE — Cloudflare R2 storage (S3-compatible).

Bucket: caresense-voice-models (voice-log token, least-privilege scoped).
Object layout:
  scribe/audio/{patient_code}/{recording_id}.opus
  scribe/summaries/{patient_code}/{start_date}_{end_date}.mp3

Model weights are NOT stored in R2 — only caregiver audio and TTS summaries.
The frontend never talks to R2 directly; use presigned_url() from the backend API.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import boto3
from botocore.client import BaseClient
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(_ENV_PATH)

SCRIBE_PREFIX = "scribe"
PRESIGNED_URL_EXPIRY_SECONDS = 3600  # ~1 hour


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing {name}. Copy .env.example to .env in backend_services/voice-log/ "
            f"and set your R2 credentials."
        )
    return value


@lru_cache(maxsize=1)
def get_r2_client() -> BaseClient:
    return boto3.client(
        "s3",
        endpoint_url=_require_env("R2_ENDPOINT"),
        aws_access_key_id=_require_env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=_require_env("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )


def get_bucket_name() -> str:
    return _require_env("R2_BUCKET_NAME")


def audio_object_key(patient_code: str, recording_id: str, *, suffix: str = ".webm") -> str:
    ext = suffix if suffix.startswith(".") else f".{suffix}"
    return f"{SCRIBE_PREFIX}/audio/{patient_code}/{recording_id}{ext}"


def summary_object_key(patient_code: str, start_date: str, end_date: str) -> str:
    return f"{SCRIBE_PREFIX}/summaries/{patient_code}/{start_date}_{end_date}.mp3"


def upload_file(local_path: str | Path, object_key: str) -> str:
    """Upload a local file; returns the R2 object key stored in adl_records.r2_audio_key."""
    client = get_r2_client()
    bucket = get_bucket_name()
    client.upload_file(str(local_path), bucket, object_key)
    return object_key


def upload_bytes(
    data: bytes,
    object_key: str,
    *,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload in-memory bytes; returns the R2 object key."""
    client = get_r2_client()
    bucket = get_bucket_name()
    client.put_object(Bucket=bucket, Key=object_key, Body=data, ContentType=content_type)
    return object_key


def download_file(object_key: str, local_path: str | Path) -> None:
    client = get_r2_client()
    client.download_file(get_bucket_name(), object_key, str(local_path))


def presigned_url(object_key: str, *, expires_in: int = PRESIGNED_URL_EXPIRY_SECONDS) -> str:
    """Short-lived URL for private audio playback — never expose the bucket publicly."""
    client = get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": get_bucket_name(), "Key": object_key},
        ExpiresIn=expires_in,
    )


def delete_object(object_key: str) -> None:
    """Used by the retention job after purging raw audio (14–30 days)."""
    client = get_r2_client()
    client.delete_object(Bucket=get_bucket_name(), Key=object_key)


def list_objects(prefix: str = f"{SCRIBE_PREFIX}/") -> list[str]:
    client = get_r2_client()
    bucket = get_bucket_name()
    keys: list[str] = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys
