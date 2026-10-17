// Plain-language labels for the model's SHAP feature names (top_shap_factor),
// for display anywhere in this module. Only 11 of the 16 real feature names
// (see FEATURE_ORDER / FEATURE_LABELS in backend_services/deterioration-detection/main.py)
// were given a mapping — translateShapFactor() falls back to the raw feature
// name for anything else (hr_mean, hr_std, hr_min, out_of_range_minutes,
// peak_minutes) rather than hiding it.
export const SHAP_FACTOR_LABELS: Record<string, string> = {
  lag1_stress: 'Recent reported stress trend',
  hr_max: 'Elevated heart rate',
  hr_mean_deviation_model: 'Heart rate deviation from personal baseline',
  hr_dev_roll3: '3-day heart rate trend',
  hr_dev_roll7: '7-day heart rate trend',
  sleep1efficiency: 'Reduced sleep efficiency',
  steps_deviation: 'Change in activity level',
  number_steps: 'Step count',
  cardio_minutes: 'Cardio activity',
  fat_burn_minutes: 'Fat-burn activity',
  resting_heart_rate: 'Resting heart rate',
}

export function translateShapFactor(factor: string | null): string {
  if (!factor) return 'Unknown'
  return SHAP_FACTOR_LABELS[factor] ?? factor
}
