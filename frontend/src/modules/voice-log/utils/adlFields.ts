import type { AdlCategory, AdlRecord } from '../types'

type AdlFieldKey = keyof AdlRecord

export const CATEGORY_FIELD_DEFS: Record<
  AdlCategory,
  ReadonlyArray<{ key: AdlFieldKey; label: string }>
> = {
  medication: [
    { key: 'medication_name', label: 'Medication' },
    { key: 'dosage', label: 'Dosage' },
    { key: 'time_of_day', label: 'Time of day' },
  ],
  meal: [
    { key: 'food_item', label: 'Food' },
    { key: 'meal_type', label: 'Meal type' },
    { key: 'intake_level', label: 'Intake level' },
  ],
  fluid_intake: [
    { key: 'fluid_type', label: 'Fluid' },
    { key: 'fluid_amount', label: 'Amount' },
    { key: 'time_of_day', label: 'Time of day' },
  ],
  hygiene: [
    { key: 'hygiene_activity', label: 'Activity' },
    { key: 'time_of_day', label: 'Time of day' },
  ],
  mobility: [
    { key: 'mobility_type', label: 'Mobility' },
    { key: 'destination', label: 'Destination' },
    { key: 'time_of_day', label: 'Time of day' },
  ],
  symptom: [
    { key: 'symptom_type', label: 'Symptom' },
    { key: 'time_of_day', label: 'Time of day' },
  ],
  mood: [{ key: 'time_of_day', label: 'Time of day' }],
  nurse_check: [
    { key: 'vital_type', label: 'Vital' },
    { key: 'vital_reading', label: 'Reading' },
    { key: 'vital_status', label: 'Status' },
  ],
  family_visit: [
    { key: 'visitor_type', label: 'Visitor' },
    { key: 'visit_reason', label: 'Reason' },
  ],
}

export interface AdlDetailItem {
  label: string
  value: string
}

/** Returns only the structured fields relevant to the record's ADL category. */
export function getAdlDetailsForRecord(record: AdlRecord): AdlDetailItem[] {
  const defs = CATEGORY_FIELD_DEFS[record.category] ?? []
  const items: AdlDetailItem[] = []
  for (const { key, label } of defs) {
    const raw = record[key]
    if (raw == null || raw === '') continue
    items.push({ label, value: String(raw) })
  }
  return items
}

export function formatAdlDetailsLine(record: AdlRecord): string {
  const items = getAdlDetailsForRecord(record)
  if (items.length === 0) return '—'
  return items.map((item) => `${item.label}: ${item.value}`).join(' · ')
}
