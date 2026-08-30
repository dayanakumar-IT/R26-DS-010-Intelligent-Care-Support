-- ============================================================
-- 0040_SCRIBE_adl_alerts_supervisor_action.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- Supervisor follow-up notes on acknowledged alerts.
--
-- Depends on: adl_alerts (0014), profiles (0002)
-- ============================================================

alter table adl_alerts
  add column if not exists supervisor_action text,
  add column if not exists action_updated_at timestamptz,
  add column if not exists action_updated_by uuid references profiles(id);

comment on column adl_alerts.supervisor_action is
  'Supervisor description of actions taken after acknowledging the alert.';

comment on column adl_alerts.action_updated_at is
  'When supervisor_action was last saved.';

comment on column adl_alerts.action_updated_by is
  'Supervisor profiles.id who last updated supervisor_action.';
