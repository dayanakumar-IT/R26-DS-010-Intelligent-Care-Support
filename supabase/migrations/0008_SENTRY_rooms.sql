-- ============================================================
-- 0008_SENTRY_rooms.sql
-- SENTRY Component — Fall Risk Detection (Component 2)
-- Stores room records with camera config and zone maps.
-- ============================================================

create table rooms (
  id             text primary key,
  name           text not null,
  ward           text,
  camera_src     text,
  camera_suffix  text default '',
  zone_config    jsonb,
  created_at     timestamptz not null default now()
);

comment on table rooms is
  'Hospital rooms monitored by SENTRY. camera_src is the USB/RTSP
  camera source configured by the supervisor via the web portal.
  zone_config stores polygon zone maps (bed zone, bathroom zone, etc.)
  used by the context engine to adjust fall risk scores.';

alter table rooms enable row level security;

create policy "Authenticated users can read rooms"
  on rooms for select
  using (auth.role() = 'authenticated');

create policy "Service role can manage rooms"
  on rooms for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant select on rooms to authenticated;
grant select, insert, update, delete on rooms to service_role;
