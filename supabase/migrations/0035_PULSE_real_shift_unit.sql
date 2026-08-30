alter table caregiver_profiles
  add column real_shift text,
  add column real_unit text;

comment on column caregiver_profiles.real_shift is 'Real Day/Night shift from TILES-2018 participant_info.csv — distinct from the existing ward column';
comment on column caregiver_profiles.real_unit is 'Real anonymized unit code from TILES-2018 participant_info.csv PrimaryUnit, or NULL if not recorded in the source dataset for this participant';
