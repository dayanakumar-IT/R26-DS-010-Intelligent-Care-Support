-- ============================================================
-- 0033_SCRIBE_seed_patient_assignments.sql
-- SCRIBE Component — initial patient–caregiver assignments for
-- demo patients (P01–P09) distributed across linked caregivers.
--
-- Safe to re-run: skips patients that already have a current assignment.
-- ============================================================

insert into scribe_patient_assignments (patient_id, caregiver_id, assigned_at)
select p.id, cg.id, now()
from (
  select id, row_number() over (order by patient_code) as rn
  from patients
  where patient_code ~ '^P[0-9]+$'
) p
join (
  select id, row_number() over (order by display_name) as rn
  from caregiver_profiles
  where profile_id is not null
) cg on ((p.rn - 1) % (select count(*) from caregiver_profiles where profile_id is not null)) + 1 = cg.rn
where not exists (
  select 1
  from scribe_patient_assignments spa
  where spa.patient_id = p.id
    and spa.ended_at is null
);
