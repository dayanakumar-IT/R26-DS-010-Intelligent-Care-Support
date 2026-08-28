-- ============================================================
-- 0008_SENTRY_rooms.sql
-- SENTRY Component — Fall Risk Detection (Component 2)
-- Hospital rooms monitored by the SENTRY camera system.
-- Each room has one USB camera and one patient assigned.
-- ============================================================

drop table if exists rooms cascade;

create table rooms (
  id            bigint generated always as identity primary key,
  room_code     text not null unique,
  ward          text,
  camera_src    text,
  caregiver_id  uuid references caregiver_profiles(id) on delete set null,
  zone_config   jsonb,
  created_at    timestamptz not null default now()
);

comment on table rooms is
  'Hospital rooms monitored by SENTRY. camera_src is the USB/RTSP
  camera source (e.g. 0 for webcam, rtsp://... for IP camera)
  configured by the supervisor via the web portal.
  zone_config stores polygon zone maps (bed zone, door zone, etc.)
  used by the context engine to adjust fall risk scores.
  caregiver_id links to PULSE caregiver_profiles — one caregiver
  per room, notified when a HIGH alert fires.';

alter table rooms enable row level security;

create policy "Admins can manage rooms"
  on rooms for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Supervisors can read rooms"
  on rooms for select
  using (auth.role() = 'authenticated');

grant select on rooms to authenticated;
grant select, insert, update, delete on rooms to service_role;
