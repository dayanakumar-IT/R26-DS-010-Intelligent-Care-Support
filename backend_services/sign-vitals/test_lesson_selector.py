"""
test_lesson_selector.py
GLOSS component — Phase 6 verification of lesson_selector.select_next_lesson().

Test 1 (Branch 1, cold start): deterministic, exact-match — a caregiver
with zero gloss_caregiver_mastery rows should get the alphabetically-
first active sign (confirmed no sign meets the total_attempts>=5
threshold in gloss_sign_difficulty right now, so the fallback path is
what's actually exercised). Read-only, no cleanup needed.

Test 2 (Branch 2, weighted-random): statistical — build a KNOWN
synthetic mastery state across a handful of scratch sign_ids for the
Phase 5c test caregiver, run select_next_lesson() 500+ times, tally
results, and confirm the distribution is directionally consistent with
the weight table (needs_revision/weak chosen noticeably more often
than mastered). Only touches the specific scratch sign_ids this test
creates — the caregiver's pre-existing 'pain' row (from earlier
testing, not created by this script) is left untouched. Cleans up its
own rows afterward.
"""

import os
from collections import Counter

from dotenv import load_dotenv
from supabase import create_client

from lesson_selector import select_next_lesson, COLD_START_MIN_ATTEMPTS, STATUS_WEIGHTS

load_dotenv(".env")
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

TEST_CAREGIVER_ID = "717ef2f3-17dd-4dbc-aa09-c7ff60cfe625"
COLD_START_CAREGIVER_ID = "171a59eb-36ca-4a79-924d-2a1a5fc61a13"  # confirmed zero mastery rows

SYNTHETIC_ROWS = [
    {"sign_id": "danger", "mastery_status": "needs_revision"},
    {"sign_id": "confused", "mastery_status": "weak"},
    {"sign_id": "egg", "mastery_status": "new"},
    {"sign_id": "coffee", "mastery_status": "mastered"},
]

print("=== Phase 6 verification ===")

print("\n--- Test 1: Branch 1 (cold start), deterministic ---")

m = (
    supabase.table("gloss_caregiver_mastery")
    .select("id")
    .eq("caregiver_profile_id", COLD_START_CAREGIVER_ID)
    .limit(1)
    .execute()
)
assert not m.data, f"expected zero mastery rows for {COLD_START_CAREGIVER_ID}, found {m.data}"
print(f"confirmed: caregiver {COLD_START_CAREGIVER_ID} has zero gloss_caregiver_mastery rows")

diff = (
    supabase.table("gloss_sign_difficulty")
    .select("sign_id, total_attempts")
    .gte("total_attempts", COLD_START_MIN_ATTEMPTS)
    .execute()
)
print(f"signs with total_attempts >= {COLD_START_MIN_ATTEMPTS}: {diff.data}")
assert not diff.data, (
    f"expected no signs meeting the total_attempts>={COLD_START_MIN_ATTEMPTS} threshold yet, "
    f"found {diff.data} — the fallback-path assumption doesn't hold, re-check expected result"
)

first_active = supabase.table("gloss_signs").select("id").eq("is_active", True).order("id").limit(1).execute()
expected_sign = first_active.data[0]["id"]
print(f"alphabetically-first active sign: {expected_sign!r}")

result = select_next_lesson(supabase, COLD_START_CAREGIVER_ID)
print(f"select_next_lesson() returned: {result!r}")
assert result == expected_sign, f"MISMATCH: expected {expected_sign!r}, got {result!r}"
print(f"[OK] Test 1 passed: {result!r} == {expected_sign!r}")


print("\n--- Test 2: Branch 2 (weighted-random), statistical ---")

print("cleaning up any pre-existing rows for this test's scratch sign_ids...")
for row in SYNTHETIC_ROWS:
    supabase.table("gloss_caregiver_mastery").delete().eq(
        "caregiver_profile_id", TEST_CAREGIVER_ID
    ).eq("sign_id", row["sign_id"]).execute()

print("inserting known synthetic mastery state...")
for row in SYNTHETIC_ROWS:
    payload = {"caregiver_profile_id": TEST_CAREGIVER_ID, **row}
    supabase.table("gloss_caregiver_mastery").upsert(
        payload, on_conflict="caregiver_profile_id,sign_id"
    ).execute()
    print(f"  {row['sign_id']} -> {row['mastery_status']}")

active_signs = supabase.table("gloss_signs").select("id").eq("is_active", True).execute()
n_active = len(active_signs.data)
print(f"total active signs in pool: {n_active}")

N_ITERATIONS = 500
print(f"running select_next_lesson() {N_ITERATIONS} times against caregiver {TEST_CAREGIVER_ID}...")
tally = Counter()
for _ in range(N_ITERATIONS):
    chosen = select_next_lesson(supabase, TEST_CAREGIVER_ID)
    tally[chosen] += 1

print("\nfull tally (sign_id: count):")
for sign_id, count in tally.most_common():
    print(f"  {sign_id}: {count}")

needs_revision_count = tally.get("danger", 0)
weak_count = tally.get("confused", 0)
mastered_count = tally.get("coffee", 0)
new_explicit_count = tally.get("egg", 0)

print(f"\nneeds_revision ('danger'): {needs_revision_count}")
print(f"weak ('confused'): {weak_count}")
print(f"new, explicit row ('egg'): {new_explicit_count}")
print(f"mastered ('coffee'): {mastered_count}")

assert needs_revision_count > mastered_count, (
    f"MISMATCH: expected needs_revision ({needs_revision_count}) to beat "
    f"mastered ({mastered_count}) — weight table not reflected in distribution"
)
assert weak_count > mastered_count, (
    f"MISMATCH: expected weak ({weak_count}) to beat mastered ({mastered_count})"
)
print(
    f"[OK] Test 2 directional check passed: needs_revision ({needs_revision_count}) and "
    f"weak ({weak_count}) both chosen noticeably more than mastered ({mastered_count})"
)

expected_ratio_nr_vs_mastered = STATUS_WEIGHTS["needs_revision"] / STATUS_WEIGHTS["mastered"]
print(f"(weight table implies needs_revision should be sampled ~{expected_ratio_nr_vs_mastered:.1f}x "
      f"as often as mastered, per-candidate-sign, before pool-size effects)")

print("\ncleaning up synthetic test rows...")
for row in SYNTHETIC_ROWS:
    supabase.table("gloss_caregiver_mastery").delete().eq(
        "caregiver_profile_id", TEST_CAREGIVER_ID
    ).eq("sign_id", row["sign_id"]).execute()
print("done — pre-existing 'pain' row for this caregiver was left untouched.")

print("\n=== ALL PHASE 6 CHECKS PASSED ===")
