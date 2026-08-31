import { useCallback, useEffect, useMemo, useState } from 'react'

import { Download, Search, Users } from 'lucide-react'

import Button from '../../../../../shared/components/Button'

import AvailableDateSelect from '../../../components/AvailableDateSelect'

import CategoryBarChart, { type CategoryChartDatum } from '../../../components/CategoryBarChart'

import EmptyState from '../../../components/EmptyState'

import LoadingState from '../../../components/LoadingState'

import SectionHeader from '../../../components/SectionHeader'

import CategoryBadge from '../../../components/CategoryBadge'

import ObservationTable from '../../../components/ObservationTable'

import EditObservationModal from '../../../components/EditObservationModal'

import HandoverBriefView from '../../../components/HandoverBriefView'

import LiveClock from '../../../components/LiveClock'

import PeriodSummaryView from '../../../components/PeriodSummaryView'

import StatusBadge from '../../../components/StatusBadge'

import { useToast } from '../../../components/Toast'

import {

  downloadReport,

  fetchAssignmentHistory,

  fetchAudioUrl,

  fetchCaregivers,

  fetchCurrentAssignment,

  fetchDailyReport,

  fetchPeriodSummary,

  performHandover,

} from '../../../services/scribeApi'

import { fetchAlerts, fetchSupervisorPatients } from '../../../services/scribeSupabase'

import { usePatientAvailableDates, usePeriodDateSelection } from '../../../hooks/usePatientAvailableDates'

import { useSupervisorObservationActions } from '../../../hooks/useSupervisorObservationActions'

import { filterDatesForEnd, filterDatesForStart } from '../../../utils/dateRange'

import type {

  AdlAlert,

  AdlRecord,

  CaregiverSummary,

  DailyReportResponse,

  Patient,

  PatientAssignment,

} from '../../../types'

import { formatCategory } from '../../../utils/format'
import styles from '../../../styles/dashboard.module.css'



function groupRecordsByCategory(records: AdlRecord[]): Map<string, AdlRecord[]> {

  const groups = new Map<string, AdlRecord[]>()

  for (const record of records) {

    const key = record.category

    const list = groups.get(key) ?? []

    list.push(record)

    groups.set(key, list)

  }

  return groups

}



