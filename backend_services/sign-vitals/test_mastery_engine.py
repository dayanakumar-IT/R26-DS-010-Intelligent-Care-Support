"""
test_mastery_engine.py
GLOSS component — Phase 5c scenario-based verification of
mastery_engine.update_mastery() against the real database.

Runs a fixed sequence of synthetic attempts for one (caregiver, sign)
pair, printing and asserting the resulting row state after each step.
Deletes any pre-existing row for this pair first, and deletes the row
again at the end — this is scratch verification data, not real
caregiver progress.
"""

import os

from dotenv import load_dotenv
from supabase import create_client

from mastery_engine import update_mastery

load_dotenv(".env")

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

CAREGIVER_PROFILE_ID = "717ef2f3-17dd-4dbc-aa09-c7ff60cfe625"
SIGN_ID = "tea"


def delete_test_row():
    supabase.table("gloss_caregiver_mastery").delete().eq(
        "caregiver_profile_id", CAREGIVER_PROFILE_ID
    ).eq("sign_id", SIGN_ID).execute()


def show(step_name, row):
    print(f"\n--- {step_name} ---")
    print(f"attempts={row['attempts']} "
          f"streak={row['consecutive_strong_streak']} "
          f"status={row['mastery_status']} "
          f"mismatch_count={row['recognition_mismatch_count']} "
          f"has_verified_strong_execution={row['has_verified_strong_execution']} "
          f"best_score={row['best_score']} last_score={row['last_score']}")
    return row


def check(label, row, **expected):
    for key, expected_value in expected.items():
        actual_value = row[key]
        assert actual_value == expected_value, (
            f"MISMATCH at {label}: expected {key}={expected_value!r}, got {actual_value!r}\n"
            f"Full row: {row}"
        )
    print(f"    [OK] {label}: " + ", ".join(f"{k}={v!r}" for k, v in expected.items()))


print(f"=== Phase 5c scenario verification (caregiver={CAREGIVER_PROFILE_ID}, sign={SIGN_ID}) ===")

print("\n[cleanup] deleting any pre-existing test row...")
delete_test_row()

# --- Scenario 1: first-ever attempt, webcam, correct, tier="weak" ---
row = update_mastery(
    supabase, CAREGIVER_PROFILE_ID, SIGN_ID,
    attempt_type="webcam", is_correct_sign=True, quality_tier="weak", execution_score=0.35,
)
show("Scenario 1: webcam correct, tier=weak (1st)", row)
check("Scenario 1", row, attempts=1, consecutive_strong_streak=0, mastery_status="learning")

# --- Scenario 2: webcam, correct, tier="weak" again ---
row = update_mastery(
    supabase, CAREGIVER_PROFILE_ID, SIGN_ID,
    attempt_type="webcam", is_correct_sign=True, quality_tier="weak", execution_score=0.40,
)
show("Scenario 2: webcam correct, tier=weak (2nd)", row)
check("Scenario 2", row, attempts=2, consecutive_strong_streak=0, mastery_status="learning")

# --- Scenario 3: webcam, wrong sign ---
row = update_mastery(
    supabase, CAREGIVER_PROFILE_ID, SIGN_ID,
    attempt_type="webcam", is_correct_sign=False,
)
show("Scenario 3: webcam wrong sign", row)
check(
    "Scenario 3", row,
    attempts=3, consecutive_strong_streak=0, recognition_mismatch_count=1, mastery_status="weak",
)

# --- Scenario 4: webcam, correct, tier="strong" x5 in a row ---
expected_streaks = [1, 2, 3, 4, 5]
expected_statuses = ["learning", "improving", "improving", "improving", "mastered"]
for n, (exp_streak, exp_status) in enumerate(zip(expected_streaks, expected_statuses), start=1):
    row = update_mastery(
        supabase, CAREGIVER_PROFILE_ID, SIGN_ID,
        attempt_type="webcam", is_correct_sign=True, quality_tier="strong", execution_score=0.9,
    )
    show(f"Scenario 4.{n}: webcam correct, tier=strong (streak {exp_streak})", row)
    check(
        f"Scenario 4.{n}", row,
        consecutive_strong_streak=exp_streak,
        has_verified_strong_execution=True,
        mastery_status=exp_status,
    )

# --- Scenario 5: multiple_choice, wrong ---
row = update_mastery(
    supabase, CAREGIVER_PROFILE_ID, SIGN_ID,
    attempt_type="multiple_choice", is_correct_sign=False,
)
show("Scenario 5: multiple_choice wrong (after mastered streak)", row)
check(
    "Scenario 5", row,
    consecutive_strong_streak=0,
    has_verified_strong_execution=True,
)
assert row["mastery_status"] != "mastered", (
    f"MISMATCH at Scenario 5: status should NOT be 'mastered' (streak reset to 0), got {row['mastery_status']!r}"
)
print(f"    [OK] Scenario 5: mastery_status={row['mastery_status']!r} (not 'mastered', as expected)")

# --- Scenario 6: multiple_choice, correct x5 ---
expected_streaks = [1, 2, 3, 4, 5]
expected_statuses = ["learning", "improving", "improving", "improving", "mastered"]
for n, (exp_streak, exp_status) in enumerate(zip(expected_streaks, expected_statuses), start=1):
    row = update_mastery(
        supabase, CAREGIVER_PROFILE_ID, SIGN_ID,
        attempt_type="multiple_choice", is_correct_sign=True,
    )
    show(f"Scenario 6.{n}: multiple_choice correct (streak {exp_streak})", row)
    check(
        f"Scenario 6.{n}", row,
        consecutive_strong_streak=exp_streak,
        has_verified_strong_execution=True,
        mastery_status=exp_status,
    )

print("\n=== ALL SCENARIOS PASSED ===")

print("\n[cleanup] deleting scratch test row for sign_id='tea'...")
delete_test_row()
print("done.")
