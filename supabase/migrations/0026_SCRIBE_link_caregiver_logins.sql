-- ============================================================
-- 0026_SCRIBE_link_caregiver_logins.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- Links three known caregiver login accounts (profiles) to their
-- caregiver_profiles rows via profile_id.
--
-- Depends on: profiles (0002), caregiver_profiles (0006),
--             caregiver_profiles.profile_id (0013)
--
-- Safe to re-run: only updates rows where profile_id is still null.
-- ============================================================

update caregiver_profiles cp
set profile_id = p.id
from profiles p
where p.name = cp.display_name
  and cp.profile_id is null
  and p.name in (
    'Vindya Ratnasekera',
    'Dilrukshi Wanniarachchi',
    'Harsha Wijesinghe'
  );
