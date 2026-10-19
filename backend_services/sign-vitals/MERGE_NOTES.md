# Merge notes — GLOSS-02 → pp2_foundation (Sign & Vitals)

For the team leader merging the Sign & Vitals component (R26-DS-010,
Kaushalya). Setup on a new computer: see [README_SETUP.md](README_SETUP.md).

## What the module adds

**Sign & Vitals** = two learning modules for caregivers:

- **GLOSS sign language learning** — practise 59 care signs with the camera
  (recognition model + movement grading), Check my sign, Recall challenge,
  3D Signer / 2D guide / reference video, live hand guide on the camera,
  levels and badges from real camera attempts (My Journey), progress calendar
  with practice history, printable progress report.
- **Parkinson's symptom education** — symptom lessons and adaptive quizzes.
- **Supervisors** — a "Team learning" tab (all caregivers, sorted by name, no
  rankings) with a daily summary popup; supervisors can also learn with their
  own progress.

Folders:

| Folder | What |
|---|---|
| `backend_services/sign-vitals/` | FastAPI backend (port 8009), model and grading assets in `gloss_assets/`, tests in `tests/`, admin scripts in `scripts/`, undo scripts in `db_undo/` |
| `frontend/src/modules/sign-vitals/` | All screens (routes `/sign-vitals/...`), 3D motion files, browser hand-tracking files |
| `supabase/migrations/0045`–`0051` | GLOSS / Parkinson's education migrations (below) |

Everything the module needs at runtime is in the repository (model, scaler,
class names, thresholds, references, parity fixtures, 59 motion files,
MediaPipe hand model) or in Supabase / Cloudflare R2 (reference videos).

## Files changed outside the module

Only `frontend/package.json` and `frontend/package-lock.json`:

- `three` / `@types/three`: the duplicated entries in package.json were
  removed, keeping `three` 0.185.1 (needed by `@react-three/fiber` 9; confirmed
  with Dayana).
- `@mediapipe/tasks-vision` 0.10.14 added (the live hand guide on the camera
  preview; display only — its wasm and model are kept inside the module, no
  CDN).

`.gitignore` is unchanged.

## Database migrations 0045–0051

| Migration | What |
|---|---|
| 0045 | attempt `mode` (practice / recall / free), `pipeline_version`, caregiver time zone |
| 0046 | `gloss_milestones` + `gloss_record_attempt` (attempt, mastery and badges in one transaction) |
| 0047 | GLOSS writes backend-only; every supervisor can read all caregivers' GLOSS progress |
| 0048 | `gloss_sign_difficulty` view respects row-level security |
| 0049 | `gloss_learners` (so supervisors can learn) — no change to shared tables |
| 0050 | supervisors can read Parkinson's education progress |
| 0051 | `is_test` flag on GLOSS accounts (test logins hidden from Team learning) |

**Already applied** to our shared Supabase project. If pp2_foundation uses a
different Supabase project, apply them **in order** (SQL editor, one file at a
time; each runs in one transaction; back up first). Undo scripts for
0049–0051 are in `db_undo/`.

The shared function `public.is_supervisor()` (SCRIBE, 0013) is used, not
changed. `caregiver_profiles` and `profiles` are only referenced.

## Setup and settings

Follow [README_SETUP.md](README_SETUP.md) (Windows: two Python 3.11
environments with pinned requirements, `npm ci`, start commands, tests).

Settings — copy `backend_services/sign-vitals/.env.example` to `.env` and fill
in; **values are shared privately, never committed to GitHub**:

| Variable | Needed for |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | required (backend only) |
| `GEMINI_API_KEY` | optional — rewords feedback text |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT` | optional — Reference Video tab and Parkinson's videos |
| `GLOSS_TEST_CAREGIVER_EMAIL` / `_PASSWORD` | optional — test login for the end-to-end checks |
| `GLOSS_CORS_ORIGINS` | optional — if the frontend runs on a port other than 5173/5174 |

Frontend `frontend/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_SIGNVITALS_API_URL=http://127.0.0.1:8009`.

Checks: both parity tests must print 10/10 (`tests/test_parity.py`,
`tests/test_pipeline_parity.py`); see README_SETUP.md for the full test list.

## Known issues outside this module (already on the branch)

- **Typecheck** (`npx tsc --noEmit -p tsconfig.app.json`): 12 errors, all in
  `src/modules/fall-detection/pages/Overview.tsx` (unused variables, a type
  conversion).
- **Lint** (`npx eslint src`): 27 errors in
  `src/modules/fall-detection/pages/Overview.tsx` and 17 in 13
  `src/modules/voice-log/` files (mostly `react-hooks/set-state-in-effect`,
  plus `prefer-const` and `react-refresh/only-export-components`).

None of these files are touched by GLOSS-02; Sign & Vitals itself typechecks
and lints clean.

## Shared data: caregiver name mismatches

Two caregiver accounts have a login name (`profiles.name`) that differs from
their shared caregiver profile (`caregiver_profiles.display_name`). Sign &
Vitals shows the login name; other components may show the profile name:

| Caregiver profile id | Login name | Caregiver profile name |
|---|---|---|
| 171a59eb… | Harsha Wijesinghe | Kasun Ranatunga |
| 717ef2f3… | Vindya Ratnasekera | Nadeesha Wickramasinghe |

Nothing in the shared tables was changed — please align these with the
data owner.