export default function PatientsTab({ initialPatientId = null }: { initialPatientId?: number | null }) {

  const { showError, showSuccess } = useToast()

  const [patients, setPatients] = useState<Patient[]>([])

  const [caregivers, setCaregivers] = useState<CaregiverSummary[]>([])

  const [search, setSearch] = useState('')

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)

  const [loadingPatients, setLoadingPatients] = useState(true)

  const [patientsError, setPatientsError] = useState<string | null>(null)



  const [dailyReportDate, setDailyReportDate] = useState('')

  const [dailyReport, setDailyReport] = useState<DailyReportResponse | null>(null)

  const [patientAlerts, setPatientAlerts] = useState<AdlAlert[]>([])

  const [currentAssignment, setCurrentAssignment] = useState<PatientAssignment | null>(null)

  const [assignmentHistory, setAssignmentHistory] = useState<PatientAssignment[]>([])

  const [loadingDetail, setLoadingDetail] = useState(false)

  const [detailError, setDetailError] = useState<string | null>(null)



  const [periodStartDate, setPeriodStartDate] = useState('')

  const [periodEndDate, setPeriodEndDate] = useState('')

  const [periodSummary, setPeriodSummary] = useState<string | null>(null)

  const [periodAudioUrl, setPeriodAudioUrl] = useState<string | null>(null)

  const [loadingPeriod, setLoadingPeriod] = useState(false)

  const [playingId, setPlayingId] = useState<string | null>(null)



  const [handoverTargetId, setHandoverTargetId] = useState('')

  const [handoverNotes, setHandoverNotes] = useState('')

  const [handoverSummary, setHandoverSummary] = useState<string | null>(null)

  const [performingHandover, setPerformingHandover] = useState(false)

  const { dates: availableDates, loading: availableDatesLoading } = usePatientAvailableDates({
    patientId: selectedPatientId ?? '',
  })

  usePeriodDateSelection(availableDates, periodStartDate, periodEndDate, setPeriodStartDate, setPeriodEndDate)

  useEffect(() => {
    if (availableDates.length === 0) {
      if (dailyReportDate) setDailyReportDate('')
      return
    }
    if (!availableDates.includes(dailyReportDate)) {
      setDailyReportDate(availableDates[availableDates.length - 1]!)
    }
  }, [availableDates, dailyReportDate])



  useEffect(() => {

    let isMounted = true

    Promise.all([fetchSupervisorPatients(), fetchCaregivers()])

      .then(([patientData, caregiverData]) => {

        if (!isMounted) return

        setPatients(patientData)

        setCaregivers(caregiverData)

        if (patientData.length > 0) {

          const preferredPatientId =
            initialPatientId != null &&
            patientData.some((patient) => patient.id === initialPatientId)
              ? initialPatientId
              : patientData[0]!.id

          setSelectedPatientId(preferredPatientId)

        }

      })

      .catch((err) => {

        if (!isMounted) return

        setPatientsError(err instanceof Error ? err.message : 'Failed to load patients.')

      })

      .finally(() => {

        if (isMounted) setLoadingPatients(false)

      })

    return () => {

      isMounted = false

    }

  }, [])



  useEffect(() => {

    if (initialPatientId == null || patients.length === 0) {

      return

    }

    if (patients.some((patient) => patient.id === initialPatientId)) {

      setSelectedPatientId(initialPatientId)

    }

  }, [initialPatientId, patients])



  const loadPatientDetail = useCallback(async (patientId: number, reportDate: string) => {

    setLoadingDetail(true)

    setDetailError(null)

    try {

      const [report, alerts, current, history] = await Promise.all([

        fetchDailyReport(patientId, reportDate),

        fetchAlerts('all'),

        fetchCurrentAssignment(patientId),

        fetchAssignmentHistory(patientId),

      ])

      setDailyReport(report)

      setPatientAlerts(alerts.filter((alert) => alert.patient_id === patientId && !alert.acknowledged))

      setCurrentAssignment(current)

      setAssignmentHistory(history)

    } catch (err) {

      setDetailError(err instanceof Error ? err.message : 'Failed to load patient detail.')

      setDailyReport(null)

      setPatientAlerts([])

      setCurrentAssignment(null)

      setAssignmentHistory([])

    } finally {

      setLoadingDetail(false)

    }

  }, [])



  const loadPeriodSummary = useCallback(

    async (patientId: number, startDate: string, endDate: string, regenerate = false) => {

      setLoadingPeriod(true)

      try {

        const summary = await fetchPeriodSummary(patientId, startDate, endDate, regenerate)

        setPeriodSummary(summary.summary_text)

        setPeriodAudioUrl(summary.audio_url)

      } catch (err) {

        showError(err instanceof Error ? err.message : 'Failed to load period summary.')

        setPeriodSummary(null)

        setPeriodAudioUrl(null)

      } finally {

        setLoadingPeriod(false)

      }

    },

    [showError],

  )

  const refreshRecords = useCallback(() => {
    if (selectedPatientId == null || !dailyReportDate) return
    void loadPatientDetail(selectedPatientId, dailyReportDate)
  }, [selectedPatientId, dailyReportDate, loadPatientDetail])

  const { editingRecord, setEditingRecord, handleDelete, handleSave, saving } =
    useSupervisorObservationActions(refreshRecords)



  useEffect(() => {

    if (selectedPatientId == null || !dailyReportDate) return

    void loadPatientDetail(selectedPatientId, dailyReportDate)

    if (!periodStartDate || !periodEndDate) {
      setPeriodSummary(null)
      setPeriodAudioUrl(null)
      return
    }

    void loadPeriodSummary(selectedPatientId, periodStartDate, periodEndDate)

  }, [

    selectedPatientId,

    dailyReportDate,

    loadPatientDetail,

    loadPeriodSummary,

    periodStartDate,

    periodEndDate,

  ])



  const filteredPatients = useMemo(() => {

    const query = search.trim().toLowerCase()

    if (!query) return patients

    return patients.filter(

      (patient) =>

        patient.patient_code.toLowerCase().includes(query) ||

        (patient.room_id?.toLowerCase().includes(query) ?? false),

    )

  }, [patients, search])



  const categoryGroups = useMemo(

    () => (dailyReport ? groupRecordsByCategory(dailyReport.records) : new Map()),

    [dailyReport],

  )



  const chartData = useMemo((): CategoryChartDatum[] => {

    if (!dailyReport) return []

    const counts = new Map<string, number>()

    for (const record of dailyReport.records) {

      const label = formatCategory(record.category)

      counts.set(label, (counts.get(label) ?? 0) + 1)

    }

    return [...counts.entries()].map(([category, count]) => ({ category, count }))

  }, [dailyReport])



  const handlePlay = async (record: AdlRecord) => {

    if (!record.r2_audio_key) {

      showError('Audio unavailable.')

      return

    }

    try {

      setPlayingId(record.id)

      const url = await fetchAudioUrl(record.patient_id, record.id)

      const audio = new Audio(url)

      audio.onended = () => setPlayingId(null)

      audio.onerror = () => {

        setPlayingId(null)

        showError('Playback failed.')

      }

      await audio.play()

    } catch (err) {

      setPlayingId(null)

      showError(err instanceof Error ? err.message : 'Failed to load audio.')

    }

  }



  const handleHandover = async () => {

    if (!selectedPatientId || !handoverTargetId) {

      showError('Select a caregiver to hand over to.')

      return

    }

    setPerformingHandover(true)

    try {

      const result = await performHandover({

        patientId: selectedPatientId,

        toCaregiverId: handoverTargetId,

        handoverNotes: handoverNotes || undefined,

      })

      setHandoverSummary(result.summary_text)

      showSuccess('Patient handover completed.')

      setHandoverNotes('')

      setHandoverTargetId('')

      await loadPatientDetail(selectedPatientId, dailyReportDate)

    } catch (err) {

      showError(err instanceof Error ? err.message : 'Handover failed.')

    } finally {

      setPerformingHandover(false)

    }

  }



  const handleExport = async (format: 'pdf' | 'excel') => {

    if (!selectedPatientId) return

    try {

      const blob = await downloadReport(selectedPatientId, periodStartDate, periodEndDate, format)

      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')

      link.href = url

      link.download = `report_${periodStartDate}_${periodEndDate}.${format === 'pdf' ? 'pdf' : 'xlsx'}`

      link.click()

      URL.revokeObjectURL(url)

    } catch (err) {

      showError(err instanceof Error ? err.message : 'Export failed.')

    }

  }



  if (loadingPatients) {

    return <LoadingState message="Loading patients…" />

  }



  if (patientsError) {

    return <p className={styles.errorText}>{patientsError}</p>

  }



  if (patients.length === 0) {

    return (

      <EmptyState

        icon={Users}

        title="No patients found"

        description="Add patient rows in Supabase to enable ADL monitoring."

      />

    )

  }



  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId)



  return (

    <div className={styles.page}>

      <div className={styles.patientsLayout}>

        <aside className={styles.sidebarPanel}>

          <SectionHeader

            title="Patients"

            description="Select a patient to view ADL reports and summaries."

          />

          <label className={styles.searchField}>

            <Search

              size={16}

              className={styles.searchIcon}

              aria-hidden="true"

            />

            <input

              type="search"

              placeholder="Search by code or room…"

              value={search}

              onChange={(event) => setSearch(event.target.value)}

              className={styles.searchInput}

            />

          </label>

          <ul className={styles.patientList}>

            {filteredPatients.map((patient) => (

              <li key={patient.id}>

                <button

                  type="button"

                  onClick={() => setSelectedPatientId(patient.id)}

                  className={`${styles.patientListItem} ${

                    selectedPatientId === patient.id ? styles.patientListItemActive : ''

                  }`}

                >

                  {patient.patient_code}

                  {patient.room_id ? (

                    <span className={styles.patientListMeta}>

                      Room {patient.room_id}

                    </span>

                  ) : null}

                </button>

              </li>

            ))}

          </ul>

        </aside>



        <div className="min-w-0 flex-1 flex flex-col gap-5">

          {selectedPatient && (

            <header className={styles.profileStrip}>

              <div>

                <h2 className={styles.profileName}>{selectedPatient.patient_code}</h2>

                <p className={styles.profileMeta}>

                  {selectedPatient.room_id

                    ? `Room ${selectedPatient.room_id}`

                    : 'No room assigned'}

                  {selectedPatient.gender ? ` · ${selectedPatient.gender}` : ''}

                  {currentAssignment?.caregiver_name

                    ? ` · Caregiver: ${currentAssignment.caregiver_name}`

                    : ' · No caregiver assigned'}

                </p>

              </div>

              <div className={styles.profileActions}>
                {patientAlerts.length > 0 ? (

                  <StatusBadge

                    variant="alert"

                    label={`${patientAlerts.length} open alert${patientAlerts.length === 1 ? '' : 's'}`}

                  />

                ) : (

                  <StatusBadge variant="normal" label="No open alerts" />

                )}

                <LiveClock />
              </div>

            </header>

          )}



          {selectedPatient && (

            <section className={styles.card}>

              <SectionHeader

                title="Caregiver assignment"

                description="Current caregiver and assignment history."

              />

              {currentAssignment ? (

                <p className="text-sm text-slate-700">

                  <span className="font-medium">{selectedPatient.patient_code}</span>

                  {' → '}

                  <span className="font-medium">{currentAssignment.caregiver_name}</span>

                  <span className="text-[var(--text-secondary)]">

                    {' '}

                    (since {new Date(currentAssignment.assigned_at).toLocaleDateString()})

                  </span>

                </p>

              ) : (

                <p className="text-sm text-[var(--text-secondary)]">No current assignment.</p>

              )}

              {assignmentHistory.length > 1 && (

                <ul className="mt-3 flex flex-col gap-1 text-xs text-[var(--text-secondary)]">

                  {assignmentHistory.slice(1, 6).map((row) => (

                    <li key={row.id}>

                      {row.caregiver_name} ·{' '}

                      {new Date(row.assigned_at).toLocaleDateString()}

                      {row.ended_at ? ` – ${new Date(row.ended_at).toLocaleDateString()}` : ''}

                    </li>

                  ))}

                </ul>

              )}

            </section>

          )}



          {selectedPatient && (

            <section className={styles.card}>

              <SectionHeader

                title="Patient handover"

                description="Transfer this patient to another caregiver. History is preserved."

              />

              <div className="flex flex-wrap items-end gap-3">

                <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm font-medium text-slate-700">

                  New caregiver

                  <select

                    value={handoverTargetId}

                    onChange={(e) => setHandoverTargetId(e.target.value)}

                    className={styles.fieldSelect}

                  >

                    <option value="">Select caregiver…</option>

                    {caregivers

                      .filter((cg) => cg.id !== currentAssignment?.caregiver_id)

                      .map((cg) => (

                        <option key={cg.id} value={cg.id}>

                          {cg.display_name}

                        </option>

                      ))}

                  </select>

                </label>

                <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm font-medium text-slate-700">

                  Notes (optional)

                  <input

                    type="text"

                    value={handoverNotes}

                    onChange={(e) => setHandoverNotes(e.target.value)}

                    className={styles.fieldSelect}

                    placeholder="Handover notes…"

                  />

                </label>

                <Button

                  onClick={() => void handleHandover()}

                  disabled={performingHandover || !handoverTargetId}

                >

                  Initiate handover

                </Button>

              </div>

              {handoverSummary && (
                <HandoverBriefView summaryText={handoverSummary} />
              )}

            </section>

          )}



          {loadingDetail ? (

            <LoadingState message="Loading patient detail…" />

          ) : detailError ? (

            <p className={styles.errorText}>{detailError}</p>

          ) : dailyReport ? (

            <>

              {patientAlerts.length > 0 && (

                <section className={styles.alertBanner}>

                  <h3 className="text-sm font-semibold text-red-800">Open alerts</h3>

                  <ul className="mt-2 flex flex-col gap-1 text-sm text-red-700">

                    {patientAlerts.map((alert) => (

                      <li key={alert.id}>

                        Alert raised {new Date(alert.created_at).toLocaleString()}

                      </li>

                    ))}

                  </ul>

                </section>

              )}



              <section className={styles.card}>

                <SectionHeader

                  title="Daily report"

                  description="Observations for the selected date."

                  action={

                    <AvailableDateSelect

                      label="Report date"

                      value={dailyReportDate}

                      dates={availableDates}

                      onChange={setDailyReportDate}

                      disabled={availableDatesLoading}

                    />

                  }

                />

                {chartData.length > 0 && (

                  <div className="mb-4">

                    <CategoryBarChart data={chartData} height={200} />

                  </div>

                )}

                {dailyReport.records.length === 0 ? (

                  <p className="text-sm text-[var(--text-secondary)]">

                    No observations on {dailyReport.report_date}.

                  </p>

                ) : (

                  [...categoryGroups.entries()].map(([category, records]) => (

                    <div key={category} className="mb-6 flex flex-col gap-2">

                      <CategoryBadge category={category} />

                      <ObservationTable

                        records={records}

                        hideCategory

                        statusMode="review"

                        showManageActions

                        onEdit={setEditingRecord}

                        onDelete={(record) => void handleDelete(record)}

                        onPlay={handlePlay}

                        playingId={playingId}

                      />

                    </div>

                  ))

                )}

              </section>

            </>

          ) : null}



          <section className={styles.card}>

            <SectionHeader

              title="Period summary"

              description="Dynamic overview for the selected date range."

            />

            <div className="mb-4 flex flex-wrap items-end gap-3">

              <AvailableDateSelect

                label="Start date"

                value={periodStartDate}

                dates={filterDatesForStart(availableDates, periodEndDate)}

                onChange={setPeriodStartDate}

                disabled={availableDatesLoading}

              />

              <AvailableDateSelect

                label="End date"

                value={periodEndDate}

                dates={filterDatesForEnd(availableDates, periodStartDate)}

                onChange={setPeriodEndDate}

                disabled={availableDatesLoading}

              />

              <Button

                variant="secondary"

                onClick={() =>

                  selectedPatientId &&

                  void loadPeriodSummary(selectedPatientId, periodStartDate, periodEndDate, true)

                }

              >

                Regenerate

              </Button>

              <Button variant="secondary" onClick={() => void handleExport('pdf')}>

                <Download size={14} aria-hidden="true" />

                PDF

              </Button>

              <Button variant="secondary" onClick={() => void handleExport('excel')}>

                <Download size={14} aria-hidden="true" />

                Excel

              </Button>

            </div>



            {availableDatesLoading ? (

              <LoadingState message="Loading available dates…" />

            ) : availableDates.length === 0 ? (

              <p className="text-sm text-[var(--text-secondary)]">

                No observation dates are available for this patient yet.

              </p>

            ) : loadingPeriod ? (

              <LoadingState message="Generating period summary…" />

            ) : periodSummary ? (

              <PeriodSummaryView summaryText={periodSummary} audioUrl={periodAudioUrl} />

            ) : (

              <p className="text-sm text-[var(--text-secondary)]">

                No summary available for the selected period.

              </p>

            )}

          </section>

        </div>

      </div>

      {editingRecord && (
        <EditObservationModal
          record={editingRecord}
          saving={saving}
          onClose={() => setEditingRecord(null)}
          onSave={handleSave}
        />
      )}

    </div>

  )

}

