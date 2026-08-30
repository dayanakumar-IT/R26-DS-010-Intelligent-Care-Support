import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ClipboardList, LayoutDashboard, Mic, Users } from 'lucide-react'
import AvailableDateSelect from '../../../components/AvailableDateSelect'
import Button from '../../../../../shared/components/Button'
import CategoryBarChart, { type CategoryChartDatum } from '../../../components/CategoryBarChart'
import EmptyState from '../../../components/EmptyState'
import KpiCard from '../../../components/KpiCard'
import LoadingState from '../../../components/LoadingState'
import HandoverBriefView, { HandoverBriefHint } from '../../../components/HandoverBriefView'
import ObservationTable from '../../../components/ObservationTable'
import PeriodSummaryView from '../../../components/PeriodSummaryView'
import ProfileStrip from '../../../components/ProfileStrip'
import SectionHeader from '../../../components/SectionHeader'
import StatusBadge from '../../../components/StatusBadge'
import { fetchCaregiverRecords } from '../../../services/scribeSupabase'
import type { AdlRecord, Patient } from '../../../types'
import type { User } from '../../../../../types/user'
import { fetchHandoverSummary, fetchPeriodSummary } from '../../../services/scribeApi'
import { usePatientAvailableDates, usePeriodDateSelection } from '../../../hooks/usePatientAvailableDates'
import { filterDatesForEnd, filterDatesForStart } from '../../../utils/dateRange'
import { formatCategory, formatDateTime, startOfTodayIso } from '../../../utils/format'
import styles from '../../../styles/dashboard.module.css'

interface CaregiverDashboardTabProps {
  user: User
  caregiverId: string
  patients: Patient[]
  selectedPatientId: number | ''
  onPatientChange: (patientId: number | '') => void
  onStartRecording: () => void
}

