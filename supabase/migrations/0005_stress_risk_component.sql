-- ============================================================
-- 0005_stress_risk_component.sql
-- Raw/sensitive tier (per audit classification): TILES-2018-derived
-- participant data. NOT granted to `authenticated` — the frontend
-- must never query these directly. Only `service_role` (used by
-- Edge Functions / a future backend service) can read/write here.
-- Public-facing display goes through caregiver_profiles instead
-- (0006), which is the derived/public layer.
-- ============================================================

create table participants (
  participant_id uuid primary key,
  primary_unit text,
  shift text,
  wave text,
  split_group text not null check (split_group in ('train','val','test','demo')),
  has_jelly_coverage boolean not null default false,
  has_fitbit_coverage boolean not null default false,
  created_at timestamptz not null default now()
);

create table daily_features (
  id bigint generated always as identity primary key,
  participant_id uuid not null references participants(participant_id),
  feature_date date not null,
  hr_mean double precision,
  hr_std double precision,
  hr_min double precision,
  hr_max double precision,
  hr_mean_deviation double precision,
  hr_dev_roll3 double precision,
  hr_dev_roll7 double precision,
  number_steps integer,
  cardio_minutes double precision,
  fat_burn_minutes double precision,
  peak_minutes double precision,
  out_of_range_minutes double precision,
  resting_heart_rate double precision,
  steps_deviation double precision,
  sleep1efficiency double precision,
  feature_pipeline_version text not null,
  created_at timestamptz not null default now(),
  unique (participant_id, feature_date)
);

create table participant_baselines (
  id bigint generated always as identity primary key,
  participant_id uuid not null references participants(participant_id),
  baseline_type text not null check (baseline_type in ('fixed_historical','running')),
  hr_mean_baseline double precision not null,
  steps_mean_baseline double precision not null,
  computed_from_start date not null,
  computed_from_end date not null,
  feature_pipeline_version text not null,
  created_at timestamptz not null default now(),
  unique (participant_id, baseline_type)
);

create table centrality_daily (
  id bigint generated always as identity primary key,
  participant_id uuid not null references participants(participant_id),
  centrality_date date not null,
  degree_centrality integer not null,
  weighted_centrality integer not null,
  source_pipeline_version text not null,
  created_at timestamptz not null default now(),
  unique (participant_id, centrality_date)
);

create index idx_daily_features_participant_date on daily_features (participant_id, feature_date);
create index idx_centrality_participant_date on centrality_daily (participant_id, centrality_date);

alter table participants enable row level security;
alter table daily_features enable row level security;
alter table participant_baselines enable row level security;
alter table centrality_daily enable row level security;

-- No policies granting `authenticated` access on purpose — these are
-- raw/sensitive tables per audit classification. service_role (used
-- server-side only) bypasses RLS by design, so it doesn't need a
-- policy, only the grant below.

grant select, insert, update, delete on participants to service_role;
grant select, insert, update, delete on daily_features to service_role;
grant select, insert, update, delete on participant_baselines to service_role;
grant select, insert, update, delete on centrality_daily to service_role;
