# Sign & Vitals — setup on a new Windows computer

Sign & Vitals = **GLOSS** (sign language practice with camera checking) and
**Parkinson's symptom education**. This guide sets up the backend (FastAPI,
port 8009) and the CareSense frontend (Vite, port 5173) from a fresh clone.
Commands are for **PowerShell**, run from the repository root unless a step
says otherwise.

Everything needed at runtime is in the repository or in Supabase / R2:

| What | Where |
|---|---|
| Recognition model, feature scaler, class names, class thresholds, DTW references, parity fixtures | `backend_services/sign-vitals/gloss_assets/` (fingerprinted by `manifest.json`, checked at start-up) |
| MediaPipe models (Holistic, model_complexity 1) | installed with `mediapipe==0.10.14` in `.venv_mediapipe` |
| 3D Signer motion files (63 signs) | `frontend/src/modules/sign-vitals/assets/motion/` |
| Browser hand guide (MediaPipe tasks-vision 0.10.14 wasm + hand model) | `frontend/src/modules/sign-vitals/assets/mediapipe/` |
| 2D Sign Guide reference frames | Supabase table `gloss_sign_references` |
| Reference Video tab, Parkinson's videos | Cloudflare R2 (files) + Supabase tables `gloss_sign_demo_videos`, `pdedu_symptom_demo_videos` (metadata); served as short-lived presigned links |
| Learning data, progress, badges | Supabase (`gloss_*`, `pdedu_*` tables) |

No file in the repository is over 100 MB (the largest is ~3 MB). Do **not**
commit `backend_services/sign-vitals.zip`, `models.zip` or
`gloss_assets_new/` (local backups).

## 1. Install once

- **Git**
- **Python 3.11 (64-bit)** from python.org — tick "Add python.exe to PATH".
  Both environments use 3.11 (MediaPipe 0.10.14 needs Python ≤ 3.12).
  Check: `py -3.11 --version`
- **Node.js 22 LTS** (includes npm). Check: `node --version`
- **Chrome or Edge** (camera practice).

## 2. Get the code

```powershell
git clone <repository-url> R26-DS-010-Intelligent-Care-Support
cd R26-DS-010-Intelligent-Care-Support
git checkout GLOSS-02
```

## 3. Backend: two Python environments

The backend runs in `.venv` (TensorFlow, FastAPI, grading). Landmark
extraction runs in a separate `.venv_mediapipe` (MediaPipe 0.10.14, the
version the model was trained with), started by the backend as one
long-running worker. Both folders must be inside `backend_services\sign-vitals`.

```powershell
cd backend_services\sign-vitals

py -3.11 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements.txt

py -3.11 -m venv .venv_mediapipe
.venv_mediapipe\Scripts\python -m pip install --upgrade pip
.venv_mediapipe\Scripts\python -m pip install -r requirements-mediapipe.txt
```

Both requirement files are pinned to the versions this was tested with.

## 4. Backend settings

```powershell
copy .env.example .env
notepad .env
```

Fill in at least `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase
dashboard → Project Settings → API). `GEMINI_API_KEY` and the `R2_*` keys are
optional (see the comments in `.env.example`). Never commit `.env`.

## 5. Database (Supabase)

All migrations are in `supabase/migrations/`. On the shared CareSense project
they are applied up to **0050**: **0049** (`gloss_learners`, supervisor
learning) and **0050** (supervisors read Parkinson's education progress).
**0051** (`is_test` flag, so test logins are left out of Team learning) is
applied by the component owner. Each runs in one transaction; undo scripts
are in `backend_services/sign-vitals/db_undo/`. On a new Supabase project,
run every file in order in the SQL editor (back up first on an existing one).

Optional — a clearly labelled test login, so testing never touches real
caregivers (writes its password only to `.env`; after 0051 it also marks the
login as a test account):

```powershell
.venv\Scripts\python scripts\create_test_caregiver.py
```

For checking the supervisor screens, a temporary test supervisor (it can read
every caregiver's learning, so delete it afterwards):

```powershell
.venv\Scripts\python scripts\create_test_supervisor.py
.venv\Scripts\python scripts\create_test_supervisor.py --delete
```

## 6. Start the backend

```powershell
cd backend_services\sign-vitals
.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8009
```

Wait for `backend ready for inference`, `long-running worker started | ... |
unthrottled=True` and `warm-up done | mediapipe_worker=ready` in the log
(about 10–20 s). `unthrottled=True` means Windows will not slow the backend
down while the browser is in front. Check: open http://127.0.0.1:8009/health — every
entry should say `"loaded": true`. (`--reload` is fine while editing code.)

## 7. Frontend

In a **second** PowerShell window:

```powershell
cd frontend
npm ci
```

Create `frontend\.env`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_SIGNVITALS_API_URL=http://127.0.0.1:8009
```

(The anon key is the public one — never the service role key.) Then:

```powershell
npm run dev
```

Open http://localhost:5173, sign in, go to **Sign & Vitals → GLOSS Sign
Language Learning → Practice This Sign**, allow the camera, record, submit.
The first attempt after start-up takes a few seconds longer.

## 8. Tests

From `backend_services\sign-vitals` (backend not required to be running):

```powershell
# Recognition parity — both must print 10/10, identical to the notebook
.venv\Scripts\python tests\test_parity.py
.venv\Scripts\python tests\test_pipeline_parity.py

# Everything else (no network)
foreach ($t in "test_persistent_worker","test_progress_rules","test_attempt_modes","test_session_recovery",
               "test_not_recommended","test_supervisor","test_attempt_errors","test_win_perf","test_capture_gates",
               "test_execution_score","test_feedback_hands","test_learner_model") { .venv\Scripts\python "tests\$t.py" }

# Row-level security on the real migration files (in-memory Postgres, never the live database)
cd tests\rls
npm install
npm test
```

`test_persistent_worker` compares the long-running MediaPipe worker with a
fresh process on real clips. Videos are never committed, so on a clean clone
it prints `SKIPPED`; put a few `.mp4` sign clips in `test_samples\` to run it.

Live end-to-end checks (GLOSS TEST caregiver only; backend running; a folder
with `water.mp4`, `pain.mp4`, `afternoon.mp4` and `please.mp4` sign clips):

```powershell
.venv\Scripts\python scripts\e2e_test_caregiver.py --api http://127.0.0.1:8009 --clips <folder>
```

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `Could not find the .venv_mediapipe Python interpreter` | Step 3: `.venv_mediapipe` must be inside `backend_services\sign-vitals`. |
| `/health` shows a fingerprint mismatch | A file in `gloss_assets/` changed (e.g. line endings). Re-checkout it: `git checkout -- gloss_assets`. |
| Attempts take much longer than ~5–8 s | Check the start-up log says `unthrottled=True` (Windows power throttling slows background processes 3–4x while the browser is in front). Close other heavy programs (MediaPipe is CPU-bound, ~50 ms per frame); keep the backend running between attempts (the worker loads once). |
| Reference Video says "not available" | R2 keys missing in `.env` (optional); the 2D guide and 3D Signer still work. |
| "This feature needs the GLOSS database migrations…" | Apply the migrations in step 5. |
| Camera hand guide missing (only a faint face oval) | The browser is too slow for the live hand guide or has no GPU; practice and grading are unaffected. |
