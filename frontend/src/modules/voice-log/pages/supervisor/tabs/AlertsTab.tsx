import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2 } from 'lucide-react'
import Button from '../../../../../shared/components/Button'
import AlertActionEditor from '../../../components/AlertActionEditor'
import AlertObservationCell from '../../../components/AlertObservationCell'
import EmptyState from '../../../components/EmptyState'
import KpiCard from '../../../components/KpiCard'
import LoadingState from '../../../components/LoadingState'
import SectionHeader from '../../../components/SectionHeader'
import StatusBadge from '../../../components/StatusBadge'
import { useToast } from '../../../components/Toast'
import {
  acknowledgeAlert,
  fetchAlerts,
  fetchSupervisorPatients,
  subscribeAdlAlerts,
  subscribeAdlRecords,
  updateAlertSupervisorAction,
} from '../../../services/scribeSupabase'
import type { AdlAlert, Patient } from '../../../types'
import { formatDateTime } from '../../../utils/format'
import styles from '../../../styles/dashboard.module.css'

type AlertFilter = 'all' | 'open' | 'acknowledged'

interface AlertsTabProps {
  userId: string
}

export default function AlertsTab({ userId }: AlertsTabProps) {
  const { showSuccess, showError } = useToast()
  const [filter, setFilter] = useState<AlertFilter>('open')
  const [alerts, setAlerts] = useState<AdlAlert[]>([])
  const [allAlerts, setAllAlerts] = useState<AdlAlert[]>([])
  const [patients, setPatients] = useState<Map<number, Patient>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [savingActionId, setSavingActionId] = useState<string | null>(null)

  const loadAlerts = useCallback(async () => {
    setError(null)
    try {
      const [alertData, allData, patientData] = await Promise.all([
        fetchAlerts(filter),
        fetchAlerts('all'),
        fetchSupervisorPatients(),
      ])
      setAlerts(alertData)
      setAllAlerts(allData)
      setPatients(new Map(patientData.map((patient) => [patient.id, patient])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    void loadAlerts()
    const unsubAlerts = subscribeAdlAlerts(() => void loadAlerts())
    const unsubRecords = subscribeAdlRecords(() => void loadAlerts())
    return () => {
      unsubAlerts()
      unsubRecords()
    }
  }, [loadAlerts])

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledgingId(alertId)
    try {
      await acknowledgeAlert(alertId, userId)
      showSuccess('Alert acknowledged. You can now record the action taken.')
      await loadAlerts()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to acknowledge alert.')
    } finally {
      setAcknowledgingId(null)
    }
  }

  const handleSaveAction = async (alertId: string, notes: string) => {
    setSavingActionId(alertId)
    try {
      await updateAlertSupervisorAction(alertId, userId, notes)
      showSuccess('Action notes saved.')
      await loadAlerts()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save action notes.')
    } finally {
      setSavingActionId(null)
    }
  }

  const openCount = useMemo(
    () => allAlerts.filter((alert) => !alert.acknowledged).length,
    [allAlerts],
  )
  const ackCount = useMemo(
    () => allAlerts.filter((alert) => alert.acknowledged).length,
    [allAlerts],
  )

  const filterLabel = useMemo(() => {
    switch (filter) {
      case 'open':
        return 'Unacknowledged'
      case 'acknowledged':
        return 'Acknowledged'
      default:
        return 'All alerts'
    }
  }, [filter])

  if (loading) {
    return <LoadingState message="Loading alerts…" />
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className={styles.errorText}>{error}</p>
        <Button variant="secondary" onClick={() => void loadAlerts()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SectionHeader
        title="Symptom alerts"
        description="Flagged symptom observations requiring supervisor review. Acknowledge alerts, then record what action you took."
        action={
          <div className={styles.filterPillGroup} role="group" aria-label="Filter alerts">
            {(['open', 'acknowledged', 'all'] as AlertFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`${styles.filterPill} ${
                  filter === option ? styles.filterPillActive : ''
                }`}
              >
                {option === 'open' ? 'Unacknowledged' : option}
              </button>
            ))}
          </div>
        }
      />

      <div className={styles.kpiGridThree}>
        <KpiCard
          label="Open alerts"
          value={openCount}
          hint="Awaiting review"
          icon={AlertTriangle}
          accent={openCount > 0}
        />
        <KpiCard
          label="Acknowledged"
          value={ackCount}
          hint="Resolved this period"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Showing"
          value={alerts.length}
          hint={filterLabel.toLowerCase()}
          icon={Bell}
        />
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={`No ${filterLabel.toLowerCase()} alerts`}
          description="When the pipeline flags a symptom observation, it will appear here for supervisor review."
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.alertsTable}`}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Created</th>
                <th>Observation</th>
                <th>Status</th>
                <th className={styles.tableActionCol}>Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className={styles.tablePatientCell}>
                    {patients.get(alert.patient_id)?.patient_code ?? `Patient #${alert.patient_id}`}
                  </td>
                  <td className={styles.timeCell}>{formatDateTime(alert.created_at)}</td>
                  <td className={styles.alertObservationCell}>
                    <AlertObservationCell alert={alert} />
                  </td>
                  <td>
                    {alert.acknowledged ? (
                      <StatusBadge variant="normal" label="Acknowledged" />
                    ) : (
                      <StatusBadge variant="alert" label="Open" />
                    )}
                  </td>
                  <td className={styles.alertActionCell}>
                    <AlertActionEditor
                      alert={alert}
                      acknowledging={acknowledgingId === alert.id}
                      saving={savingActionId === alert.id}
                      onAcknowledge={(alertId) => void handleAcknowledge(alertId)}
                      onSaveAction={(alertId, notes) => void handleSaveAction(alertId, notes)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
