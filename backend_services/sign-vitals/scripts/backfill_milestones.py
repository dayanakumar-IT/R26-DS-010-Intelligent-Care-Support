"""
scripts/backfill_milestones.py
GLOSS component — recomputes every caregiver's milestones from their
existing gloss_attempts (progress_rules.compute_milestones, the same rules
the live path uses) and stores the missing ones. Re-runnable: milestones
already stored are left as they are (unique per caregiver, type, key), so
running it twice changes nothing. Nothing is ever invented: each milestone
carries the attempt ids that earned it and the time it was earned.

Dry run (default) prints what each caregiver has earned; --write stores it.
Before migration 0045 is applied, the version and mode of old attempts are
derived exactly as 0045 sets them (cut-off 2026-10-09 20:13 UTC; practice).

Usage (.venv):
  python scripts/backfill_milestones.py [--write] [--caregiver <caregiver_profile_id>]
"""

import argparse
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

import sign_config as cfg  # noqa: E402
from progress_rules import compute_milestones  # noqa: E402
from progress_summary import ATTEMPT_COLUMNS  # noqa: E402

CUTOFF = "2026-10-09T20:13:00+00:00"   # migration 0045


def load_attempts(db, cg: str) -> tuple[list[dict], bool]:
    """(attempts, migrated). Pre-0045: derive mode / pipeline_version."""
    try:
        rows = db.table("gloss_attempts").select(ATTEMPT_COLUMNS).eq("caregiver_profile_id", cg).order("attempted_at").execute().data
        return rows, True
    except Exception:
        rows = (db.table("gloss_attempts")
                .select("id, target_sign_id, recognized_sign_id, quality_tier, attempt_type, attempted_at")
                .eq("caregiver_profile_id", cg).order("attempted_at").execute().data)
        for r in rows:
            r["mode"] = "practice"
            r["pipeline_version"] = cfg.PIPELINE_VERSION if r["attempted_at"] >= CUTOFF else cfg.LEGACY_PIPELINE
        return rows, False


def load_timezone(db, cg: str) -> str:
    try:
        rows = db.table("gloss_caregiver_accounts").select("timezone").eq("caregiver_profile_id", cg).execute().data
        return (rows[0].get("timezone") if rows else None) or cfg.DEFAULT_TIMEZONE
    except Exception:
        return cfg.DEFAULT_TIMEZONE


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="store the milestones (default: dry run)")
    ap.add_argument("--caregiver", help="only this caregiver_profile_id")
    args = ap.parse_args()

    load_dotenv(".env")
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    accounts = db.table("gloss_caregiver_accounts").select("caregiver_profile_id").execute().data
    caregivers = [a["caregiver_profile_id"] for a in accounts if not args.caregiver or a["caregiver_profile_id"] == args.caregiver]

    for cg in caregivers:
        attempts, migrated = load_attempts(db, cg)
        tz = load_timezone(db, cg)
        earned = compute_milestones(attempts, tz)
        versions = Counter(a["pipeline_version"] for a in attempts)
        print(f"\ncaregiver {cg[:8]}: {len(attempts)} attempts {dict(versions)} | tz {tz} | "
              f"{'migrated' if migrated else 'NOT migrated (derived as 0045 would)'}")
        for m in earned:
            print(f"  {m['type']:<12} {m['key']:<18} {m['achieved_at'].astimezone().strftime('%Y-%m-%d %H:%M')}  "
                  f"evidence: {len(m['evidence'])} attempt(s)")
        if not earned:
            print("  (nothing earned yet)")
        if args.write:
            if not migrated:
                sys.exit("Apply migrations 0045-0047 first.")
            rows = [{"caregiver_profile_id": cg, "type": m["type"], "key": m["key"],
                     "achieved_at": m["achieved_at"].isoformat(), "evidence": m["evidence"]} for m in earned]
            if rows:
                db.table("gloss_milestones").upsert(rows, on_conflict="caregiver_profile_id,type,key",
                                                    ignore_duplicates=True).execute()
            print(f"  stored (existing ones kept): {len(rows)}")


if __name__ == "__main__":
    main()
