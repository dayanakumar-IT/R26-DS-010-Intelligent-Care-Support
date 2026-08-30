-- ============================================================
-- 0017_SCRIBE_adl_records.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- Adds updated_at tracking (manual corrections via backend) and
-- client_recording_id for idempotent upload retries.
-- ============================================================

-- Tracks when a row was last modified (e.g. supervisor correction
-- to a misrecognized field, applied by the backend via service_role).
alter table adl_records
  add column if not exists updated_at timestamptz not null default now();

-- Client-generated UUID sent with every upload attempt (including
-- offline retries). Backend upserts on this key to prevent duplicates.
alter table adl_records
  add column if not exists client_recording_id uuid unique;

comment on column adl_records.updated_at is
  'Set automatically on UPDATE. Corrections are applied by the backend
  (service_role), not by direct client writes.';

comment on column adl_records.client_recording_id is
  'Idempotency key generated client-side when a recording is first
  created. Backend must upsert: INSERT ... ON CONFLICT (client_recording_id)
  DO NOTHING so retried uploads safely no-op.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_adl_records_updated_at on adl_records;

create trigger trg_adl_records_updated_at
  before update on adl_records
  for each row
  execute function public.set_updated_at();