export default function CaregiverDashboardTab({
  user,
  caregiverId,
  patients,
  selectedPatientId,
  onPatientChange,
  onStartRecording,
}: CaregiverDashboardTabProps) {
  const [todayRecords, setTodayRecords] = useState<AdlRecord[]>([])
  const [recentRecords, setRecentRecords] = useState<AdlRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [periodSummary, setPeriodSummary] = useState<string | null>(null)
  const [handoverSummary, setHandoverSummary] = useState<string | null>(null)

  const { dates: availableDates, loading: availableDatesLoading } = usePatientAvailableDates({
    patientId: selectedPatientId,
    caregiverId,
  })

  usePeriodDateSelection(availableDates, periodStart, periodEnd, setPeriodStart, setPeriodEnd)

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  )

  const loadData = useCallback(async () => {
    setError(null)
    try {
      const [todayData, recentData] = await Promise.all([
        fetchCaregiverRecords(caregiverId, { since: startOfTodayIso() }),
        fetchCaregiverRecords(caregiverId, { limit: 50 }),
      ])
      setTodayRecords(todayData)
      setRecentRecords(recentData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }, [caregiverId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (selectedPatientId === '' || !periodStart || !periodEnd) {
      setPeriodSummary(null)
      return
    }
    void fetchPeriodSummary(selectedPatientId, periodStart, periodEnd)
      .then((res) => setPeriodSummary(res.summary_text))
      .catch(() => setPeriodSummary(null))
    void fetchHandoverSummary(selectedPatientId, caregiverId)
      .then((res) => setHandoverSummary(res.summary_text))
      .catch(() => setHandoverSummary(null))
  }, [selectedPatientId, periodStart, periodEnd, caregiverId])

  const patientTodayRecords = useMemo(
    () =>
      selectedPatientId === ''
        ? todayRecords
        : todayRecords.filter((record) => record.patient_id === selectedPatientId),
    [todayRecords, selectedPatientId],
  )

  const flaggedToday = useMemo(
    () => patientTodayRecords.filter((record) => record.alert_required).length,
    [patientTodayRecords],
  )

  const chartData = useMemo((): CategoryChartDatum[] => {
    const counts = new Map<string, number>()
    for (const record of patientTodayRecords) {
      const label = formatCategory(record.category)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()].map(([category, count]) => ({ category, count }))
  }, [patientTodayRecords])

  const recentForPatient = useMemo(
    () =>
      selectedPatientId === ''
        ? recentRecords.slice(0, 8)
        : recentRecords.filter((record) => record.patient_id === selectedPatientId).slice(0, 8),
    [recentRecords, selectedPatientId],
  )

  const subtitle = [user.institution, user.ward].filter(Boolean).join(' · ')

  if (loading) {
    return <LoadingState message="Loading your dashboard…" />
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  return (
    <div className={styles.page}>
      <ProfileStrip
        name={user.name}
        role="Caregiver"
        subtitle={subtitle || 'Voice ADL logging'}
        badge={<StatusBadge variant="normal" label="On shift" />}
        showClock
      />

      <div className={styles.kpiGrid}>
        <KpiCard
          label={selectedPatient ? `Today · ${selectedPatient.patient_code}` : "Today's observations"}
          value={patientTodayRecords.length}
          hint="Recorded today"
          icon={ClipboardList}
          accent
        />
        <KpiCard
          label="Flagged today"
          value={flaggedToday}
          hint="Sent for supervisor review"
          icon={AlertTriangle}
          accent={flaggedToday > 0}
        />
        <KpiCard
          label="Assigned patients"
          value={patients.length}
          hint="Available for recording"
          icon={Users}
        />
        <KpiCard
          label="Total logged"
          value={recentRecords.length}
          hint="Your recent history"
          icon={LayoutDashboard}
        />
      </div>

      <div className={styles.twoColumn}>
        <section className={styles.card}>
          <SectionHeader
            title="Today's ADL breakdown"
            description={
              selectedPatient
                ? `Categories logged for ${selectedPatient.patient_code} today.`
                : 'Categories you have logged so far today.'
            }
          />
          <CategoryBarChart data={chartData} height={200} />
        </section>

        <section className={styles.card}>
          <SectionHeader
            title="New recording"
            description="Select a patient, then start a care activity on the Record tab."
          />
          <div className={styles.recordPanel}>
            <label className="mb-4 flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Patient
              <select
                value={selectedPatientId}
                onChange={(event) => onPatientChange(Number(event.target.value))}
                className={styles.fieldSelect}
              >
                {patients.length === 0 ? (
                  <option value="">No patients</option>
                ) : (
                  patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.patient_code}
                      {patient.room_id ? ` · Room ${patient.room_id}` : ''}
                    </option>
                  ))
                )}
              </select>
            </label>
            <Button onClick={onStartRecording} disabled={!selectedPatientId}>
              <Mic size={16} aria-hidden="true" />
              Go to Record tab
            </Button>
          </div>
        </section>
      </div>

      <section className={styles.card}>
        <SectionHeader
          title="Recent activity"
          description={
            selectedPatient
              ? `Latest observations for ${selectedPatient.patient_code}.`
              : 'Your latest voice observations.'
          }
        />
        {recentForPatient.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="No observations yet"
            description="Your recorded ADL entries will appear here."
          />
        ) : (
          <ObservationTable
            records={recentForPatient}
            showPatient
            showAdlDetails={false}
            formatRecordedAt={formatDateTime}
            getPatientCode={(patientId) =>
              patients.find((patient) => patient.id === patientId)?.patient_code ?? '—'
            }
          />
        )}
      </section>

      {selectedPatient && (
        <section className={styles.card}>
          <SectionHeader
            title="Date-range summary"
            description={`Period overview for ${selectedPatient.patient_code}.`}
          />
          <div className={styles.inlineFields}>
            <AvailableDateSelect
              label="Start"
              value={periodStart}
              dates={filterDatesForStart(availableDates, periodEnd)}
              onChange={setPeriodStart}
              disabled={availableDatesLoading}
            />
            <AvailableDateSelect
              label="End"
              value={periodEnd}
              dates={filterDatesForEnd(availableDates, periodStart)}
              onChange={setPeriodEnd}
              disabled={availableDatesLoading}
            />
          </div>
          {availableDatesLoading ? (
            <LoadingState message="Loading available dates…" />
          ) : availableDates.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              No observation dates are available for this patient yet.
            </p>
          ) : periodSummary ? (
            <PeriodSummaryView summaryText={periodSummary} />
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">No data for this period.</p>
          )}
        </section>
      )}

      {handoverSummary && selectedPatient && (
        <section className={styles.card}>
          <SectionHeader
            title="Handover brief"
            description={`Important context for caring for ${selectedPatient.patient_code}.`}
          />
          <HandoverBriefHint />
          <HandoverBriefView summaryText={handoverSummary} />
        </section>
      )}
    </div>
  )
}
