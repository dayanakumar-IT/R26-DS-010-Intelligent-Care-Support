alter table daily_features
  add column stress_binary integer,
  add column lag1_stress integer;

comment on column daily_features.stress_binary is
  'The actual recorded EMA stress response (binarized) for this
  participant-day, from TILES-2018. This is the ground-truth label,
  not a model input by itself.';

comment on column daily_features.lag1_stress is
  'The same participant''s stress_binary from their own previous
  recorded day (causal, never looks ahead). One of the 16 real model
  input features for lgbm_model_baseline. NULL for each participant''s
  first recorded day, since no prior day exists.';
