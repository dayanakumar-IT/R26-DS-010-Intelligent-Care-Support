"""
load_reference_exemplars.py
GLOSS component — one-time data load, not part of the running app.

Reads reference_exemplars.npz (59 keys, one per sign, each a numpy
array of shape (frames, 147)) and upserts one row per sign into the
gloss_sign_references table.

Run this once after the 0025_gloss_sign_references.sql migration has
been pushed. Safe to re-run — it upserts on sign_id, so re-running
just overwrites the same 59 rows rather than duplicating them.

Requires in your .env (never commit this file's actual values):
  SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...   (service role, not anon — this
                                    script needs to bypass RLS to write)

Usage:
  python load_reference_exemplars.py /path/to/reference_exemplars.npz
"""

import sys
import os
import numpy as np
from dotenv import load_dotenv
from supabase import create_client

def main():
    if len(sys.argv) != 2:
        print("Usage: python load_reference_exemplars.py /path/to/reference_exemplars.npz")
        sys.exit(1)

    npz_path = sys.argv[1]
    if not os.path.exists(npz_path):
        print(f"File not found: {npz_path}")
        sys.exit(1)

    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env")
        sys.exit(1)

    supabase = create_client(url, key)

    print(f"Loading {npz_path} ...")
    data = np.load(npz_path, allow_pickle=True)
    sign_ids = list(data.files)
    print(f"Found {len(sign_ids)} signs.")

    rows = []
    for sign_id in sign_ids:
        arr = data[sign_id]
        if arr.ndim != 2 or arr.shape[1] != 147:
            print(f"  WARNING: '{sign_id}' has unexpected shape {arr.shape}, skipping.")
            continue
        rows.append({
            "sign_id": sign_id,
            "frame_count": int(arr.shape[0]),
            "landmark_sequence": arr.tolist(),
        })

    print(f"Prepared {len(rows)} rows. Upserting into gloss_sign_references ...")

    result = supabase.table("gloss_sign_references").upsert(rows).execute()
    inserted = len(result.data) if result.data else 0

    print(f"Done: {inserted}/{len(sign_ids)} rows upserted.")

    if inserted != len(sign_ids):
        print("WARNING: row count mismatch — check the output above for skipped signs "
              "or check the Supabase dashboard for errors.")

if __name__ == "__main__":
    main()
