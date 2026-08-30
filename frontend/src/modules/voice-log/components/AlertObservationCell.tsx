import type { AdlAlert } from '../types'
import styles from '../styles/dashboard.module.css'
import AdlDetailsList from './AdlDetailsList'
import CategoryBadge from './CategoryBadge'

interface AlertObservationCellProps {
  alert: AdlAlert
}

export default function AlertObservationCell({ alert }: AlertObservationCellProps) {
  const record = alert.adl_record

  if (!record) {
    return (
      <p className={styles.alertObservationMissing}>
        Linked observation is no longer available.
      </p>
    )
  }

  const transcript = record.cleaned_transcript ?? record.raw_transcript

  return (
    <div className={styles.alertObservation}>
      <div className={styles.alertObservationMeta}>
        <CategoryBadge category={record.category} />
      </div>
      {transcript ? (
        <p className={styles.alertObservationTranscript}>{transcript}</p>
      ) : (
        <p className={styles.mutedText}>No transcript available.</p>
      )}
      <AdlDetailsList record={record} />
    </div>
  )
}
