"""
upload_parkinsons_video.py
Parkinson's Symptom Trainer — one-off admin tool, NOT part of the
running app.

Uploads ONE educational movement-pattern video for a Parkinson's
symptom to Cloudflare R2 under the dedicated Parkinson's prefix, then
upserts its metadata row into public.pdedu_symptom_demo_videos so
GET /pdedu/symptoms/{symptom_id}/demo-video (and the video quiz
questions) can serve it.

EDUCATION ONLY — the clip demonstrates a movement pattern for
caregiver symptom-recognition training. It is not a diagnostic
recording and this tool does not diagnose anything.

R2 objects are written ONLY under:  parkinsons/symptom-references/{symptom_id}.{ext}
This script never touches gloss/sign-references/ or any other
component's objects.

Reuses the SAME credentials already in backend_services/sign-vitals/.env
(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT). No second
credential system. R2_PUBLIC_URL_BASE is optional.

Usage:
  # verify the connection + list ONLY what's under the Parkinson's prefix
  python scripts/upload_parkinsons_video.py --check

  # one pilot upload
  python scripts/upload_parkinsons_video.py bradykinesia "C:\\PARKINSONS-Reference-Videos\\bradykinesia.mp4" --duration 8

  # if you have no public URL yet: upload now, activate later
  python scripts/upload_parkinsons_video.py bradykinesia "C:\\PARKINSONS-Reference-Videos\\bradykinesia.mp4" --inactive
  python scripts/upload_parkinsons_video.py bradykinesia "C:\\PARKINSONS-Reference-Videos\\bradykinesia.mp4" --url https://pub-xxxx.r2.dev/parkinsons/symptom-references/bradykinesia.mp4
"""

import argparse
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

R2_PREFIX = "parkinsons/symptom-references/"
_REQUIRED_R2_VARS = (
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_ENDPOINT",
)
_ALLOWED_EXT = (".mp4", ".webm")


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


def _supabase():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        _fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    return create_client(supabase_url, supabase_key)


def _check() -> None:
    _load_env()
    bucket = os.environ["R2_BUCKET_NAME"]
    s3 = _make_s3()
    try:
        s3.head_bucket(Bucket=bucket)
    except Exception as e:  # noqa: BLE001 — surface any auth/endpoint error plainly
        _fail(f"Could not reach bucket {bucket!r}: {type(e).__name__}: {e}")
    print(f"Connected OK to bucket {bucket!r}.")
    # ONLY the Parkinson's prefix — never lists gloss/ or anything else.
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
    if ext not in _ALLOWED_EXT:
        _fail(f"Unsupported extension {ext!r} — use .mp4 or .webm.")

    _load_env()
    supabase = _supabase()

    symptom = (
        supabase.table("pdedu_symptoms")
        .select("id, display_name, is_active")
        .eq("id", args.symptom_id)
        .limit(1)
        .execute()
    )
    if not symptom.data:
        _fail(f"Unknown symptom_id {args.symptom_id!r} — not in pdedu_symptoms.")
    display_name = symptom.data[0]["display_name"]

    object_key = f"{R2_PREFIX}{args.symptom_id}{ext}"
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
        video_url = None  # no public URL yet — backend will presign

    is_active = (not args.inactive) and bool(video_url)

    row = {
        "symptom_id": args.symptom_id,
        "video_object_key": object_key,
        "video_url": video_url,
        "duration_seconds": args.duration,
        "is_active": is_active,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("pdedu_symptom_demo_videos").upsert(row, on_conflict="symptom_id").execute()

    print(f"Done: '{display_name}' ({args.symptom_id}) — object stored, row upserted.")
    print(f"  object_key: {object_key}")
    print(f"  video_url:  {video_url or '(none — backend will generate presigned URLs)'}")
    print(f"  is_active:  {is_active}")
    if not is_active:
        print(
            "  NOTE: row is INACTIVE. Playback still works via backend-generated\n"
            "        presigned URLs. Re-run with --url <public URL> once the bucket\n"
            "        has a public/dev URL or custom domain if you want a stable URL."
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Upload one Parkinson's symptom education video to R2 + register its metadata."
    )
    parser.add_argument("--check", action="store_true", help="Verify the R2 connection and list objects under parkinsons/symptom-references/ only, then exit.")
    parser.add_argument("symptom_id", nargs="?", help="Must match a public.pdedu_symptoms.id exactly, e.g. 'bradykinesia'.")
    parser.add_argument("video_path", nargs="?", help="Local path to the .mp4/.webm file.")
    parser.add_argument("--duration", type=int, default=None, help="Duration in whole seconds (optional).")
    parser.add_argument("--url", default=None, help="Explicit public URL for this object (overrides R2_PUBLIC_URL_BASE).")
    parser.add_argument("--inactive", action="store_true", help="Register the row but leave is_active=false.")
    args = parser.parse_args()

    if args.check:
        _check()
        return
    if not args.symptom_id or not args.video_path:
        parser.error("symptom_id and video_path are required (or pass --check).")
    _upload(args)


if __name__ == "__main__":
    main()
