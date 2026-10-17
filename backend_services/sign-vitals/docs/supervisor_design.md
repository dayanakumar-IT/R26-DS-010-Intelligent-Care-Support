# Sign & Vitals — supervisor view and supervisor learning (design, not built)

Status: **checkpoint — waiting for approval before any migration is written.**
Replaces the "planned screens" part of `supervisor_monitoring_plan.md`; its
principles still hold (recognition not surveillance, no rankings, no streak
alerts, no video).

## 1. What supervisors get

Everything lives inside the Sign & Vitals module (`/sign-vitals` Overview
page), shown only when the server says the user is a supervisor. No change to
the shared router or navigation.

### Team learning (all caregivers, both supervisors)

Caregiver list, sorted by name (never by score):

| Column | Source |
|---|---|
| Name, ID (short id) | `caregiver_profiles.display_name`, `id` — caregivers that have a GLOSS account |
| Demonstrated / Retained (of 55 countable), signs practised | same definition as `/gloss/progress/summary` |
| Pace | Demonstrated per week, last 4 weeks (Mon–Sun, Asia/Colombo), e.g. `0 · 1 · 2 · 1`, plus a neutral trend word: "more / about the same / fewer than the 2 weeks before" |
| Active days | this week (x of 7) and overall (distinct days with a counted attempt) |
| Last active | date of the latest counted attempt |
| Parkinson's education | quizzes completed, questions answered, symptoms mastered (score ≥ 80) of all symptoms, average mastery |

Selecting a caregiver opens their detail: the numbers above, their level and
categories, and **their progress report** (the same printable report the
caregiver sees, which already says "Your supervisors can see this report").

### Popup on opening

Once per day per supervisor (dismissible), one neutral line per caregiver,
alphabetical:

- "Harsha: 4 active days this week, 1 new sign demonstrated"
- "Nadeesha: 2 active days this week"
- "Kasun: no practice yet this week"

No rankings, no colours for good/bad, no streak warnings, no failed attempts,
no video (none is ever stored).

### Supervisors can also learn

A supervisor without a learner profile sees "Start learning" on the Overview.
It creates their learner profile (server-side, role checked). From then on
Sign practice, Check my sign, Recall, My Journey, Progress and Parkinson's
education work exactly as for a caregiver, with their own progress. Their own
learning is **not** listed in Team learning.

## 2. The learner profile — smallest safe schema change

### Why not a `caregiver_profiles` row

`caregiver_profiles` is shared and is **listed by other components**
(deterioration-detection, fall-detection, voice-log all `select` from it). A
supervisor row there would appear as a caregiver in their dashboards. It also
needs a TILES `participant_id` (NOT NULL, unique). So: no change to
`caregiver_profiles`, `participants` or `profiles`.

### Proposal: a GLOSS-owned parent table `gloss_learners`

Every GLOSS and pdedu learning table keeps its `caregiver_profile_id` column
(name unchanged, so no code churn), but its foreign key points to
`gloss_learners(id)` instead of `caregiver_profiles(id)`.

```sql
create table gloss_learners (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('caregiver', 'supervisor')),
  caregiver_profile_id uuid unique references caregiver_profiles(id) on delete cascade,
  user_id              uuid unique references profiles(id) on delete cascade,
  display_name         text not null,
  created_at           timestamptz not null default now(),
  check (
    (kind = 'caregiver'  and caregiver_profile_id = id) or
    (kind = 'supervisor' and caregiver_profile_id is null and user_id is not null)
  )
);
```

- A caregiver's learner id **is** their `caregiver_profile_id` (same uuid), so
  every existing row stays valid and every existing query keeps working.
- Deleting a caregiver still cascades: `caregiver_profiles` → `gloss_learners`
  → all their GLOSS / pdedu rows (as today).
- A supervisor's learner row has its own id and `user_id` = their login.
- Caregiver learner rows are created by a trigger on `gloss_caregiver_accounts`
  insert (a GLOSS table) plus a one-off backfill of every caregiver id already
  used. Supervisor rows are created only by the backend (service role) after a
  server-side role check.

## 3. Planned migrations

### 0049_gloss_learners.sql

1. Create `gloss_learners` (above) + RLS: a learner reads their own row;
   supervisors read all (`public.is_supervisor()`); admins manage all; no
   insert/update for `authenticated` (backend writes only).
