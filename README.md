# CareSense PP2

CareSense PP2 is a caregiver workforce intelligence platform made up of four components:

- **Deterioration detection**
- **Fall detection**
- **Sign & vitals**
- **Voice log**

## Repository structure

- `frontend/` — one shared React app; each component has its own module folder under `src/modules/`.
- `backend_services/<component>/` — each teammate's own FastAPI service for their component.
- `supabase/migrations/` — shared schema, versioned via the Supabase CLI.

## Getting Started

_Placeholder — details to follow._

## Adding your own database tables

Each component owns its own tables. Follow this exact pattern —
skipping any step causes real, hard-to-diagnose errors.

### SENTRY (Component 2 — Fall Detection) tables

SENTRY uses 4 tables, all created in `supabase/migrations/`:

| File | Table | Purpose |
|------|-------|---------|
| `0007_SENTRY_patients.sql` | `patients` | Patient registry — `patient_code` (e.g. P01), `gender`. No real names stored. |
| `0008_SENTRY_rooms.sql` | `rooms` | Monitored rooms — camera source, ward, zone config, caregiver FK to PULSE |
| `0009_SENTRY_fall_events.sql` | `fall_events` | Every ST-GCN inference window (~3 s) — `risk_score`, `risk_level`, `posture` |
| `0010_SENTRY_fall_alerts.sql` | `fall_alerts` | Fired alerts (MODERATE / HIGH) — `acknowledged`, R2 replay key |

### Rules for all components

1. Name your file after the last existing migration number, prefixed with your component name (e.g. `0011_PULSE_yourwork.sql`). **Never edit an already-pushed migration — create a new one instead.**

2. Always use `bigint generated always as identity primary key` — not `serial` or `bigserial`.

3. Enable RLS on every table:
   ```sql
   alter table your_table enable row level security;
   ```

4. Add RLS policies using `public.is_admin()` (see 0001–0006 for the pattern). Without a policy, nobody can read/write rows even with correct grants.

5. Grant access explicitly — this project has "Automatically expose new tables" disabled:
   ```sql
   grant select on your_table to authenticated;
   grant select, insert, update, delete on your_table to service_role;
   ```

6. Run `supabase db push` from the **REPO ROOT** — never from inside `frontend/`.

7. Verify in Supabase Table Editor after pushing — don't just trust the CLI success message.

**Common error:** `"permission denied for table X"` is almost always a missing GRANT (step 5), not an RLS problem — both layers are required in Postgres.
