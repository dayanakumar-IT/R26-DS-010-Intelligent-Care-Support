# GLOSS — supervisor monitoring plan (not built yet)

Plan for the later supervisor screens. Nothing here is implemented; the data
and access rules they need already exist (migrations 0045–0047).

## Principles

- **Recognition, not surveillance.** Supervisors see what caregivers have
  *achieved* (milestones), not how often they failed.
- **No rankings or leaderboards**, no comparison between caregivers.
- **No streak alerts** and nothing that punishes a missed day. Monthly
  active-day badges are never lost.
- **No video.** Webcam clips are never stored; supervisors never see a
  caregiver's face. Only attempt outcomes and milestones exist.
- **Caregivers know.** The caregiver's progress report says at the top:
  "Your supervisors can see this report."
- **Camera check limits are visible.** Signs the camera cannot judge
  (hurt, pain, me, sleep) are shown as "Camera check unreliable — compare
  with the avatar", never as failures.

## Data already available

| Source | What | Access (RLS) |
|---|---|---|
| `gloss_milestones` | Demonstrated / Retained per sign, levels, category / practice / monthly badges, each with `achieved_at` and `evidence` (attempt ids) | caregiver: own rows; **every supervisor: all caregivers** (`public.is_supervisor()`); admin: all; writes: backend only |
| `gloss_attempts` | per attempt: sign, mode (practice / recall / free), outcome fields, `pipeline_version` | same, plus the existing assigned-supervisor policy |
| `gloss_caregiver_mastery` | current streak per sign | same, plus the existing assigned-supervisor policy |
| `GET /gloss/progress/summary` | level, next level and what is missing, categories, badges | caregiver's own (supervisor variant to add) |

"Every supervisor reads all caregivers" is deliberate: two supervisors
cover for each other, so neither depends on `caregiver_profiles.supervisor_id`.

## Planned screens

### 1. Notification bell (from `gloss_milestones`)

- One entry per **new milestone** of any caregiver: levels, category badges,
  Demonstrated, Retained ("Nadeesha reached Learner", "Kasun earned the Food &
  Drink badge"). Practice and monthly badges optional (setting).
- **Per-supervisor read state**, so one supervisor reading an item does not
  clear it for the other. Proposed table (GLOSS migration, later):

  ```sql
  create table gloss_supervisor_milestone_reads (
    supervisor_id uuid not null references profiles(id) on delete cascade,
    milestone_id  uuid not null references gloss_milestones(id) on delete cascade,
    read_at       timestamptz not null default now(),
    primary key (supervisor_id, milestone_id)
  );
  -- RLS: a supervisor reads and inserts only rows where supervisor_id = auth.uid()
  ```

- Unread count = milestones newer than 30 days without a read row for this
  supervisor. Realtime is optional (poll every few minutes is enough).
- Never notifies about failed or not-recognised attempts.

### 2. Weekly summary

- Per caregiver, last 7 days: active days, signs practised, new Demonstrated /
  Retained, badges earned. Neutral wording; a week with no practice shows
  "No practice this week", without warnings or colours.
- Delivered in the app (and optionally by email later, needs agreement).

### 3. Team progress page

- One row per caregiver: level, Demonstrated count (of 55 countable),
  categories completed, last active date, link to that caregiver's progress
  report (the same printable page the caregiver sees).
- Sorted alphabetically, **not by score**. No totals that rank people.

## Not in scope

- Rankings, league tables, "top learner".
- Streak counters or alerts for breaking a streak.
- Viewing or storing any video or images.
- Editing a caregiver's progress (milestones are written only by the backend
  from real attempts).

## Needs agreement before building

- **The supervisor role is shared with other CareSense components.**
  `profiles.role = 'supervisor'` and `public.is_supervisor()` already exist
  (SCRIBE, 0013). Agree with the SCRIBE / SENTRY / PULSE owners that GLOSS
  supervisors are the same people, and that every supervisor may see all
  caregivers' GLOSS progress.
- Whether practice / monthly badges appear in the bell.
- Email delivery of the weekly summary (privacy and consent).
- Where the supervisor screens live in the shared navigation.
