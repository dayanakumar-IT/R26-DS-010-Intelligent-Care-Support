create table gloss_sign_references (
  sign_id text primary key references gloss_signs(id) on delete cascade,
  frame_count int not null,
  landmark_sequence jsonb not null,
  created_at timestamptz not null default now()
);

comment on table gloss_sign_references is
  'One row per sign: the medoid/reference landmark sequence used both
  for DTW scoring (backend) and avatar animation (frontend). Each
  frame is a flat array of 147 numbers (49 landmarks x x,y,z), in the
  order given by landmark_names.json / LandmarkNames.ts. Populated
  once from reference_exemplars.npz via scripts/load_reference_exemplars.py.';

alter table gloss_sign_references enable row level security;

create policy "Authenticated users read reference sequences"
  on gloss_sign_references for select
  using (auth.role() = 'authenticated');

create policy "Admins manage reference sequences"
  on gloss_sign_references for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on gloss_sign_references to authenticated;
grant select, insert, update, delete on gloss_sign_references to service_role;
