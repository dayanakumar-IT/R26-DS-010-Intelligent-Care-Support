-- ============================================================
-- 0020_gloss_signs.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- Table: gloss_signs
-- The 59 sign classes the trained model recognises.
-- No difficulty column on purpose — difficulty is computed by
-- the backend from real mistake data in gloss_attempts, not
-- stored as a fixed label (see 0024_gloss_sign_difficulty_view.sql).
--
-- Depends on: nothing (standalone lookup table)
-- ============================================================

create table gloss_signs (
  id text primary key,              -- must match the model's class label exactly, e.g. 'pain', 'tired'
  display_name text not null,
  category text,                    -- e.g. 'symptom', 'greeting' — optional, for grouping in the UI
  is_active boolean not null default true
);

comment on table gloss_signs is
  'Lookup table of the 59 recognised sign classes. Small reference
  data only — not training data, and not the reference videos
  (those live in Cloudflare R2).';

alter table gloss_signs enable row level security;

create policy "Authenticated users read sign catalogue"
  on gloss_signs for select
  using (auth.role() = 'authenticated');

create policy "Admins manage sign catalogue"
  on gloss_signs for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on gloss_signs to authenticated;
grant select, insert, update, delete on gloss_signs to service_role;
