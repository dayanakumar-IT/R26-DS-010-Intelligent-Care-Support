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

1. Create your migration file in `supabase/migrations/`, numbered after the last existing one (e.g. `PULSE_yourwork.sql`). Never edit an already-pushed migration file — create a new one instead.

2. Enable RLS on every table you create:
   ```sql
   alter table your_table_name enable row level security;
   ```

3. Write at least one RLS policy — without one, the table exists but nobody (not even you) can read/write any rows, even with correct grants. Example: authenticated users can read everything in your own component's tables, or restrict by role as needed.

4. Explicitly grant privileges to the roles that need them. This project has "Automatically expose new tables" disabled by design — nothing gets API access until you grant it, so this step is required, not optional:
   ```sql
   grant select, insert, update, delete on your_table_name to authenticated;
   grant select, insert, update, delete on your_table_name to service_role;
   ```
   Adjust which privileges/roles based on what your table actually needs — e.g. a read-only public table might only need `select`.

5. Test locally before pushing: `supabase db push --dry-run` if available, or review the CLI's diff preview carefully when it asks for confirmation.

6. Run `supabase db push` from the **REPO ROOT**, never from inside `frontend/` — running it from the wrong directory silently creates a stray, disconnected `supabase/` folder instead of using the linked project.

7. After pushing, verify in the Supabase dashboard (Table Editor) that the table actually appears with the columns you expect — don't just trust the CLI's success message.

**Common error:** "permission denied for table X" looks like an RLS problem but is almost always a missing GRANT (step 4) — RLS and table-level grants are two separate permission layers in Postgres, and both are required.
