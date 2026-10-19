"""
scripts/create_test_supervisor.py
Sign & Vitals — a clearly labelled TEST supervisor login for checking the
supervisor screens and supervisor learning without touching the real
supervisors' accounts or progress:

  auth user  gloss.test.supervisor@example.com   (example.com: never a real inbox)
  profiles   name "GLOSS TEST supervisor", role supervisor, ward "TEST"

A supervisor can read every caregiver's learning (and has the supervisor
role in the other CareSense components), so DELETE it after testing:

  python scripts/create_test_supervisor.py            # create (password -> .env)
  python scripts/create_test_supervisor.py --delete   # remove the login and its own learning rows

The password is written only to the gitignored .env and never printed.
"""

import os
import secrets
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

from db_client import make_client  # noqa: E402

EMAIL = "gloss.test.supervisor@example.com"
NAME = "GLOSS TEST supervisor"


def main() -> int:
    load_dotenv(".env")
    db = make_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    prof = db.table("profiles").select("id").eq("email", EMAIL).execute().data

    if "--delete" in sys.argv:
        if not prof:
            print("nothing to delete")
            return 0
        uid = prof[0]["id"]
        # gloss_learners -> its learning rows cascade; profiles cascade from auth.users.
        db.table("gloss_learners").delete().eq("user_id", uid).execute()
        db.auth.admin.delete_user(uid)
        print(f"deleted {NAME} (login, profile, learner row and its learning rows)")
        return 0

    if prof:
        print(f"{NAME} already exists (password in .env)")
        return 0
    password = secrets.token_urlsafe(18)
    user = db.auth.admin.create_user({"email": EMAIL, "password": password, "email_confirm": True,
                                      "user_metadata": {"name": NAME, "purpose": "Sign & Vitals testing"}})
    db.table("profiles").insert({"id": user.user.id, "email": EMAIL, "name": NAME, "role": "supervisor",
                                 "ward": "TEST"}).execute()
    with open(".env", "a", encoding="utf-8") as f:
        f.write(f"\n# GLOSS TEST supervisor login (scripts/create_test_supervisor.py; delete after testing)\n"
                f"GLOSS_TEST_SUPERVISOR_EMAIL={EMAIL}\nGLOSS_TEST_SUPERVISOR_PASSWORD={password}\n")
    print(f"created {NAME}: login {EMAIL} (password saved to .env)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
