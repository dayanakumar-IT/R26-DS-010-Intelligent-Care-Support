import { useCallback, useState } from 'react'
import { useToast } from '../components/Toast'
import { deleteAdlRecord, updateAdlRecord } from '../services/scribeSupabase'
import type { AdlRecord } from '../types'
import type { AdlRecordUpdate } from '../utils/adlRecordUpdate'

export function useSupervisorObservationActions(onChanged: () => void) {
  const { showSuccess, showError } = useToast()
  const [editingRecord, setEditingRecord] = useState<AdlRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const handleDelete = useCallback(
    async (record: AdlRecord) => {
      const confirmed = window.confirm(
        'Delete this observation? This will permanently remove it from the database and cannot be undone.',
      )
      if (!confirmed) return

      try {
        await deleteAdlRecord(record.id)
        showSuccess('Observation deleted.')
        onChanged()
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to delete observation.')
      }
    },
    [onChanged, showError, showSuccess],
  )

  const handleSave = useCallback(
    async (recordId: string, patch: AdlRecordUpdate) => {
      setSaving(true)
      try {
        await updateAdlRecord(recordId, patch)
        showSuccess('Observation updated.')
        setEditingRecord(null)
        onChanged()
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to update observation.')
      } finally {
        setSaving(false)
      }
    },
    [onChanged, showError, showSuccess],
  )

  return {
    editingRecord,
    setEditingRecord,
    handleDelete,
    handleSave,
    saving,
  }
}
