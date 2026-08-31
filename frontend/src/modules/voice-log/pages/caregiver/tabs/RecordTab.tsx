import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Mic, Square } from 'lucide-react'
import Button from '../../../../../shared/components/Button'
import CategoryBadge from '../../../components/CategoryBadge'
import EmptyState from '../../../components/EmptyState'
import LoadingState from '../../../components/LoadingState'
import ProfileStrip from '../../../components/ProfileStrip'
import SectionHeader from '../../../components/SectionHeader'
import StatusBadge from '../../../components/StatusBadge'
import { useToast } from '../../../components/Toast'
import { fetchPatients, startCareActivity as apiStartCareActivity, completeCareActivity, uploadObservation } from '../../../services/scribeApi'
import { fetchCaregiverRecords } from '../../../services/scribeSupabase'
import type {
  AdlRecord,
  CareActivityPhase,
  Patient,
  PendingRecording,
  SyncStatus,
} from '../../../types'
import type { User } from '../../../../../types/user'
import { formatTime, startOfTodayIso } from '../../../utils/format'
import styles from '../../../styles/dashboard.module.css'

interface RecordTabProps {
  caregiverId: string
  user: User
  patients: Patient[]
  selectedPatientId: number | ''
  onPatientChange: (patientId: number | '') => void
  onPatientsLoaded: (patients: Patient[]) => void
}

const PHASE_LABELS: Record<CareActivityPhase, string> = {
  idle: 'Ready to start',
  in_progress: 'Care activity in progress',
  processing: 'Processing recording',
  completed: 'Care activity completed',
}

