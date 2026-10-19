"""
diagnose_attempt_stability.py
GLOSS component — diagnostic tool (Task 6 + Task 7). NOT part of the app.

Feeds the SAME video through POST /gloss/attempts/recognize several
times and reports, per run:
  - predicted sign + confidence + top-3
  - raw frame count, fully-undetected frames, missing-landmark fraction
  - client-observed round-trip time

Then summarises how much the prediction / confidence / landmark quality
vary across identical inputs (extraction determinism check) and, if you
pass several DIFFERENT recordings of the same intended sign, how much
they vary across real captures (Task 7 capture-variability check).

This calls ONLY the internal recognize utility — it never writes
attempts, never touches mastery, and changes nothing about the model.

Usage:
  # extraction determinism — same file, 5 runs
  python scripts/diagnose_attempt_stability.py --runs 5 eat ./clip_eat_1.webm

  # capture variability — 3 real recordings of "eat"
  python scripts/diagnose_attempt_stability.py eat ./eat_a.webm ./eat_b.webm ./eat_c.webm

  # point at a non-default backend
  BASE_URL=http://localhost:8003 python scripts/diagnose_attempt_stability.py eat ./eat.webm

Full end-to-end stage timings for the REAL pipeline (upload -> extract ->
preprocess -> TCN -> DTW -> Supabase -> next-lesson) are emitted by the
backend itself: every POST /gloss/attempts response now carries a
`timings` object, and the server logs `attempt timings (ms): {...}`.
"""

import argparse
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8003").rstrip("/")


def _post_recognize(video_path: str) -> tuple[dict, float]:
    boundary = uuid.uuid4().hex
    with open(video_path, "rb") as fh:
        payload = fh.read()
    filename = os.path.basename(video_path)
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="video"; filename="{filename}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + payload + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{BASE_URL}/gloss/attempts/recognize",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=300) as resp:
        import json

        data = json.loads(resp.read())
    return data, (time.perf_counter() - t0) * 1000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("target_sign_id")
    parser.add_argument("videos", nargs="+", help="One or more attempt clips of the target sign.")
    parser.add_argument("--runs", type=int, default=1, help="Repeat each video N times (determinism check).")
    args = parser.parse_args()

    for v in args.videos:
        if not os.path.isfile(v):
            print(f"File not found: {v}")
            sys.exit(1)

    rows = []
    for video in args.videos:
        for run in range(args.runs):
            try:
                data, rtt_ms = _post_recognize(video)
            except urllib.error.HTTPError as e:
                print(f"  {os.path.basename(video)} run {run + 1}: HTTP {e.code} {e.read().decode()[:200]}")
                continue
            diag = data.get("diagnostics", {})
            rows.append(
                {
                    "video": os.path.basename(video),
                    "run": run + 1,
                    "predicted": data["predicted_sign"],
                    "confidence": data["confidence"],
                    "correct": data["predicted_sign"] == args.target_sign_id,
                    "frames": diag.get("raw_frame_count"),
                    "undetected": diag.get("fully_undetected_frames"),
                    "missing_frac": diag.get("missing_landmark_fraction"),
                    "top3": diag.get("top3", []),
                    "rtt_ms": rtt_ms,
                }
            )
            top3 = " | ".join(f"{t['sign_id']}:{t['confidence']:.3f}" for t in diag.get("top3", []))
            flag = "OK " if rows[-1]["correct"] else "MISS"
            print(
                f"  [{flag}] {rows[-1]['video']:24s} run {run + 1}: "
                f"{data['predicted_sign']:12s} conf={data['confidence']:.3f}  "
                f"frames={diag.get('raw_frame_count')} undetected={diag.get('fully_undetected_frames')} "
                f"missing={diag.get('missing_landmark_fraction')}  rtt={rtt_ms:.0f}ms\n"
                f"         top3: {top3}"
            )

    if not rows:
        return

    print("\n--- summary ---")
    preds = {r["predicted"] for r in rows}
    print(f"distinct predictions across {len(rows)} run(s): {sorted(preds)}")
    print(f"accuracy vs target '{args.target_sign_id}': {sum(r['correct'] for r in rows)}/{len(rows)}")
    confs = [r["confidence"] for r in rows]
    print(f"confidence: min {min(confs):.3f}  max {max(confs):.3f}  "
          f"stdev {statistics.pstdev(confs):.4f}")
    fr = [r["frames"] for r in rows if r["frames"] is not None]
    if fr:
        print(f"raw frame count: min {min(fr)}  max {max(fr)}")
    mf = [r["missing_frac"] for r in rows if r["missing_frac"] is not None]
    if mf:
        print(f"missing-landmark fraction: min {min(mf):.4f}  max {max(mf):.4f}")
    rtts = [r["rtt_ms"] for r in rows]
    print(f"client round-trip: min {min(rtts):.0f}ms  max {max(rtts):.0f}ms  mean {statistics.mean(rtts):.0f}ms")


if __name__ == "__main__":
    main()