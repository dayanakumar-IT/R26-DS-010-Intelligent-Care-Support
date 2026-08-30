create table raw_upload_staging (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references caregiver_profiles(id),
  feature_date date not null,
  hr_mean_full float,
  hr_std float,
  hr_min float,
  hr_max float,
  number_steps float,
  cardio_minutes float,
  fat_burn_minutes float,
  peak_minutes float,
  out_of_range_minutes float,
  resting_heart_rate float,
  sleep1efficiency float,
  real_stress float,
  revealed boolean not null default false,
  revealed_at timestamptz,
  unique(caregiver_id, feature_date)
);

alter table raw_upload_staging enable row level security;
create policy "service role full access" on raw_upload_staging
  for all to service_role using (true) with check (true);
grant select, insert, update on raw_upload_staging to service_role;