export default function RecordTab({
  caregiverId,
  user,
  patients,
  selectedPatientId,
  onPatientChange,
  onPatientsLoaded,
}: RecordTabProps) {
  const { showSuccess, showError } = useToast()
  const [loadingPatients, setLoadingPatients] = useState(patients.length === 0)
  const [patientsError, setPatientsError] = useState<string | null>(null)

  const [careActivityPhase, setCareActivityPhase] = useState<CareActivityPhase>('idle')
  const [todayRecords, setTodayRecords] = useState<AdlRecord[]>([])
  const [loadingToday, setLoadingToday] = useState(true)
  const [pendingQueue, setPendingQueue] = useState<PendingRecording[]>([])
  const [dailySummary, setDailySummary] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const careActivityIdRef = useRef<string | null>(null)

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  )

  const loadTodayRecords = useCallback(async () => {
    setLoadingToday(true)
    try {
      const records = await fetchCaregiverRecords(caregiverId, {
        since: startOfTodayIso(),
        patientId: selectedPatientId === '' ? undefined : selectedPatientId,
      })
      setTodayRecords(records)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load today's recordings.")
    } finally {
      setLoadingToday(false)
    }
  }, [caregiverId, selectedPatientId, showError])

  useEffect(() => {
    if (patients.length > 0) {
      setLoadingPatients(false)
      return
    }
    let isMounted = true
    setLoadingPatients(true)
    fetchPatients(caregiverId)
      .then((data) => {
        if (!isMounted) return
        onPatientsLoaded(data)
        if (data.length > 0 && !selectedPatientId) {
          onPatientChange(data[0]!.id)
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
  }, [patients.length, caregiverId, onPatientsLoaded, onPatientChange, selectedPatientId])

  useEffect(() => {
    void loadTodayRecords()
  }, [loadTodayRecords])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current)
      }
    }
  }, [])

  const patientFilteredPending = useMemo(
    () =>
      selectedPatientId === ''
        ? []
        : pendingQueue.filter((item) => item.patientId === selectedPatientId),
    [pendingQueue, selectedPatientId],
  )

  const patientFilteredToday = useMemo(
    () =>
      selectedPatientId === ''
        ? []
        : todayRecords.filter((record) => record.patient_id === selectedPatientId),
    [todayRecords, selectedPatientId],
  )

  const processUpload = async (
    blob: Blob,
    patient: Patient,
    clientRecordingId: string,
    recordedAt: string,
    careActivityId: string,
  ) => {
    setCareActivityPhase('processing')
    setPendingQueue((queue) =>
      queue.map((item) =>
        item.clientRecordingId === clientRecordingId
          ? { ...item, status: 'processing' as const }
          : item,
      ),
    )

    try {
      const result = await uploadObservation({
        audio: blob,
        filename: `${clientRecordingId}.webm`,
        patientId: patient.id,
        caregiverId,
        clientRecordingId,
        recordedAt,
        careActivityId,
      })

      const completed = await completeCareActivity(careActivityId)
      setDailySummary(completed.daily_summary_text)
      careActivityIdRef.current = null

      setPendingQueue((queue) =>
        queue.filter((item) => item.clientRecordingId !== clientRecordingId),
      )
      setCareActivityPhase('completed')
      showSuccess(
        result.duplicate
          ? 'Recording already synced.'
          : 'Care activity completed. Observation saved and daily summary generated.',
      )
      await loadTodayRecords()

      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current)
      }
      completedTimerRef.current = setTimeout(() => {
        setCareActivityPhase('idle')
      }, 6000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.'
      setCareActivityPhase('idle')
      careActivityIdRef.current = null
      setPendingQueue((queue) =>
        queue.map((item) =>
          item.clientRecordingId === clientRecordingId
            ? { ...item, status: 'failed' as const, errorMessage: message }
            : item,
        ),
      )
      showError(message)
    }
  }

  const startCareActivity = async () => {
    if (!selectedPatientId || !selectedPatient) {
      showError('Select a patient before starting a care activity.')
      return
    }
    if (careActivityPhase === 'in_progress' || careActivityPhase === 'processing') {
      return
    }

    try {
      const activity = await apiStartCareActivity({
        patientId: selectedPatientId,
        caregiverId,
      })
      careActivityIdRef.current = activity.id
      setDailySummary(null)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        const patient = patients.find((p) => p.id === selectedPatientId)
        if (!patient) {
          setCareActivityPhase('idle')
          showError('Patient no longer available. Select a patient and try again.')
          return
        }

        if (chunksRef.current.length === 0) {
          setCareActivityPhase('idle')
          showError('No audio captured. Speak during the care activity, then finish again.')
          return
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const clientRecordingId = crypto.randomUUID()
        const recordedAt = new Date().toISOString()

        setPendingQueue((queue) => [
          {
            clientRecordingId,
            patientId: patient.id,
            patientCode: patient.patient_code,
            recordedAt,
            status: 'pending',
          },
          ...queue,
        ])

        const activityId = careActivityIdRef.current
        if (!activityId) {
          setCareActivityPhase('idle')
          showError('Care activity session lost. Please start again.')
          return
        }

        void processUpload(blob, patient, clientRecordingId, recordedAt, activityId)
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      setCareActivityPhase('in_progress')
    } catch (err) {
      setCareActivityPhase('idle')
      showError(err instanceof Error ? err.message : 'Microphone access denied.')
    }
  }

  const finishCareActivity = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    mediaRecorderRef.current = null
  }

  const activityLocked =
    careActivityPhase === 'in_progress' || careActivityPhase === 'processing'

  const syncBadge = (status: SyncStatus) => {
    switch (status) {
      case 'pending':
        return <StatusBadge variant="pending" label="Queued" />
      case 'uploading':
      case 'processing':
        return <StatusBadge variant="processing" label="Processing" />
      case 'synced':
        return <StatusBadge variant="synced" label="Synced" />
      case 'failed':
        return <StatusBadge variant="failed" label="Failed" />
    }
  }

  const phaseBadge = () => {
    switch (careActivityPhase) {
      case 'idle':
        return <StatusBadge variant="normal" label={PHASE_LABELS.idle} />
      case 'in_progress':
        return <StatusBadge variant="pending" label={PHASE_LABELS.in_progress} />
      case 'processing':
        return <StatusBadge variant="processing" label={PHASE_LABELS.processing} />
      case 'completed':
        return <StatusBadge variant="completed" label={PHASE_LABELS.completed} />
    }
  }

  const subtitle = [user.institution, user.ward].filter(Boolean).join(' · ')

  return (
    <div className={styles.page}>
      <ProfileStrip
        name={user.name}
        role="Caregiver"
        subtitle={subtitle || 'Voice observation recording'}
        badge={phaseBadge()}
      />

      <section className={styles.card}>
        <SectionHeader
          title="Care activity"
          description="Select a patient, start the care activity, narrate only the ADL details (medication, meals, hygiene, etc.), then finish. Long silence or casual speech may be rejected."
        />

        {loadingPatients ? (
          <LoadingState message="Loading patients…" />
        ) : patientsError ? (
          <p className="text-sm text-red-600">{patientsError}</p>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="No patients available"
            description="Ask your supervisor to add patients before recording."
          />
        ) : (
          <div className={styles.recordPanel}>
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                  Activity status
                </p>
                <p className="mt-0.5 text-sm font-medium text-slate-900">
                  {PHASE_LABELS[careActivityPhase]}
                  {selectedPatient ? ` · ${selectedPatient.patient_code}` : ''}
                </p>
              </div>
              {careActivityPhase === 'completed' && (
                <CheckCircle2 size={20} className="text-emerald-600" aria-hidden="true" />
              )}
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
                Patient
                <select
                  value={selectedPatientId}
                  onChange={(event) => onPatientChange(Number(event.target.value))}
                  disabled={activityLocked}
                  className="rounded-[var(--radius-md)] border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-blue)] disabled:bg-slate-100"
                >
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.patient_code}
                      {patient.room_id ? ` · Room ${patient.room_id}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {careActivityPhase !== 'in_progress' ? (
                <Button
                  onClick={() => void startCareActivity()}
                  disabled={activityLocked || !selectedPatientId}
                  className="min-w-[180px]"
                >
                  <Mic size={16} aria-hidden="true" />
                  Start care activity
                </Button>
              ) : (
                <Button variant="danger" onClick={finishCareActivity} className="min-w-[180px]">
                  <Square size={16} aria-hidden="true" />
                  Finish care activity
                </Button>
              )}
            </div>

            {careActivityPhase === 'in_progress' && (
              <div className={`${styles.phaseBanner} ${styles.phaseRecording}`}>
                <span className={`${styles.recordDot} ${styles.recordDotLive}`} aria-hidden="true" />
                Care activity in progress — perform care, then tap Finish when done. Recording
                will only be processed after you finish.
              </div>
            )}

            {careActivityPhase === 'processing' && (
              <div className={`${styles.phaseBanner} ${styles.phaseProcessing}`}>
                Processing recording through SCRIBE pipeline (transcription → ADL extraction →
                save)…
              </div>
            )}

            {careActivityPhase === 'completed' && dailySummary && (
              <div className={`${styles.phaseBanner} ${styles.phaseComplete}`}>
                <div className="w-full">
                  <p className="mb-2 text-sm font-semibold">Daily care activity summary</p>
                  <p className={styles.summaryText}>{dailySummary}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={styles.card}>
        <SectionHeader
          title="Today's sync queue"
          description={
            selectedPatient
              ? `Upload status and observations for ${selectedPatient.patient_code} today.`
              : 'Select a patient to view their sync queue.'
          }
        />

        {!selectedPatient ? (
          <EmptyState
            icon={Mic}
            title="No patient selected"
            description="Choose a patient above to view their sync queue."
          />
        ) : loadingToday ? (
          <LoadingState message="Loading today's recordings…" />
        ) : patientFilteredPending.length === 0 && patientFilteredToday.length === 0 ? (
          <EmptyState
            icon={Mic}
            title={`No recordings for ${selectedPatient.patient_code} today`}
            description="Observations for this patient will appear here after you finish a care activity."
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Summary / ADL</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {patientFilteredPending.map((item) => (
                  <tr key={item.clientRecordingId}>
                    <td className="text-[var(--text-secondary)]">—</td>
                    <td className="text-[var(--text-secondary)]">
                      {item.errorMessage ?? 'Awaiting pipeline processing…'}
                    </td>
                    <td>{syncBadge(item.status)}</td>
                    <td>{formatTime(item.recordedAt)}</td>
                  </tr>
                ))}
                {patientFilteredToday.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <CategoryBadge category={record.category} />
                    </td>
                    <td className={styles.transcriptCell}>
                      <span className={styles.transcriptText}>
                        {record.cleaned_transcript ?? record.raw_transcript ?? 'Processing…'}
                      </span>
                    </td>
                    <td>
                      {record.alert_required ? (
                        <StatusBadge variant="alert" label="Flagged" />
                      ) : (
                        <StatusBadge variant="synced" label="Synced" />
                      )}
                    </td>
                    <td>{formatTime(record.recorded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
