import type { AdlCategory, AdlRecord } from '../types'

/** Fields supervisors may correct via the edit modal. */
export type AdlRecordUpdate = Partial<
  Pick<
    AdlRecord,
    | 'category'
    | 'cleaned_transcript'
    | 'alert_required'
    | 'medication_name'
    | 'dosage'
    | 'food_item'
    | 'meal_type'
    | 'intake_level'
    | 'fluid_type'
    | 'fluid_amount'
    | 'hygiene_activity'
    | 'mobility_type'
    | 'destination'
    | 'symptom_type'
    | 'vital_type'
    | 'vital_reading'
    | 'vital_status'
    | 'visitor_type'
    | 'visit_reason'
    | 'time_of_day'
  >
>

export const ADL_CATEGORY_OPTIONS: AdlCategory[] = [
  'medication',
  'meal',
  'fluid_intake',
  'hygiene',
  'mobility',
  'symptom',
  'mood',
  'nurse_check',
  'family_visit',
]

const STRUCTURED_FIELD_KEYS: (keyof AdlRecordUpdate)[] = [
  'medication_name',
  'dosage',
  'food_item',
  'meal_type',
  'intake_level',
  'fluid_type',
  'fluid_amount',
  'hygiene_activity',
  'mobility_type',
  'destination',
  'symptom_type',
  'vital_type',
  'vital_reading',
  'vital_status',
  'visitor_type',
  'visit_reason',
  'time_of_day',
]

/** Build update payload and null out structured fields not used by the selected category. */
export function buildAdlRecordUpdate(
  category: AdlCategory,
  values: Record<string, string | boolean>,
): AdlRecordUpdate {
  const patch: AdlRecordUpdate = {
    category,
    cleaned_transcript: String(values.cleaned_transcript ?? '').trim() || null,
    alert_required: Boolean(values.alert_required),
  }

  for (const key of STRUCTURED_FIELD_KEYS) {
    const raw = values[key]
    ;(patch as Record<string, string | null | boolean | undefined>)[key] =
      raw === '' || raw == null ? null : String(raw)
  }

  return patch
}
