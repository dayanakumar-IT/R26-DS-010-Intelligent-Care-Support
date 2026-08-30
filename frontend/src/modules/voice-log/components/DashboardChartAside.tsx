import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ClipboardList, FileText, UserX } from 'lucide-react'
import type { AdlRecord, Patient } from '../types'
import { fetchLatestWardHandover } from '../services/scribeSupabase'
import { formatDateTime } from '../utils/format'
import styles from '../styles/dashboard.module.css'

const MAX_PATIENT_CHIPS = 8

interface DashboardChartAsideProps {
  patients: Patient[]
  todayRecords: AdlRecord[]
  wardLabel?: string
  onNavigateToPatients?: (patientId?: number) => void
}

function handoverPreviewLine(summaryText: string): string {
  const line = summaryText
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.length > 0 && !value.startsWith('═'))
  if (!line) {
    return 'Handover brief available for review.'
  }
  return line.length > 90 ? `${line.slice(0, 89).trimEnd()}…` : line
}

export default function DashboardChartAside({
  patients,
  todayRecords,
  wardLabel,
  onNavigateToPatients,
}: DashboardChartAsideProps) {
  const [latestHandover, setLatestHandover] = useState<Awaited<
    ReturnType<typeof fetchLatestWardHandover>
  > | null>(null)
  const [handoverLoading, setHandoverLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    setHandoverLoading(true)
    void fetchLatestWardHandover()
      .then((result) => {
        if (isMounted) {
          setLatestHandover(result)
        }
      })
      .catch(() => {
        if (isMounted) {
          setLatestHandover(null)
        }
      })
      .finally(() => {
        if (isMounted) {
          setHandoverLoading(false)
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  const patientsNotLoggedToday = useMemo(() => {
    const loggedIds = new Set(todayRecords.map((record) => record.patient_id))
    return patients.filter((patient) => !loggedIds.has(patient.id))
  }, [patients, todayRecords])

  const visiblePatients = patientsNotLoggedToday.slice(0, MAX_PATIENT_CHIPS)
  const overflowCount = Math.max(0, patientsNotLoggedToday.length - MAX_PATIENT_CHIPS)

  return (
    <div className={styles.chartAside}>
      <article className={styles.chartAsidePanel}>
        <header className={styles.chartAsideHeader}>
          <span className={`${styles.chartAsideIcon} ${styles.chartAsideIconMuted}`} aria-hidden>
            <UserX size={16} strokeWidth={2.25} />
          </span>
          <div className={styles.chartAsideHeading}>
            <h3 className={styles.chartAsideTitle}>Not logged today</h3>
            <p className={styles.chartAsideDescription}>
              {patientsNotLoggedToday.length === 0
                ? 'Every patient has at least one observation today.'
                : `${patientsNotLoggedToday.length} patient${
                    patientsNotLoggedToday.length === 1 ? '' : 's'
                  } without observations today.`}
            </p>
          </div>
          {patientsNotLoggedToday.length > 0 ? (
            <span className={styles.chartAsideCount}>{patientsNotLoggedToday.length}</span>
          ) : null}
        </header>

        {patientsNotLoggedToday.length > 0 ? (
          <>
            <ul className={styles.chartAsideChipList}>
              {visiblePatients.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    className={styles.chartAsideChip}
                    onClick={() => onNavigateToPatients?.(patient.id)}
                  >
                    {patient.patient_code}
                  </button>
                </li>
              ))}
              {overflowCount > 0 ? (
                <li>
                  <span className={styles.chartAsideChipMore}>+{overflowCount} more</span>
                </li>
              ) : null}
            </ul>
            <button
              type="button"
              className={styles.chartAsideAction}
              onClick={() => onNavigateToPatients?.()}
            >
              View in Patients
              <ArrowRight size={14} strokeWidth={2.25} aria-hidden />
            </button>
          </>
        ) : (
          <p className={styles.chartAsideEmpty}>All patients are up to date for today.</p>
        )}
      </article>

      <article className={`${styles.chartAsidePanel} ${styles.chartAsidePanelAccent}`}>
        <header className={styles.chartAsideHeader}>
          <span className={`${styles.chartAsideIcon} ${styles.chartAsideIconAccent}`} aria-hidden>
            <ClipboardList size={16} strokeWidth={2.25} />
          </span>
          <div className={styles.chartAsideHeading}>
            <h3 className={styles.chartAsideTitle}>Shift handover</h3>
            <p className={styles.chartAsideDescription}>
              {wardLabel ? `${wardLabel} · ` : ''}
              Generate a caregiver handover brief from the Patients tab.
            </p>
          </div>
        </header>

        {handoverLoading ? (
          <p className={styles.chartAsideEmpty}>Loading last handover…</p>
        ) : latestHandover ? (
          <div className={styles.chartAsideHandoverMeta}>
            <div className={styles.chartAsideHandoverRow}>
              <FileText size={14} strokeWidth={2.25} aria-hidden />
              <span>
                Last brief: <strong>{latestHandover.patient_code}</strong>
              </span>
            </div>
            <p className={styles.chartAsideHandoverTime}>
              Generated {formatDateTime(latestHandover.handover_at)}
            </p>
            <p className={styles.chartAsideHandoverPreview}>
              {handoverPreviewLine(latestHandover.summary_text)}
            </p>
          </div>
        ) : (
          <p className={styles.chartAsideEmpty}>No handover briefs generated yet.</p>
        )}

        <button
          type="button"
          className={styles.chartAsideActionPrimary}
          onClick={() =>
            onNavigateToPatients?.(latestHandover?.patient_id ?? undefined)
          }
        >
          Generate handover brief
          <ArrowRight size={14} strokeWidth={2.25} aria-hidden />
        </button>
      </article>
    </div>
  )
}
