-- ============================================================
-- 0028_SCRIBE_seed_adl_alerts.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- Creates adl_alerts rows for seeded observations where
-- alert_required = true. ~40% are pre-acknowledged for demo.
--
-- Depends on: adl_records (0013, 0027), adl_alerts (0014),
--             profiles (0002, supervisor role)
--
-- Safe to re-run: skips records that already have an alert row.
-- ============================================================

insert into adl_alerts (adl_record_id, patient_id, acknowledged, ack_by, ack_at)
select
  r.id,
  r.patient_id,
  s.acknowledged,
  case when s.acknowledged then s.supervisor_id else null end as ack_by,
  case when s.acknowledged then r.recorded_at + interval '1 hour' else null end as ack_at
from adl_records r
cross join lateral (
  select
    (random() < 0.4) as acknowledged,
    (
      select id
      from profiles
      where role = 'supervisor'
      order by random()
      limit 1
    ) as supervisor_id
) s
where r.alert_required = true
  and not exists (
    select 1
    from adl_alerts a
    where a.adl_record_id = r.id
  );
