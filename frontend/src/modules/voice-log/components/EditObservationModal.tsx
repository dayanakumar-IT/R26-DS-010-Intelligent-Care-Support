import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import Button from '../../../shared/components/Button'
import type { AdlCategory, AdlRecord } from '../types'
import { CATEGORY_FIELD_DEFS } from '../utils/adlFields'
import { ADL_CATEGORY_OPTIONS, buildAdlRecordUpdate, type AdlRecordUpdate } from '../utils/adlRecordUpdate'
import { formatCategory } from '../utils/format'
import styles from '../styles/dashboard.module.css'

interface EditObservationModalProps {
  record: AdlRecord
  saving?: boolean
  onClose: () => void
  onSave: (recordId: string, patch: AdlRecordUpdate) => Promise<void>
}

function recordToFormValues(record: AdlRecord): Record<string, string | boolean> {
  return {
    cleaned_transcript: record.cleaned_transcript ?? record.raw_transcript ?? '',
    alert_required: record.alert_required,
    medication_name: record.medication_name ?? '',
    dosage: record.dosage ?? '',
    food_item: record.food_item ?? '',
    meal_type: record.meal_type ?? '',
    intake_level: record.intake_level ?? '',
    fluid_type: record.fluid_type ?? '',
    fluid_amount: record.fluid_amount ?? '',
    hygiene_activity: record.hygiene_activity ?? '',
    mobility_type: record.mobility_type ?? '',
    destination: record.destination ?? '',
    symptom_type: record.symptom_type ?? '',
    vital_type: record.vital_type ?? '',
    vital_reading: record.vital_reading ?? '',
    vital_status: record.vital_status ?? '',
    visitor_type: record.visitor_type ?? '',
    visit_reason: record.visit_reason ?? '',
    time_of_day: record.time_of_day ?? '',
  }
}

export default function EditObservationModal({
  record,
  saving = false,
  onClose,
  onSave,
}: EditObservationModalProps) {
  const [category, setCategory] = useState<AdlCategory>(record.category)
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    recordToFormValues(record),
  )

  useEffect(() => {
    setCategory(record.category)
    setValues(recordToFormValues(record))
  }, [record])

  const fieldDefs = useMemo(() => CATEGORY_FIELD_DEFS[category] ?? [], [category])

  const setField = (key: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const patch = buildAdlRecordUpdate(category, values)
    await onSave(record.id, patch)
  }

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modalPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-observation-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div>
            <h2 id="edit-observation-title" className={styles.modalTitle}>
              Edit observation
            </h2>
            <p className={styles.modalSubtitle}>
              Corrections are saved to the database and visible to all supervisors.
            </p>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className={styles.modalForm} onSubmit={(event) => void handleSubmit(event)}>
          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as AdlCategory)}
              className={styles.fieldSelect}
            >
              {ADL_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatCategory(option)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Transcript</span>
            <textarea
              value={String(values.cleaned_transcript ?? '')}
              onChange={(event) => setField('cleaned_transcript', event.target.value)}
              className={styles.fieldTextarea}
              rows={3}
              required
            />
          </label>

          {fieldDefs.map(({ key, label }) => (
            <label key={key} className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>{label}</span>
              {key === 'intake_level' ? (
                <select
                  value={String(values[key] ?? '')}
                  onChange={(event) => setField(key, event.target.value)}
                  className={styles.fieldSelect}
                >
                  <option value="">—</option>
                  <option value="full">Full</option>
                  <option value="partial">Partial</option>
                  <option value="refused">Refused</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={String(values[key] ?? '')}
                  onChange={(event) => setField(key, event.target.value)}
                  className={styles.fieldInput}
                />
              )}
            </label>
          ))}

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={Boolean(values.alert_required)}
              onChange={(event) => setField('alert_required', event.target.checked)}
            />
            <span>Flag for supervisor review (alert)</span>
          </label>

          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
