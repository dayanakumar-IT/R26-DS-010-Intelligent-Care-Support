"""
r2_presign.py
GLOSS component — short-lived presigned GET URLs for reference videos
stored in Cloudflare R2.

The R2 bucket is private (no public/custom-domain URL configured), so
the backend mints a time-limited signed URL on demand from the
credentials already in backend_services/sign-vitals/.env. The frontend
only ever receives that signed URL — never the R2 access key id/secret,
never the Cloudflare API token.

A SigV4 presigned URL does contain the R2 *Access Key ID* in its
X-Amz-Credential query param — that is inherent to the scheme and is
not a secret (it cannot be used without the secret, which never leaves
this process). The Secret Access Key is never included.

Optional dependency: boto3. If boto3 is missing or R2 is not
configured, get_reference_video_url() returns None and the caller
falls back to whatever public video_url the metadata row already
holds (or 404s).
"""

import logging
import os

logger = logging.getLogger("sign_vitals")

DEFAULT_EXPIRES_IN = 3600  # seconds — comfortably longer than one practice session

_REQUIRED_ENV = ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_ENDPOINT")

_client = None
_client_resolved = False


def _get_client():
    """Lazily builds one boto3 S3 client for R2. Returns None (once,
    cached) if R2 isn't configured or boto3 isn't installed."""
    global _client, _client_resolved
    if _client_resolved:
        return _client
    _client_resolved = True

    missing = [k for k in _REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        logger.info("R2 not configured (missing %s) — presigned reference-video URLs disabled", missing)
        return None

    try:
        import boto3  # noqa: PLC0415 — optional dependency
    except ImportError:
        logger.warning("boto3 not installed — presigned reference-video URLs disabled")
        return None

    _client = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    return _client


def r2_is_configured() -> bool:
    return _get_client() is not None


def get_reference_video_url(object_key: str, expires_in: int = DEFAULT_EXPIRES_IN) -> str | None:
    """Verifies the R2 object exists, then returns a presigned GET URL
    for it. Returns None if R2 isn't available, the object is missing,
    or signing fails."""
    client = _get_client()
    if client is None:
        return None

    bucket = os.environ["R2_BUCKET_NAME"]
    try:
        client.head_object(Bucket=bucket, Key=object_key)
    except Exception:
        logger.info("R2 reference-video object not found: %s", object_key)
        return None

    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )
    except Exception:
        logger.exception("failed to presign R2 object: %s", object_key)
        return None