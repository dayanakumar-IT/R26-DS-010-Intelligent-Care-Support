"""
scripts/measure_attempt_timings.py
GLOSS component — speed brief Step 1 (measuring only). NOT part of the app.

Sends N webcam attempts through the real POST /gloss/attempts handler
(in-process, FastAPI TestClient) and reports the median and max time of
every stage: upload, auth, MediaPipe (process start / imports / model
load / frames / exit), preprocessing, features, inference, DTW, feedback
+ Gemini, each Supabase call, total.

Nothing is written to the database:
  - reads (sign check, mastery, next lesson) go to the real Supabase;
  - writes (session insert, attempt insert, mastery upsert) are replaced
    by a same-table read round trip of the same kind (timed, nothing
    stored) — so write timings are an estimate;
  - login: no test account exists, so the real auth round trip is made
    with a dummy token (Supabase rejects it after the same network trip)
    and the caregiver lookup is the real query for --caregiver.

Usage (.venv):
  python scripts/measure_attempt_timings.py --caregiver <profile_id> \
      --runs 10 eat:test_samples/eat.mp4 pain:test_samples/pain.mp4
"""

import argparse
import json
import os
import statistics
import sys
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)
os.environ["GLOSS_TIMING_DETAIL"] = "1"  # before main imports grading

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


class _Result:
    def __init__(self, data):
        self.data = data


class _DryWrite:
    """insert/upsert stand-in: one real read round trip, nothing stored."""

    def __init__(self, client, table, row):
        self._client, self._table, self._row = client, table, row

    def execute(self):
        self._client.table(self._table).select("*").limit(1).execute()
        return _Result([{"id": str(uuid.uuid4()), **self._row}])


class _DryTable:
    def __init__(self, client, name):
        self._client, self._name = client, name
        self._inner = client.table(name)

    def insert(self, row, *args, **kwargs):
        return _DryWrite(self._client, self._name, row)

    def upsert(self, row, *args, **kwargs):
        return _DryWrite(self._client, self._name, row)

    def __getattr__(self, name):
        return getattr(self._inner, name)


class DryRunDb:
    def __init__(self, client):
        self._client = client

    def table(self, name):
        return _DryTable(self._client, name)

    def __getattr__(self, name):
        return getattr(self._client, name)


def _fake_auth_factory(caregiver_profile_id):
    def auth(db, authorization, context="GLOSS"):
        try:
            db.auth.get_user("not-a-real-token")  # same network trip, rejected
        except Exception:
            pass
        db.table("gloss_caregiver_accounts").select("caregiver_profile_id").eq(
            "caregiver_profile_id", caregiver_profile_id).limit(1).execute()
        return caregiver_profile_id
    return auth


def _flatten(t: dict) -> dict:
    """One flat {stage: ms} row from a response's timings."""
    row = {k: v for k, v in t.items() if isinstance(v, (int, float))}
    for k, v in (t.get("extraction_detail") or {}).items():
        if k != "frames":
            row[f"mediapipe.{k}"] = v
    for k, v in (t.get("grading_detail") or {}).items():
        row[f"grading.{k}"] = v
    for c in t.get("supabase_calls") or []:
        key = f"supabase.{c['call']}"
        row[key] = round(row.get(key, 0.0) + c["ms"], 1)
    return row


def main_cli():
    ap = argparse.ArgumentParser()
    ap.add_argument("--caregiver", required=True)
    ap.add_argument("--runs", type=int, default=10)
    ap.add_argument("--out", default=None, help="write per-attempt JSON here")
    ap.add_argument("clips", nargs="+", help="sign:path pairs, used in turn")
    args = ap.parse_args()
    clips = [c.split(":", 1) for c in args.clips]

    rows, raw = [], []
    with TestClient(main.app) as client:
        real = main._db()
        main._db = lambda: DryRunDb(real)
        main.get_authenticated_caregiver = _fake_auth_factory(args.caregiver)
        for i in range(args.runs):
            sign, path = clips[i % len(clips)]
            with open(path, "rb") as fh:
                resp = client.post(
                    "/gloss/attempts",
                    data={"target_sign_id": sign, "attempt_type": "webcam"},
                    files={"video": (os.path.basename(path), fh, "video/mp4")},
                    headers={"Authorization": "Bearer measuring"},
                )
            body = resp.json()
            if resp.status_code != 200:
                print(f"run {i + 1}: HTTP {resp.status_code} {body}")
                continue
            t = body["timings"]
            raw.append({"run": i + 1, "sign": sign, "outcome": body.get("outcome"),
                        "frames": (t.get("extraction_detail") or {}).get("frames"), "timings": t})
            rows.append(_flatten(t))
            print(f"run {i + 1:2d} {sign:5s} outcome={body.get('outcome'):<14} "
                  f"request_total={t.get('request_total_ms')} ms")

    if args.out:
        with open(args.out, "w") as f:
            json.dump(raw, f, indent=1)

    keys = sorted({k for r in rows for k in r}, key=lambda k: -statistics.median([r.get(k, 0) for r in rows]))
    total = statistics.median([r["request_total_ms"] for r in rows])
    print(f"\n{'stage':48s} {'median':>9s} {'max':>9s} {'% of total':>10s}")
    for k in keys:
        vals = [r[k] for r in rows if k in r]
        med = statistics.median(vals)
        print(f"{k:48s} {med:9.1f} {max(vals):9.1f} {100 * med / total:9.0f}%")


if __name__ == "__main__":
    main_cli()
