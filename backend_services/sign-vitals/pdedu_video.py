"""
pdedu_video.py
Parkinson's-Disease EDUcation (pdedu_) — resolves a ready-to-play URL
for a symptom's educational movement-pattern video.

The binary lives in Cloudflare R2 under parkinsons/symptom-references/
and is served either as an already-public URL or, more usually, as a
short-lived presigned GET URL minted from server-side credentials. The
frontend never receives R2 credentials.

Reuses r2_presign.get_reference_video_url() (component-agnostic — it
just takes an object key), so GLOSS's presign path is untouched.

EDUCATION ONLY — a demo clip of a movement pattern, never a diagnostic
recording. This module does not diagnose anything.
"""

import logging

from r2_presign import DEFAULT_EXPIRES_IN, get_reference_video_url

logger = logging.getLogger("sign_vitals")

R2_PREFIX = "parkinsons/symptom-references/"


class DemoVideoUnavailable(Exception):
    """No playable video exists for the requested symptom."""


def resolve_symptom_demo_video(supabase_client, symptom_id: str, expires_in: int = DEFAULT_EXPIRES_IN) -> dict:
    """
    Returns {"video_url", "duration_seconds", "url_expires_in"} for the
    given symptom, or raises DemoVideoUnavailable.

    Resolution order (same convention as GLOSS's demo-video endpoint):
      1. active row that already stores a real http(s) URL -> use as-is
      2. otherwise mint a presigned GET URL for the stored object key
    """
    result = (
        supabase_client.table("pdedu_symptom_demo_videos")
        .select("symptom_id, video_object_key, video_url, duration_seconds, is_active")
        .eq("symptom_id", symptom_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise DemoVideoUnavailable(f"No demo video registered for symptom_id: {symptom_id!r}")

    row = result.data[0]
    stored_url = row.get("video_url") or ""
    duration = row.get("duration_seconds")

    if row.get("is_active") and stored_url.startswith(("http://", "https://")):
        return {"video_url": stored_url, "duration_seconds": duration, "url_expires_in": None}

    object_key = row.get("video_object_key") or f"{R2_PREFIX}{symptom_id}.mp4"
    presigned = get_reference_video_url(object_key, expires_in=expires_in)
    if not presigned:
        raise DemoVideoUnavailable(f"No usable demo video for symptom_id: {symptom_id!r}")

    return {"video_url": presigned, "duration_seconds": duration, "url_expires_in": expires_in}


def usable_video_symptom_ids(supabase_client) -> set[str]:
    """Symptom ids that currently have a playable demo video — used by
    the quiz builder so it never serves a video question for a missing
    clip. A row counts as usable if it is active with a public URL, or
    if a presigned URL can be minted for its object key right now."""
    result = (
        supabase_client.table("pdedu_symptom_demo_videos")
        .select("symptom_id, video_object_key, video_url, is_active")
        .execute()
    )
    usable: set[str] = set()
    for row in result.data or []:
        stored_url = row.get("video_url") or ""
        if row.get("is_active") and stored_url.startswith(("http://", "https://")):
            usable.add(row["symptom_id"])
            continue
        object_key = row.get("video_object_key") or f"{R2_PREFIX}{row['symptom_id']}.mp4"
        if get_reference_video_url(object_key):
            usable.add(row["symptom_id"])
    return usable
