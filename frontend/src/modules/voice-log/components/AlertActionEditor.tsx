import { useEffect, useState } from 'react'
import Button from '../../../shared/components/Button'
import type { AdlAlert } from '../types'
import styles from '../styles/dashboard.module.css'

interface AlertActionEditorProps {
  alert: AdlAlert
  acknowledging?: boolean
  saving?: boolean
  onAcknowledge: (alertId: string) => void
  onSaveAction: (alertId: string, notes: string) => void
}

export default function AlertActionEditor({
  alert,
  acknowledging = false,
  saving = false,
  onAcknowledge,
  onSaveAction,
}: AlertActionEditorProps) {
  const [notes, setNotes] = useState(alert.supervisor_action ?? '')

  useEffect(() => {
    setNotes(alert.supervisor_action ?? '')
  }, [alert.id, alert.supervisor_action])

  if (!alert.acknowledged) {
    return (
      <Button
        variant="secondary"
        disabled={acknowledging}
        onClick={() => onAcknowledge(alert.id)}
        className={styles.tableActionButton}
      >
        {acknowledging ? 'Saving…' : 'Acknowledge'}
      </Button>
    )
  }

  const trimmed = notes.trim()
  const unchanged = trimmed === (alert.supervisor_action ?? '').trim()

  return (
    <div className={styles.alertActionEditor}>
      <label className={styles.srOnly} htmlFor={`alert-action-${alert.id}`}>
        Supervisor action notes
      </label>
      <textarea
        id={`alert-action-${alert.id}`}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Describe what you did (e.g. updated the observation, contacted nurse)…"
        className={styles.alertActionTextarea}
        rows={3}
      />
      <div className={styles.alertActionFooter}>
        {alert.action_updated_at ? (
          <span className={styles.alertActionMeta}>
            Last saved {new Date(alert.action_updated_at).toLocaleString()}
          </span>
        ) : (
          <span className={styles.alertActionMeta}>Not saved yet</span>
        )}
        <Button
          variant="secondary"
          disabled={saving || unchanged}
          onClick={() => onSaveAction(alert.id, trimmed)}
          className={styles.tableActionButton}
        >
          {saving ? 'Saving…' : 'Save action'}
        </Button>
      </div>
    </div>
  )
}
