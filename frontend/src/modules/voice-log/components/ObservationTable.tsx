import { Play } from 'lucide-react'
import Button from '../../../shared/components/Button'
import type { AdlRecord } from '../types'
import { formatTime } from '../utils/format'
import styles from '../styles/dashboard.module.css'
import AdlDetailsList from './AdlDetailsList'
import CategoryBadge from './CategoryBadge'
import ObservationRowMenu from './ObservationRowMenu'
import StatusBadge from './StatusBadge'

interface ObservationTableProps {
  records: AdlRecord[]
  playingId?: string | null
  onPlay?: (record: AdlRecord) => void
  onEdit?: (record: AdlRecord) => void
  onDelete?: (record: AdlRecord) => void
  showManageActions?: boolean
  showPatient?: boolean
  getPatientCode?: (patientId: number) => string
  showAdlDetails?: boolean
  showProcessingStatus?: boolean
  hideCategory?: boolean
  statusMode?: 'sync' | 'review' | 'processing'
  formatRecordedAt?: (iso: string) => string
}

function syncStatus(record: AdlRecord) {
  if (record.alert_required) {
    return <StatusBadge variant="alert" label="Flagged" />
  }
  if (record.cleaned_transcript) {
    return <StatusBadge variant="synced" label="Synced" />
  }
  if (record.raw_transcript) {
    return <StatusBadge variant="processing" label="Processing" />
  }
  return <StatusBadge variant="pending" label="Pending" />
}

function processingStatus(record: AdlRecord) {
  const status = record.cleaned_transcript ? (
    <StatusBadge variant="synced" label="Processed" />
  ) : record.raw_transcript ? (
    <StatusBadge variant="processing" label="Partial" />
  ) : (
    <StatusBadge variant="pending" label="Pending" />
  )
  if (!record.alert_required) {
    return status
  }
  return (
    <span className={styles.statusGroup}>
      {status}
      <StatusBadge variant="alert" label="Flagged" />
    </span>
  )
}

function reviewStatus(record: AdlRecord) {
  if (record.alert_required) {
    return <StatusBadge variant="alert" label="Flagged" />
  }
  return <StatusBadge variant="normal" label="Normal" />
}

export default function ObservationTable({
  records,
  playingId,
  onPlay,
  onEdit,
  onDelete,
  showManageActions = false,
  showPatient = false,
  getPatientCode,
  showAdlDetails = true,
  showProcessingStatus = false,
  hideCategory = false,
  statusMode = 'sync',
  formatRecordedAt = formatTime,
}: ObservationTableProps) {
  const renderStatus = (record: AdlRecord) => {
    if (statusMode === 'processing' || showProcessingStatus) {
      return processingStatus(record)
    }
    if (statusMode === 'review') {
      return reviewStatus(record)
    }
    return syncStatus(record)
  }

  const showActions = showManageActions && (onEdit != null || onDelete != null)

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {showPatient && <th>Patient</th>}
            {!hideCategory && <th>Category</th>}
            <th>Transcript</th>
            {showAdlDetails && <th>Extracted ADL</th>}
            <th>Time</th>
            <th>Status</th>
            {(onPlay || showActions) && <th className={styles.tableActionCol}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              {showPatient && (
                <td className={styles.tablePatientCell}>
                  {getPatientCode?.(record.patient_id) ?? '—'}
                </td>
              )}
              {!hideCategory && (
                <td>
                  <CategoryBadge category={record.category} />
                </td>
              )}
              <td className={styles.transcriptCell}>
                <span className={styles.transcriptText}>
                  {record.cleaned_transcript ?? record.raw_transcript ?? '—'}
                </span>
              </td>
              {showAdlDetails && (
                <td className={styles.adlCell}>
                  <AdlDetailsList record={record} />
                </td>
              )}
              <td className={styles.timeCell}>{formatRecordedAt(record.recorded_at)}</td>
              <td>{renderStatus(record)}</td>
              {(onPlay || showActions) && (
                <td className={styles.tableActionCol}>
                  <div className={styles.tableActions}>
                    {onPlay && (
                      <Button
                        variant="secondary"
                        disabled={!record.r2_audio_key || playingId === record.id}
                        onClick={() => onPlay(record)}
                        className={styles.tableActionButton}
                      >
                        <Play size={14} aria-hidden="true" />
                        {playingId === record.id ? 'Playing…' : 'Play'}
                      </Button>
                    )}
                    {showActions ? (
                      <ObservationRowMenu record={record} onEdit={onEdit} onDelete={onDelete} />
                    ) : null}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