2. Backfill caregiver rows for every caregiver id in `gloss_caregiver_accounts`
   and in the eight tables below; trigger on `gloss_caregiver_accounts` insert.
3. Helper `public.gloss_is_own_learner(learner uuid)` (security definer):
   true if the caller is linked through `gloss_caregiver_accounts` **or** owns
   the supervisor learner row.
4. Swap the foreign key (same column, same `on delete cascade`) from
   `caregiver_profiles(id)` to `gloss_learners(id)` on:
   `gloss_caregiver_mastery`, `gloss_learning_sessions`, `gloss_attempts`,
   `gloss_milestones`, `pdedu_responses`, `pdedu_caregiver_mastery`,
   `pdedu_quiz_sessions`, `pdedu_quiz_attempts`.
   (`gloss_caregiver_accounts` keeps its FK to `caregiver_profiles`.)
5. Own-row policies on the GLOSS tables use `gloss_is_own_learner(...)`
   instead of the inline `gloss_caregiver_accounts` check. The 0047 rules stay:
   writes backend-only, supervisors read all.

### 0050_pdedu_supervisor_read.sql

1. **Finding:** pdedu RLS today does **not** let supervisors read caregiver
   data — only the caregiver (via `gloss_caregiver_accounts`) and admins.
   (The backend uses the service role, so the supervisor endpoints would work
   without it; the policy keeps direct reads consistent with GLOSS.)
2. Add "Supervisors read all" select policies (`public.is_supervisor()`) on
   `pdedu_responses`, `pdedu_caregiver_mastery`, `pdedu_quiz_sessions`,
   `pdedu_quiz_attempts`.
3. Own-row select / insert / update policies on those four tables use
   `gloss_is_own_learner(...)`, so a supervisor learner can use the Parkinson's
   trainer exactly like a caregiver. Caregivers' access is unchanged.

Both migrations get PGlite RLS tests (tests/rls) before you apply them.

## 4. Shared tables and functions touched

| Object | Owner | Change |
|---|---|---|
| `caregiver_profiles` | shared (PULSE) | **none** — only referenced by the new FK from `gloss_learners` |
| `profiles` | shared | **none** — referenced by `gloss_learners.user_id`; `role` read server-side |
| `participants` | shared | none |
| `public.is_supervisor()` | SCRIBE (0013) | **none** — used in new policies, as 0047 already does |
| `public.is_admin()` | core (0002) | none — used in policies |
| `gloss_*`, `pdedu_*` tables | Sign & Vitals | FK target swap + policies (above) |

## 5. Backend (inside backend_services/sign-vitals)

- `auth_helper.get_authenticated_caregiver` → also accepts a supervisor's
  learner row (gloss_caregiver_accounts first, then `gloss_learners.user_id`).
  Returns the learner id as today, so every learning endpoint works unchanged.
- New `auth_helper.get_authenticated_supervisor`: verifies the token, then
  `profiles.role = 'supervisor'` **on the server**; 403 otherwise. Every
  supervisor endpoint uses it.
- New `supervisor_report.py` (read-only, batched queries):
  - `GET /gloss/me` → `{role, learner_id | null}` (drives the UI)
  - `GET /gloss/supervisor/overview` → caregiver rows + popup lines
  - `GET /gloss/supervisor/caregivers/{id}` → detail + progress summary + pdedu block
  - `POST /gloss/supervisor/learner-profile` → creates the caller's learner row (idempotent)
- Tests: role checks (caregiver token → 403 on every supervisor endpoint),
  pace / active-day maths, learner lookup for both kinds.

## 6. Frontend (inside frontend/src/modules/sign-vitals)

- Overview page: "Team learning" (list + detail + report) and the daily popup
  for supervisors; "Start learning" / "My learning" for their own practice.
- Learning pages unchanged; they work for a supervisor once the learner row
  exists.

## 7. Open points for you

1. Approve the `gloss_learners` parent-table approach (FK swap on our eight
   tables, no change to shared tables)?
2. Parkinson's "lessons completed": symptom-card views are not recorded
   today. Show quizzes completed + questions answered + mastery only, or add a
   small `pdedu_lesson_views` table later?
3. Supervisor learner display name: `profiles.name`?
4. Popup: once per day per supervisor — OK?
