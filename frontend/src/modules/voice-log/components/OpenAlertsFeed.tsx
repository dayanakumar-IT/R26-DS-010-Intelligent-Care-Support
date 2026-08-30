import { AlertTriangle, ArrowRight, Clock, UserRound } from 'lucide-react'
import type { AdlAlert, Patient } from '../types'
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
          description="New flagged symptom observations will appear here in real time."
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
          {alerts.length} symptom alert{alerts.length === 1 ? '' : 's'} awaiting review
        </span>
      </div>

      <ul className={styles.openAlertsList}>
        {visibleAlerts.map((alert) => {
          const patientCode =
            patientMap.get(alert.patient_id)?.patient_code ?? `Patient #${alert.patient_id}`
          const record = alert.adl_record
          const transcript = record?.cleaned_transcript ?? record?.raw_transcript ?? ''
          const symptomType = record?.symptom_type

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

                  <p className={styles.openAlertsHeadline}>
                    {symptomType
                      ? `${symptomType.charAt(0).toUpperCase()}${symptomType.slice(1)} reported`
                      : 'Symptom observation flagged'}
                  </p>

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
