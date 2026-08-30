-- ============================================================
-- 0041_gloss_sign_demo_videos.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- Table: gloss_sign_demo_videos
-- One row per sign that has a validated human reference video.
-- The MP4/WebM binary itself lives in Cloudflare R2 under the
-- dedicated prefix gloss/sign-references/{sign_id}.mp4 — never in
-- Postgres. This table holds metadata only: the object key and a
-- ready-to-play URL.
--
-- This is a TEACHING REFERENCE only. It never participates in the
-- recognition / DTW / mastery pipeline. The 3D avatar (driven by
-- gloss_sign_references, 0025) remains the primary demonstration and
-- is always available; a validated video, when present, is an
-- optional second teaching mode for the SAME target sign.
--
-- Depends on: gloss_signs (0020)
-- ============================================================

create table gloss_sign_demo_videos (
  sign_id text primary key references gloss_signs(id) on delete cascade,
  video_object_key text not null,
  video_url text not null,
  duration_seconds integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table gloss_sign_demo_videos is
  'Metadata for validated human reference videos, one row per sign.
  The video file lives in Cloudflare R2 (object key
  gloss/sign-references/{sign_id}.mp4), NOT in this table. Teaching
  reference only — never used for scoring. Rows are added
  progressively as videos are validated and uploaded; a sign with no
  active row simply falls back to the 3D avatar.';

comment on column gloss_sign_demo_videos.video_object_key is
  'R2 object key, e.g. gloss/sign-references/hello.mp4';
comment on column gloss_sign_demo_videos.video_url is
  'Publicly resolvable playback URL for the R2 object. The frontend
  never receives R2 credentials — only this URL.';

alter table gloss_sign_demo_videos enable row level security;

-- Same convention as gloss_sign_references (0025): authenticated
-- users may read; only admins may manage; service_role keeps full
-- access for the backend / upload script.
create policy "Authenticated users read active reference videos"
  on gloss_sign_demo_videos for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "Admins manage reference videos"
  on gloss_sign_demo_videos for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on gloss_sign_demo_videos to authenticated;
grant select, insert, update, delete on gloss_sign_demo_videos to service_role;