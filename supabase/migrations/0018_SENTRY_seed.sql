-- ============================================================
-- 0018_SENTRY_seed.sql
-- SENTRY Component — Demo seed data for viva / testing.
-- 8 rooms  (Ward A, Ward B, Ward C, ICU)
-- 41 patients: P01–P22 female, P23–P41 male (all medicated)
-- camera_src left NULL — set at runtime via camera config API.
-- caregiver_id left NULL — managed by PULSE component.
-- Safe to re-run: uses ON CONFLICT DO NOTHING / DO UPDATE.
-- ============================================================

-- ── Rooms ────────────────────────────────────────────────────
insert into rooms (room_code, ward) values
  ('ROOM_01', 'Ward A'),
  ('ROOM_02', 'Ward A'),
  ('ROOM_03', 'Ward B'),
  ('ROOM_04', 'Ward B'),
  ('ROOM_05', 'Ward C'),
  ('ROOM_06', 'Ward C'),
  ('ROOM_07', 'ICU'),
  ('ROOM_08', 'ICU')
on conflict (room_code) do update
  set ward = excluded.ward;

-- ── Patients ─────────────────────────────────────────────────
-- Female patients: P01 – P22
-- Male patients  : P23 – P41 (all medicated)
-- room_id references rooms.room_code (text FK — no fk constraint, soft link)

insert into patients (patient_code, gender, room_id) values
  -- Ward A — Room 01 (5 female)
  ('P01',  'F', 'ROOM_01'),
  ('P02',  'F', 'ROOM_01'),
  ('P03',  'F', 'ROOM_01'),
  ('P04',  'F', 'ROOM_01'),
  ('P05',  'F', 'ROOM_01'),

  -- Ward A — Room 02 (6 female)
  ('P06',  'F', 'ROOM_02'),
  ('P07',  'F', 'ROOM_02'),
  ('P08',  'F', 'ROOM_02'),
  ('P09',  'F', 'ROOM_02'),
  ('P10',  'F', 'ROOM_02'),
  ('P11',  'F', 'ROOM_02'),

  -- Ward B — Room 03 (6 female)
  ('P12',  'F', 'ROOM_03'),
  ('P13',  'F', 'ROOM_03'),
  ('P14',  'F', 'ROOM_03'),
  ('P15',  'F', 'ROOM_03'),
  ('P16',  'F', 'ROOM_03'),
  ('P17',  'F', 'ROOM_03'),

  -- Ward B — Room 04 (5 female)
  ('P18',  'F', 'ROOM_04'),
  ('P19',  'F', 'ROOM_04'),
  ('P20',  'F', 'ROOM_04'),
  ('P21',  'F', 'ROOM_04'),
  ('P22',  'F', 'ROOM_04'),

  -- Ward C — Room 05 (6 male, medicated)
  ('P23',  'M', 'ROOM_05'),
  ('P24',  'M', 'ROOM_05'),
  ('P25',  'M', 'ROOM_05'),
  ('P26',  'M', 'ROOM_05'),
  ('P27',  'M', 'ROOM_05'),
  ('P28',  'M', 'ROOM_05'),

  -- Ward C — Room 06 (6 male, medicated)
  ('P29',  'M', 'ROOM_06'),
  ('P30',  'M', 'ROOM_06'),
  ('P31',  'M', 'ROOM_06'),
  ('P32',  'M', 'ROOM_06'),
  ('P33',  'M', 'ROOM_06'),
  ('P34',  'M', 'ROOM_06'),

  -- ICU — Room 07 (4 male, medicated)
  ('P35',  'M', 'ROOM_07'),
  ('P36',  'M', 'ROOM_07'),
  ('P37',  'M', 'ROOM_07'),
  ('P38',  'M', 'ROOM_07'),

  -- ICU — Room 08 (3 male, medicated)
  ('P39',  'M', 'ROOM_08'),
  ('P40',  'M', 'ROOM_08'),
  ('P41',  'M', 'ROOM_08')

on conflict (patient_code) do update
  set gender  = excluded.gender,
      room_id = excluded.room_id;
