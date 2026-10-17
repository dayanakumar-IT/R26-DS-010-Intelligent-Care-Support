-- ============================================================
-- 0044_SCRIBE_multi_observation_support.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- Allows one recording to produce multiple ADL records (one per
-- detected sentence/observation — see backend pipeline Change 1).
--
-- Depends on: adl_records (0013), client_recording_id (0017)
--
-- Replaces the single-column UNIQUE(client_recording_id) constraint
-- with a composite UNIQUE(client_recording_id, observation_index), so
-- idempotent retries still dedupe per observation while a recording
-- can now insert several rows that share one client_recording_id.
-- No data is deleted; every existing row defaults to
-- observation_index = 0, which is unique under the old constraint
-- too, so single-observation behaviour is unchanged.
-- ============================================================

alter table adl_records
  add column if not exists observation_index integer not null default 0;

comment on column adl_records.observation_index is
  'SCRIBE: 0-based position of this observation within its source
  recording. A single-observation recording always has
  observation_index = 0, matching behaviour prior to this migration.';

-- Drop the single-column unique constraint on client_recording_id by
-- looking up its real name instead of assuming it — 0017 created it as
-- an inline column constraint (`uuid unique`), which Postgres names
-- adl_records_client_recording_id_key by default, but we look it up so
-- this still works even if it was ever created under a different name.
do $$
declare
  found_constraint text;
begin
  select con.conname into found_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att
    on att.attrelid = rel.oid
   and att.attnum = con.conkey[1]
  where rel.relname = 'adl_records'
    and con.contype = 'u'
    and array_length(con.conkey, 1) = 1
    and att.attname = 'client_recording_id';

  if found_constraint is not null then
    execute format('alter table adl_records drop constraint %I', found_constraint);
  end if;
end $$;

create unique index if not exists idx_adl_records_recording_observation
  on adl_records (client_recording_id, observation_index)
  where client_recording_id is not null;

comment on index idx_adl_records_recording_observation is
  'SCRIBE: replaces the old single-column unique constraint on
  client_recording_id. A recording (client_recording_id) may now have
  several adl_records rows, one per observation_index, each still
  protected from duplicate inserts on upload retry.';
