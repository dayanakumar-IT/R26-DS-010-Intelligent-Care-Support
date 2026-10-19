"""
scripts/create_test_caregiver.py
GLOSS component — creates (once) a clearly labelled TEST caregiver login for
testing GLOSS without touching real caregivers' data:

  auth user   gloss.test.caregiver@example.com   (example.com: reserved, never a real inbox)
  profiles    name "GLOSS TEST caregiver", role caregiver
  participants  one 'demo' row (required by caregiver_profiles)
  caregiver_profiles  display_name "GLOSS TEST caregiver", ward "TEST", synthetic, no supervisor
  gloss_caregiver_accounts  link login -> caregiver profile, is_test = true (0051)

Idempotent: re-running reuses what exists. The password is written only to
the gitignored .env (GLOSS_TEST_CAREGIVER_EMAIL / _PASSWORD) and never printed.

Usage (.venv):  python scripts/create_test_caregiver.py
"""

import os
import secrets
import sys
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

EMAIL = "gloss.test.caregiver@example.com"
NAME = "GLOSS TEST caregiver"


def main():
    load_dotenv(".env")
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    created = []

    prof = db.table("profiles").select("id").eq("email", EMAIL).execute().data
    if prof:
        user_id = prof[0]["id"]
    else:
        password = secrets.token_urlsafe(18)
        user = db.auth.admin.create_user({"email": EMAIL, "password": password, "email_confirm": True,
                                          "user_metadata": {"name": NAME, "purpose": "GLOSS testing"}})
        user_id = user.user.id
        db.table("profiles").insert({"id": user_id, "email": EMAIL, "name": NAME, "role": "caregiver",
                                     "ward": "TEST"}).execute()
        with open(".env", "a", encoding="utf-8") as f:
            f.write(f"\n# GLOSS TEST caregiver login (scripts/create_test_caregiver.py)\n"
                    f"GLOSS_TEST_CAREGIVER_EMAIL={EMAIL}\nGLOSS_TEST_CAREGIVER_PASSWORD={password}\n")
        created.append("auth user + profile (password saved to .env)")

    acct = db.table("gloss_caregiver_accounts").select("caregiver_profile_id").eq("user_id", user_id).execute().data
    if acct:
        cp_id = acct[0]["caregiver_profile_id"]
    else:
        cp = db.table("caregiver_profiles").select("id").eq("display_name", NAME).execute().data
        if cp:
            cp_id = cp[0]["id"]
        else:
            participant_id = str(uuid.uuid4())
            db.table("participants").insert({"participant_id": participant_id, "split_group": "demo"}).execute()
            cp_id = db.table("caregiver_profiles").insert({
                "display_name": NAME, "ward": "TEST", "participant_id": participant_id,
                "data_mode": "replay", "is_synthetic": True,
            }).execute().data[0]["id"]
            created.append("participant + caregiver_profiles row")
        db.table("gloss_caregiver_accounts").insert({"user_id": user_id, "caregiver_profile_id": cp_id}).execute()
        created.append("gloss_caregiver_accounts link")

    # Mark it as a test account (migration 0051) so supervisors' Team learning
    # leaves it out. By its login id, never by name. Safe to re-run.
    try:
        db.table("gloss_caregiver_accounts").update({"is_test": True}).eq("user_id", user_id).execute()
        created.append("is_test flag set")
    except Exception:
        print("note: is_test not set (apply migration 0051, then run this script again)")

    print(f"{NAME}: login {EMAIL} | user {user_id} | caregiver_profile_id {cp_id}")
    print("created: " + (", ".join(created) if created else "nothing (already existed)"))


if __name__ == "__main__":
    sys.exit(main())
