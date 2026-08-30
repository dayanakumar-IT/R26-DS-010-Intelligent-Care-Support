create table redistribution_recommendations (
  id uuid primary key default gen_random_uuid(),
  flagged_caregiver_id uuid not null references caregiver_profiles(id),
  suggested_caregiver_id uuid references caregiver_profiles(id),
  flagged_risk_probability float not null,
  flagged_shift text,
  flagged_unit text,
  suggested_shift text,
  suggested_unit text,
  reasoning text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

alter table redistribution_recommendations enable row level security;

create policy "service role full access" on redistribution_recommendations
  for all to service_role using (true) with check (true);

grant select, insert, update on redistribution_recommendations to service_role;
