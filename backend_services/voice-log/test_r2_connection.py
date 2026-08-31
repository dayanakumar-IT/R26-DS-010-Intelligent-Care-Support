"""Quick connectivity check — run from backend_services/voice-log/ after pip install."""

from r2_storage import get_bucket_name, get_r2_client, list_objects


def main() -> None:
    client = get_r2_client()
    bucket = get_bucket_name()
    client.head_bucket(Bucket=bucket)
    print(f"Connected to R2 bucket: {bucket}")
    keys = list_objects()
    print(f"Objects under scribe/: {len(keys)}")
    for key in keys[:10]:
        print(f"  - {key}")
    if len(keys) > 10:
        print(f"  ... and {len(keys) - 10} more")


if __name__ == "__main__":
    main()
