import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  LayoutDashboard,
  Users,
} from 'lucide-react'
import CategoryBarChart, { type CategoryChartDatum } from '../../../components/CategoryBarChart'
import DashboardChartAside from '../../../components/DashboardChartAside'
import EmptyState from '../../../components/EmptyState'
import KpiCard from '../../../components/KpiCard'
import LoadingState from '../../../components/LoadingState'
import OpenAlertsFeed from '../../../components/OpenAlertsFeed'
import ObservationTable from '../../../components/ObservationTable'
import EditObservationModal from '../../../components/EditObservationModal'
import ProfileStrip from '../../../components/ProfileStrip'
import SectionHeader from '../../../components/SectionHeader'
import StatusBadge from '../../../components/StatusBadge'
import {
  fetchAlerts,
  fetchAllAdlRecords,
  fetchSupervisorPatients,
  subscribeAdlAlerts,
  subscribeAdlRecords,
} from '../../../services/scribeSupabase'
import { useSupervisorObservationActions } from '../../../hooks/useSupervisorObservationActions'
import type { AdlAlert, AdlRecord, Patient } from '../../../types'
import type { User } from '../../../../../types/user'
import { formatCategory, formatDateTime, todayIso } from '../../../utils/format'
import styles from '../../../styles/dashboard.module.css'

interface DashboardTabProps {
  user: User
  onNavigateToAlerts?: () => void
  onNavigateToPatients?: (patientId?: number) => void
}

export default function DashboardTab({
  user,
  onNavigateToAlerts,
  onNavigateToPatients,
}: DashboardTabProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [records, setRecords] = useState<AdlRecord[]>([])
  const [alerts, setAlerts] = useState<AdlAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setError(null)
    try {
      const [patientData, recordData, alertData] = await Promise.all([
        fetchSupervisorPatients(),
        fetchAllAdlRecords(),
        fetchAlerts('open'),
      ])
      setPatients(patientData)
      setRecords(recordData)
      setAlerts(alertData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
    const unsubRecords = subscribeAdlRecords(() => void loadData())
    const unsubAlerts = subscribeAdlAlerts(() => void loadData())
    return () => {
      unsubRecords()
      unsubAlerts()
    }
  }, [loadData])

  const { editingRecord, setEditingRecord, handleDelete, handleSave, saving } =
    useSupervisorObservationActions(() => void loadData())

  const patientMap = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  )

  const today = todayIso()

  const todayRecords = useMemo(
    () => records.filter((record) => record.recorded_at.slice(0, 10) === today),
    [records, today],
  )

  const chartData = useMemo((): CategoryChartDatum[] => {
    const counts = new Map<string, number>()
    for (const record of records.slice(0, 200)) {
      const label = formatCategory(record.category)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [records])

  const patientStatus = useMemo(() => {
    const alertPatientIds = new Set(alerts.map((alert) => alert.patient_id))
    const lastObservation = new Map<number, string>()

    for (const record of records) {
      if (!lastObservation.has(record.patient_id)) {
        lastObservation.set(record.patient_id, record.recorded_at)
      }
    }

    return patients.map((patient) => ({
      patient,
      hasAlerts: alertPatientIds.has(patient.id),
      lastObservation: lastObservation.get(patient.id) ?? null,
    }))
  }, [alerts, patients, records])

  const recentActivity = useMemo(() => records.slice(0, 8), [records])

  const subtitle = [user.institution, user.ward].filter(Boolean).join(' · ')

  if (loading) {
    return <LoadingState message="Loading ADL monitoring dashboard…" />
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  return (
    <div className={styles.page}>
      <ProfileStrip
        name={user.name}
        role={user.role === 'admin' ? 'Administrator' : 'Supervisor'}
        subtitle={subtitle || 'ADL monitoring overview'}
        badge={
          alerts.length > 0 ? (
            <StatusBadge variant="alert" label={`${alerts.length} open alert${alerts.length === 1 ? '' : 's'}`} />
          ) : (
            <StatusBadge variant="normal" label="All clear" />
          )
        }
        showClock
      />

      <div className={styles.kpiGrid}>
        <KpiCard
          label="Open alerts"
          value={alerts.length}
          hint="Requires supervisor review"
          icon={AlertTriangle}
          accent={alerts.length > 0}
        />
        <KpiCard
          label="Patients monitored"
          value={patients.length}
          hint="Registered in facility"
          icon={Users}
        />
        <KpiCard
          label="Observations today"
          value={todayRecords.length}
          hint={`${today} (local)`}
          icon={ClipboardList}
        />
        <KpiCard
          label="Total observations"
          value={records.length}
          hint="Recent history loaded"
          icon={Activity}
        />
      </div>

      <div className={styles.twoColumn}>
        <section className={styles.card}>
          <SectionHeader
            title="Observations by category"
            description="Distribution across recent ADL records in the system."
          />
          <CategoryBarChart data={chartData} />
          <DashboardChartAside
            patients={patients}
            todayRecords={todayRecords}
            wardLabel={user.ward ?? undefined}
            onNavigateToPatients={onNavigateToPatients}
          />
        </section>

        <section className={`${styles.card} ${alerts.length > 0 ? styles.cardAlertsActive : ''}`}>
          <SectionHeader
            title="Open alerts"
            description="Symptom observations flagged for supervisor review."
          />
          <OpenAlertsFeed
            alerts={alerts}
            patientMap={patientMap}
            onViewAll={onNavigateToAlerts}
          />
        </section>
      </div>

      <section className={styles.card}>
        <SectionHeader
          title="Recent activity"
          description="Latest voice observations processed by the SCRIBE pipeline."
        />
        {recentActivity.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="No observations yet"
            description="Activity will appear here once caregivers begin recording."
          />
        ) : (
          <ObservationTable
            records={recentActivity}
            showPatient
            showAdlDetails={false}
            statusMode="review"
            showManageActions
            onEdit={setEditingRecord}
            onDelete={(record) => void handleDelete(record)}
            formatRecordedAt={formatDateTime}
            getPatientCode={(patientId) => patientMap.get(patientId)?.patient_code ?? '—'}
          />
        )}
      </section>

      {editingRecord && (
        <EditObservationModal
          record={editingRecord}
          saving={saving}
          onClose={() => setEditingRecord(null)}
          onSave={handleSave}
        />
      )}

      <section className={styles.card}>
        <SectionHeader
          title="Patient status"
          description="Live overview of all patients. Updates automatically via Supabase Realtime."
        />
        {patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients in the system"
            description="Patient rows must exist in Supabase before monitoring can begin."
          />
        ) : (
          <div className={styles.patientGrid}>
            {patientStatus.map(({ patient, hasAlerts, lastObservation }) => (
              <article key={patient.id} className={styles.patientCard}>
                <div className={styles.patientCardHeader}>
                  <div>
                    <h3 className={styles.patientCode}>{patient.patient_code}</h3>
                    <p className={styles.patientRoom}>
                      {patient.room_id ? `Room ${patient.room_id}` : 'No room assigned'}
                    </p>
                  </div>
                  {hasAlerts ? (
                    <StatusBadge variant="alert" label="Has alerts" />
                  ) : (
                    <StatusBadge variant="normal" label="Normal" />
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Last observation:{' '}
                  {lastObservation ? formatDateTime(lastObservation) : 'None recorded'}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
