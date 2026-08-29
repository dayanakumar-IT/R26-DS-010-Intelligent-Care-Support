-- ============================================================
-- 0024_gloss_sign_difficulty_view.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- View: gloss_sign_difficulty
-- Optional convenience view: shows how often each sign is
-- actually signed incorrectly across all caregivers, computed
-- live from gloss_attempts rather than a stored difficulty label.
-- Not required to run the app — skip this file if you decide you
-- don't want it.
--
-- Depends on: gloss_signs (0020), gloss_attempts (0023)
-- ============================================================

create or replace view gloss_sign_difficulty as
select
  s.id as sign_id,
  s.display_name,
  count(a.id) as total_attempts,
  count(a.id) filter (where a.recognized_sign_id is distinct from a.target_sign_id) as incorrect_attempts,
  case
    when count(a.id) = 0 then null
    else round(
      count(a.id) filter (where a.recognized_sign_id is distinct from a.target_sign_id)::numeric
      / count(a.id) * 100, 1
    )
  end as error_rate_percent
from gloss_signs s
left join gloss_attempts a on a.target_sign_id = s.id
group by s.id, s.display_name;

comment on view gloss_sign_difficulty is
  'Read-only convenience view: shows how often each sign is
  actually signed incorrectly across all caregivers. Higher
  error_rate_percent = harder sign. Recalculates automatically
  as more attempts are recorded — no manual difficulty labels.';
