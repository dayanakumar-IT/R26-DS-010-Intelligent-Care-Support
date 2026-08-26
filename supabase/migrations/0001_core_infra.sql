-- ============================================================
-- 0001_core_infra.sql
-- Cross-cutting infrastructure: model registry + audit log
-- ============================================================

create table model_registry (
  id uuid primary key default gen_random_uuid(),
  component text not null,
  model_name text not null,
  version text not null,
  trained_at timestamptz not null,
  metrics jsonb not null default '{}',
  artifact_path text not null,
  artifact_imputer_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (component, model_name, version)
);

comment on table model_registry is
  'Cross-cutting model version registry.';

create table audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  component text not null,
  event_type text not null,
  actor text not null,
  subject_ref text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table audit_log is
  'Append-only. No UPDATE/DELETE granted to the app role.';

revoke update, delete on audit_log from public;
