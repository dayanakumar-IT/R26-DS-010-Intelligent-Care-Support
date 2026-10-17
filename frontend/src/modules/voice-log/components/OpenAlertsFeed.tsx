import { AlertTriangle, ArrowRight, Clock, UserRound } from 'lucide-react'
import type { AdlAlert, AdlRecord, Patient } from '../types'
import { formatDateTime } from '../utils/format'
import CategoryBadge from './CategoryBadge'
import EmptyState from './EmptyState'
import styles from '../styles/dashboard.module.css'

interface OpenAlertsFeedProps {
  alerts: AdlAlert[]
  patientMap: Map<number, Patient>
  maxItems?: number
  onViewAll?: () => void
}

function truncateText(text: string, maxLength = 72): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}

function capitalize(text: string): string {
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text
}

/** Alerts can now come from any category (Change 3c), not just symptoms —
 * build a headline that makes sense for meal/nurse_check alerts too. */
function alertHeadline(record: AdlRecord | null | undefined): string {
  if (!record) {
    return 'Observation flagged for review'
  }
  switch (record.category) {
    case 'symptom':
      return record.symptom_type ? `${capitalize(record.symptom_type)} reported` : 'Symptom observation flagged'
    case 'meal':
      return record.intake_level
        ? `${capitalize(record.intake_level)} meal intake flagged`
        : 'Meal intake flagged'
    case 'nurse_check': {
      const reading = [record.vital_type, record.vital_reading].filter(Boolean).join(' ')
      return record.vital_status
        ? `Vitals flagged${reading ? `: ${reading}` : ''} (${record.vital_status})`
        : 'Vitals flagged for review'
    }
    default:
      return 'Observation flagged for review'
  }
}

export default function OpenAlertsFeed({
  alerts,
  patientMap,
  maxItems = 6,
  onViewAll,
}: OpenAlertsFeedProps) {
  const visibleAlerts = alerts.slice(0, maxItems)
  const overflowCount = Math.max(0, alerts.length - maxItems)

  if (alerts.length === 0) {
    return (
      <div className={styles.openAlertsEmpty}>
        <EmptyState
          icon={AlertTriangle}
          title="No open alerts"
          description="New flagged observations will appear here in real time."
        />
      </div>
    )
  }

  return (
    <div className={styles.openAlertsFeed}>
      <div className={styles.openAlertsSummary}>
        <span className={styles.openAlertsLiveBadge}>
          <span className={styles.openAlertsLiveDot} aria-hidden />
          Live
        </span>
        <span className={styles.openAlertsSummaryText}>
          {alerts.length} alert{alerts.length === 1 ? '' : 's'} awaiting review
        </span>
      </div>

      <ul className={styles.openAlertsList}>
        {visibleAlerts.map((alert) => {
          const patientCode =
            patientMap.get(alert.patient_id)?.patient_code ?? `Patient #${alert.patient_id}`
          const record = alert.adl_record
          const transcript = record?.cleaned_transcript ?? record?.raw_transcript ?? ''
          const headline = alertHeadline(record)

          return (
            <li key={alert.id}>
              <article className={styles.openAlertsItem}>
                <div className={styles.openAlertsIconWrap} aria-hidden>
                  <AlertTriangle size={18} strokeWidth={2.25} />
                </div>

                <div className={styles.openAlertsBody}>
                  <div className={styles.openAlertsTopRow}>
                    <div className={styles.openAlertsMeta}>
                      <span className={styles.openAlertsPatientChip}>
                        <UserRound size={12} strokeWidth={2.25} aria-hidden />
                        {patientCode}
                      </span>
                      {record?.category ? <CategoryBadge category={record.category} /> : null}
                    </div>
                    <time className={styles.openAlertsTime} dateTime={alert.created_at}>
                      <Clock size={12} strokeWidth={2.25} aria-hidden />
                      {formatDateTime(alert.created_at)}
                    </time>
                  </div>

                  <p className={styles.openAlertsHeadline}>{headline}</p>

                  {transcript ? (
                    <p className={styles.openAlertsTranscript}>{truncateText(transcript)}</p>
                  ) : (
                    <p className={styles.openAlertsTranscriptMuted}>
                      Open the Alerts tab to review full details.
                    </p>
                  )}

                  {onViewAll ? (
                    <button type="button" className={styles.openAlertsAction} onClick={onViewAll}>
                      Review in Alerts
                      <ArrowRight size={14} strokeWidth={2.25} aria-hidden />
                    </button>
                  ) : (
                    <p className={styles.openAlertsHint}>Review in the Alerts tab</p>
                  )}
                </div>
              </article>
            </li>
          )
        })}
      </ul>

      {overflowCount > 0 && onViewAll ? (
        <button type="button" className={styles.openAlertsViewAll} onClick={onViewAll}>
          View {overflowCount} more alert{overflowCount === 1 ? '' : 's'}
          <ArrowRight size={15} strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
