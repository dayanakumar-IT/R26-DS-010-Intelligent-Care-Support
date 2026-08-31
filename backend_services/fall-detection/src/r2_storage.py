"""
Cloudflare R2 storage — skeleton replay frames only.

R2 is S3-compatible, so we use boto3 with a custom endpoint.

Each alert's replay is stored as one JSON file:
    Key: replays/alert_{alert_id}.json
    Value: list of { frame_index, timestamp, skeleton }

Setup:
    Set in .env file:
        R2_ACCOUNT_ID=your-cloudflare-account-id
        R2_ACCESS_KEY_ID=your-r2-access-key
        R2_SECRET_ACCESS_KEY=your-r2-secret-key
        R2_BUCKET_NAME=your-bucket-name
"""
from __future__ import annotations

import json
import os
from typing import List

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

_ACCOUNT_ID       = os.environ.get("R2_ACCOUNT_ID", "")
_ACCESS_KEY_ID    = os.environ.get("R2_ACCESS_KEY_ID", "")
_SECRET_KEY       = os.environ.get("R2_SECRET_ACCESS_KEY", "")
_BUCKET           = os.environ.get("R2_BUCKET_NAME", "sentry-replays")
_ENDPOINT         = f"https://{_ACCOUNT_ID}.r2.cloudflarestorage.com"

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not _ACCOUNT_ID or not _ACCESS_KEY_ID or not _SECRET_KEY:
        raise EnvironmentError(
            "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY "
            "must be set in your .env file."
        )
    _client = boto3.client(
        "s3",
        endpoint_url=_ENDPOINT,
        aws_access_key_id=_ACCESS_KEY_ID,
        aws_secret_access_key=_SECRET_KEY,
        region_name="auto",
    )
    return _client


def save_replay_to_r2(alert_id: int, frames: list):
    """
    Save skeleton replay frames to R2.
    frames: list of (frame_index, timestamp, skeleton_array)
    """
    try:
        client = _get_client()
        data = [
            {
                "frame_index": idx,
                "timestamp":   ts,
                "skeleton":    sk.tolist() if hasattr(sk, "tolist") else sk,
            }
            for idx, ts, sk in frames
        ]
        key = f"replays/alert_{alert_id}.json"
        client.put_object(
            Bucket=_BUCKET,
            Key=key,
            Body=json.dumps(data).encode("utf-8"),
            ContentType="application/json",
        )
        print(f"[r2] Replay saved: {key}")
    except Exception as e:
        print(f"[r2] save_replay_to_r2 failed: {e}")


def get_replay_from_r2(alert_id: int) -> List[dict]:
    """Fetch skeleton replay frames from R2."""
    try:
        client = _get_client()
        key = f"replays/alert_{alert_id}.json"
        response = client.get_object(Bucket=_BUCKET, Key=key)
        data = json.loads(response["Body"].read().decode("utf-8"))
        return data
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            return []
        print(f"[r2] get_replay_from_r2 failed: {e}")
        return []
    except Exception as e:
        print(f"[r2] get_replay_from_r2 failed: {e}")
        return []
