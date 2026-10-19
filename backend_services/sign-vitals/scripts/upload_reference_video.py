"""
upload_reference_video.py
GLOSS component — one-off admin tool, NOT part of the running app.

Uploads ONE validated human reference video for a sign to Cloudflare R2
under the dedicated GLOSS prefix, then upserts its metadata row into
public.gloss_sign_demo_videos so GET /gloss/signs/{sign_id}/demo-video
can serve it.

R2 objects are written ONLY under:  gloss/sign-references/{sign_id}.mp4
This script never touches any other prefix / other component's objects.

Requires in backend_services/sign-vitals/.env (never printed, never committed):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET_NAME
  R2_ENDPOINT
  R2_PUBLIC_URL_BASE   (OPTIONAL — the public base URL the object resolves at,
                        e.g. an r2.dev dev URL or a custom domain. If you don't
                        have one yet, upload with --inactive and pass --url
                        later, or generate presigned URLs from the backend.)

Usage:
  # 1. verify the connection + list what's already stored
  python scripts/upload_reference_video.py --check

  # 2. upload one validated clip for a sign
  python scripts/upload_reference_video.py hello ./validated/hello.mp4 --duration 4

  # if you have no public URL yet: upload now, activate later
  python scripts/upload_reference_video.py hello ./validated/hello.mp4 --inactive
  python scripts/upload_reference_video.py hello ./validated/hello.mp4 --url https://pub-xxxx.r2.dev/gloss/sign-references/hello.mp4
"""

import argparse
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

R2_PREFIX = "gloss/sign-references/"
_REQUIRED_R2_VARS = (
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_ENDPOINT",
)


def _fail(message: str) -> None:
    print(message)
    sys.exit(1)


def _make_s3():
    try:
        import boto3  # noqa: PLC0415 — optional dep, only this script needs it
    except ImportError:
        _fail("boto3 is required. Install it into the venv you run this with:  pip install boto3")
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def _load_env() -> None:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(here, ".env"))
    missing = [name for name in _REQUIRED_R2_VARS if not os.environ.get(name)]
    if missing:
        _fail("Missing required R2 env var(s) in .env: " + ", ".join(missing))


def _check() -> None:
    _load_env()
    bucket = os.environ["R2_BUCKET_NAME"]
    s3 = _make_s3()
    try:
        s3.head_bucket(Bucket=bucket)
    except Exception as e:  # noqa: BLE001 — surface any auth/endpoint error plainly
        _fail(f"Could not reach bucket {bucket!r}: {type(e).__name__}: {e}")
    print(f"Connected OK to bucket {bucket!r}.")
    resp = s3.list_objects_v2(Bucket=bucket, Prefix=R2_PREFIX)
    objects = resp.get("Contents", [])
    if not objects:
        print(f"No objects under {R2_PREFIX} yet.")
    else:
        print(f"{len(objects)} object(s) under {R2_PREFIX}:")
        for obj in objects:
            print(f"  {obj['Key']}  ({obj['Size']} bytes)")


def _upload(args: argparse.Namespace) -> None:
    if not os.path.isfile(args.video_path):
        _fail(f"File not found: {args.video_path}")
    ext = os.path.splitext(args.video_path)[1].lower() or ".mp4"
    if ext not in (".mp4", ".webm"):
        _fail(f"Unsupported extension {ext!r} — use .mp4 or .webm.")

    _load_env()
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        _fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")

    supabase = create_client(supabase_url, supabase_key)
    sign = supabase.table("gloss_signs").select("id, display_name").eq("id", args.sign_id).limit(1).execute()
    if not sign.data:
        _fail(f"Unknown sign_id {args.sign_id!r} — not in gloss_signs.")
    display_name = sign.data[0]["display_name"]

    object_key = f"{R2_PREFIX}{args.sign_id}{ext}"
    bucket = os.environ["R2_BUCKET_NAME"]
    s3 = _make_s3()
    content_type = "video/mp4" if ext == ".mp4" else "video/webm"

    print(f"Uploading {args.video_path} -> r2://{bucket}/{object_key} ...")
    with open(args.video_path, "rb") as fh:
        s3.put_object(Bucket=bucket, Key=object_key, Body=fh, ContentType=content_type)

    public_base = args.url or os.environ.get("R2_PUBLIC_URL_BASE")
    if args.url:
        video_url = args.url
    elif public_base:
        video_url = public_base.rstrip("/") + "/" + object_key
    else:
        video_url = f"pending:{object_key}"

    is_active = (not args.inactive) and not video_url.startswith("pending:")

    from datetime import datetime, timezone

    row = {
        "sign_id": args.sign_id,
        "video_object_key": object_key,
        "video_url": video_url,
        "duration_seconds": args.duration,
        "is_active": is_active,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("gloss_sign_demo_videos").upsert(row, on_conflict="sign_id").execute()

    print(f"Done: '{display_name}' ({args.sign_id}) — object stored, row upserted.")
    print(f"  object_key: {object_key}")
    print(f"  video_url:  {video_url}")
    print(f"  is_active:  {is_active}")
    if not is_active:
        print(
            "  NOTE: row is INACTIVE — the frontend will not serve it yet.\n"
            "        Re-run with --url <public URL for this object> once you have a\n"
            "        public/dev URL or custom domain for the bucket."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload one GLOSS reference video to R2 + register its metadata.")
    parser.add_argument("--check", action="store_true", help="Verify the R2 connection and list stored objects, then exit.")
    parser.add_argument("sign_id", nargs="?", help="Must match a public.gloss_signs.id exactly, e.g. 'hello'.")
    parser.add_argument("video_path", nargs="?", help="Local path to the validated .mp4/.webm file.")
    parser.add_argument("--duration", type=int, default=None, help="Duration in whole seconds (optional).")
    parser.add_argument("--url", default=None, help="Explicit public URL for this object (overrides R2_PUBLIC_URL_BASE).")
    parser.add_argument("--inactive", action="store_true", help="Register the row but leave is_active=false.")
    args = parser.parse_args()

    if args.check:
        _check()
        return
    if not args.sign_id or not args.video_path:
        parser.error("sign_id and video_path are required (or pass --check).")
    _upload(args)


if __name__ == "__main__":
    main()