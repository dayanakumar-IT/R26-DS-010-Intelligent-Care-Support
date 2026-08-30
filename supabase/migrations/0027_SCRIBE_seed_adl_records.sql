-- ============================================================
-- 0027_SCRIBE_seed_adl_records.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- Demo seed data: 30 voice ADL observations across P01–P09
-- (3–4 observations per patient).
--
-- Depends on: patients (0012, seeded in 0018), caregiver_profiles (0006),
--             adl_records (0013, 0017)
--
-- Resolves patient_id from patients.patient_code and caregiver_id from
-- caregiver_profiles.display_name. Each row gets a deterministic
-- client_recording_id so the script is safe to re-run
-- (ON CONFLICT DO NOTHING).
-- ============================================================

with seed_data (
  client_recording_id,
  patient_code,
  caregiver_name,
  category,
  medication_name,
  dosage,
  food_item,
  meal_type,
  intake_level,
  fluid_type,
  fluid_amount,
  hygiene_activity,
  mobility_type,
  destination,
  symptom_type,
  vital_type,
  vital_reading,
  vital_status,
  visitor_type,
  visit_reason,
  time_of_day,
  alert_required,
  cleaned_transcript,
  recorded_at
) as (
  values
  ('02600001-0000-4000-8000-000000000001'::uuid, 'P01', 'Vindya Ratnasekera', 'medication', 'Metformin', '1 tablet', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'morning', false, 'Gave P01 her Metformin this morning, no issues.', now() - interval '1 day 8 hours'),
  ('02600001-0000-4000-8000-000000000002'::uuid, 'P01', 'Vindya Ratnasekera', 'meal', null, null, 'rice and fish curry', 'lunch', 'full', null, null, null, null, null, null, null, null, null, null, null, 'lunch', false, 'P01 had rice and fish curry for lunch, ate everything.', now() - interval '1 day 4 hours'),
  ('02600001-0000-4000-8000-000000000003'::uuid, 'P01', 'Vindya Ratnasekera', 'hygiene', null, null, null, null, null, null, null, 'full bath', null, null, null, null, null, null, null, null, 'afternoon', false, 'Gave P01 a full bath this afternoon.', now() - interval '1 day 1 hour'),
  ('02600001-0000-4000-8000-000000000004'::uuid, 'P01', 'Vindya Ratnasekera', 'mobility', null, null, null, null, null, null, null, null, 'independent walking', 'dining hall', null, null, null, null, null, null, 'evening', false, 'P01 walked to the dining hall independently this evening.', now() - interval '20 hours'),

  ('02600001-0000-4000-8000-000000000005'::uuid, 'P02', 'Vindya Ratnasekera', 'medication', 'Aspirin', '1 tablet', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'night', false, 'Gave P02 Aspirin at night.', now() - interval '1 day 10 hours'),
  ('02600001-0000-4000-8000-000000000006'::uuid, 'P02', 'Vindya Ratnasekera', 'symptom', null, null, null, null, null, null, null, null, null, null, 'headache', null, null, null, null, null, 'morning', true, 'P02 complained of a headache this morning.', now() - interval '9 hours'),
  ('02600001-0000-4000-8000-000000000007'::uuid, 'P02', 'Vindya Ratnasekera', 'fluid_intake', null, null, null, null, null, 'water', '150ml', null, null, null, null, null, null, null, null, null, 'varies', false, 'Gave P02 150ml of water after breakfast.', now() - interval '7 hours'),

  ('02600001-0000-4000-8000-000000000008'::uuid, 'P03', 'Vindya Ratnasekera', 'meal', null, null, 'kiribath', 'breakfast', 'partial', null, null, null, null, null, null, null, null, null, null, null, 'breakfast', true, 'P03 only ate a little kiribath for breakfast, seemed uninterested.', now() - interval '1 day 11 hours'),
  ('02600001-0000-4000-8000-000000000009'::uuid, 'P03', 'Vindya Ratnasekera', 'nurse_check', null, null, null, null, null, null, null, null, null, null, null, 'blood pressure', '142/88', 'normal', null, null, 'weekly', false, 'Nurse checked P03 blood pressure, within normal range.', now() - interval '2 days'),
  ('02600001-0000-4000-8000-000000000010'::uuid, 'P03', 'Vindya Ratnasekera', 'family_visit', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'daughter', 'routine visit', 'afternoon', false, 'P03 was visited by her daughter this afternoon.', now() - interval '1 day 2 hours'),

  ('02600001-0000-4000-8000-000000000011'::uuid, 'P04', 'Dilrukshi Wanniarachchi', 'medication', 'Losartan', '1 tablet', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'morning', false, 'Gave P04 her Losartan this morning.', now() - interval '1 day 9 hours'),
  ('02600001-0000-4000-8000-000000000012'::uuid, 'P04', 'Dilrukshi Wanniarachchi', 'meal', null, null, 'string hoppers', 'dinner', 'refused', null, null, null, null, null, null, null, null, null, null, null, 'dinner', true, 'P04 refused dinner today, seemed upset.', now() - interval '6 hours'),
  ('02600001-0000-4000-8000-000000000013'::uuid, 'P04', 'Dilrukshi Wanniarachchi', 'hygiene', null, null, null, null, null, null, null, 'diaper change', null, null, null, null, null, null, null, null, 'afternoon', false, 'Gave P04 a diaper change this afternoon.', now() - interval '10 hours'),
  ('02600001-0000-4000-8000-000000000014'::uuid, 'P04', 'Dilrukshi Wanniarachchi', 'mood', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'evening', true, 'P04 seemed withdrawn and quiet this evening.', now() - interval '4 hours'),

  ('02600001-0000-4000-8000-000000000015'::uuid, 'P05', 'Dilrukshi Wanniarachchi', 'mobility', null, null, null, null, null, null, null, null, 'wheelchair assistance', 'washroom', null, null, null, null, null, null, 'morning', false, 'P05 needed wheelchair assistance to the washroom this morning.', now() - interval '1 day 7 hours'),
  ('02600001-0000-4000-8000-000000000016'::uuid, 'P05', 'Dilrukshi Wanniarachchi', 'meal', null, null, 'noodles', 'breakfast', 'full', null, null, null, null, null, null, null, null, null, null, null, 'breakfast', false, 'P05 finished all the noodles for breakfast.', now() - interval '1 day 8 hours'),
  ('02600001-0000-4000-8000-000000000017'::uuid, 'P05', 'Dilrukshi Wanniarachchi', 'symptom', null, null, null, null, null, null, null, null, null, null, 'chest pain', null, null, null, null, null, 'afternoon', true, 'P05 complained of chest pain after lunch.', now() - interval '5 hours'),

  ('02600001-0000-4000-8000-000000000018'::uuid, 'P06', 'Dilrukshi Wanniarachchi', 'medication', 'Sindopa', '1/2 tablet', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'morning', false, 'Gave P06 half a tablet of Sindopa this morning.', now() - interval '1 day 6 hours'),
  ('02600001-0000-4000-8000-000000000019'::uuid, 'P06', 'Dilrukshi Wanniarachchi', 'fluid_intake', null, null, null, null, null, 'milk tea', '200ml', null, null, null, null, null, null, null, null, null, 'afternoon', false, 'Gave P06 200ml of milk tea in the afternoon.', now() - interval '8 hours'),
  ('02600001-0000-4000-8000-000000000020'::uuid, 'P06', 'Dilrukshi Wanniarachchi', 'hygiene', null, null, null, null, null, null, null, 'sponge bath', null, null, null, null, null, null, null, null, 'morning', false, 'Gave P06 a sponge bath this morning.', now() - interval '1 day 5 hours'),

  ('02600001-0000-4000-8000-000000000021'::uuid, 'P07', 'Harsha Wijesinghe', 'medication', 'Atova', '1 tablet', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'night', false, 'Gave P07 Atova at night, no issues.', now() - interval '1 day 12 hours'),
  ('02600001-0000-4000-8000-000000000022'::uuid, 'P07', 'Harsha Wijesinghe', 'nurse_check', null, null, null, null, null, null, null, null, null, null, null, 'blood sugar', '210 mg/dL', 'elevated', null, null, 'weekly', true, 'Nurse checked P07 blood sugar, flagged as elevated.', now() - interval '3 hours'),
  ('02600001-0000-4000-8000-000000000023'::uuid, 'P07', 'Harsha Wijesinghe', 'meal', null, null, 'rice, chicken and vegetable curry', 'lunch', 'full', null, null, null, null, null, null, null, null, null, null, null, 'lunch', false, 'P07 finished all the rice, chicken and vegetable curry.', now() - interval '1 day 3 hours'),
  ('02600001-0000-4000-8000-000000000024'::uuid, 'P07', 'Harsha Wijesinghe', 'mobility', null, null, null, null, null, null, null, null, 'two-person walking support', 'sitting area', null, null, null, null, null, null, 'afternoon', false, 'P07 needed two-person support to get to the sitting area.', now() - interval '1 day 1 hour'),

  ('02600001-0000-4000-8000-000000000025'::uuid, 'P08', 'Harsha Wijesinghe', 'medication', 'Metformin', '2 tablets', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'morning', false, 'Gave P08 2 tablets of Metformin this morning.', now() - interval '1 day 9 hours'),
  ('02600001-0000-4000-8000-000000000026'::uuid, 'P08', 'Harsha Wijesinghe', 'symptom', null, null, null, null, null, null, null, null, null, null, 'loose motion', null, null, null, null, null, 'evening', true, 'P08 had loose motion this evening.', now() - interval '2 hours'),
  ('02600001-0000-4000-8000-000000000027'::uuid, 'P08', 'Harsha Wijesinghe', 'family_visit', null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'son', 'routine visit', 'afternoon', false, 'P08 was visited by his son this afternoon.', now() - interval '1 day 2 hours'),

  ('02600001-0000-4000-8000-000000000028'::uuid, 'P09', 'Harsha Wijesinghe', 'hygiene', null, null, null, null, null, null, null, 'teeth brushing', null, null, null, null, null, null, null, null, 'morning', false, 'Assisted P09 with teeth brushing this morning.', now() - interval '1 day 10 hours'),
  ('02600001-0000-4000-8000-000000000029'::uuid, 'P09', 'Harsha Wijesinghe', 'meal', null, null, 'kiribath', 'breakfast', 'partial', null, null, null, null, null, null, null, null, null, null, null, 'breakfast', true, 'P09 only ate a little kiribath, seemed uninterested.', now() - interval '1 day 11 hours'),
  ('02600001-0000-4000-8000-000000000030'::uuid, 'P09', 'Harsha Wijesinghe', 'mobility', null, null, null, null, null, null, null, null, 'independent walking', 'washroom', null, null, null, null, null, null, 'morning', false, 'P09 walked to the washroom independently today.', now() - interval '9 hours')
),
resolved as (
  select
    s.client_recording_id,
    p.id as patient_id,
    cp.id as caregiver_id,
    s.category,
    s.medication_name,
    s.dosage,
    s.food_item,
    s.meal_type,
    s.intake_level,
    s.fluid_type,
    s.fluid_amount,
    s.hygiene_activity,
    s.mobility_type,
    s.destination,
    s.symptom_type,
    s.vital_type,
    s.vital_reading,
    s.vital_status,
    s.visitor_type,
    s.visit_reason,
    s.time_of_day,
    s.alert_required,
    s.cleaned_transcript,
    s.recorded_at
  from seed_data s
  join patients p on p.patient_code = s.patient_code
  join caregiver_profiles cp on cp.display_name = s.caregiver_name
)
insert into adl_records (
  client_recording_id,
  patient_id,
  caregiver_id,
  category,
  medication_name,
  dosage,
  food_item,
  meal_type,
  intake_level,
  fluid_type,
  fluid_amount,
  hygiene_activity,
  mobility_type,
  destination,
  symptom_type,
  vital_type,
  vital_reading,
  vital_status,
  visitor_type,
  visit_reason,
  time_of_day,
  alert_required,
  cleaned_transcript,
  recorded_at
)
select
  client_recording_id,
  patient_id,
  caregiver_id,
  category,
  medication_name,
  dosage,
  food_item,
  meal_type,
  intake_level,
  fluid_type,
  fluid_amount,
  hygiene_activity,
  mobility_type,
  destination,
  symptom_type,
  vital_type,
  vital_reading,
  vital_status,
  visitor_type,
  visit_reason,
  time_of_day,
  alert_required,
  cleaned_transcript,
  recorded_at
from resolved
on conflict (client_recording_id) do nothing;
