import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Clock } from 'lucide-react'
import Button from '../../../../../shared/components/Button'
import EmptyState from '../../../components/EmptyState'
import LoadingState from '../../../components/LoadingState'
import ObservationTable from '../../../components/ObservationTable'
import SectionHeader from '../../../components/SectionHeader'
import StatusBadge from '../../../components/StatusBadge'
import { useToast } from '../../../components/Toast'
import { fetchAudioUrl, fetchPatients } from '../../../services/scribeApi'
import { fetchCaregiverRecords } from '../../../services/scribeSupabase'
import type { AdlRecord, Patient } from '../../../types'
import styles from '../../../styles/dashboard.module.css'

interface HistoryTabProps {
  caregiverId: string
}

function groupByDateThenPatient(
  records: AdlRecord[],
): Map<string, Map<number, AdlRecord[]>> {
  const byDate = new Map<string, Map<number, AdlRecord[]>>()
  for (const record of records) {
    const dateKey = record.recorded_at.slice(0, 10)
    let patientMap = byDate.get(dateKey)
    if (!patientMap) {
      patientMap = new Map()
      byDate.set(dateKey, patientMap)
    }
    const list = patientMap.get(record.patient_id) ?? []
    list.push(record)
    patientMap.set(record.patient_id, list)
  }
  return byDate
}

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`)
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function selectionKey(dateKey: string, patientId: number): string {
  return `${dateKey}:${patientId}`
}

export default function HistoryTab({ caregiverId }: HistoryTabProps) {
  const { showError } = useToast()
  const [records, setRecords] = useState<AdlRecord[]>([])
  const [patients, setPatients] = useState<Map<number, Patient>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [expandedSelection, setExpandedSelection] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [recordData, patientData] = await Promise.all([
        fetchCaregiverRecords(caregiverId, { limit: 200 }),
        fetchPatients(),
      ])
      setRecords(recordData)
      setPatients(new Map(patientData.map((patient) => [patient.id, patient])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [caregiverId])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const grouped = useMemo(() => groupByDateThenPatient(records), [records])

  const sortedDates = useMemo(
    () => [...grouped.keys()].sort((a, b) => b.localeCompare(a)),
    [grouped],
  )

  const togglePatient = (dateKey: string, patientId: number) => {
    const key = selectionKey(dateKey, patientId)
    setExpandedSelection((current) => (current === key ? null : key))
  }

  const handlePlay = async (record: AdlRecord) => {
    if (!record.r2_audio_key) {
      showError('Audio has been purged or is unavailable.')
      return
    }
    try {
      setPlayingId(record.id)
      const url = await fetchAudioUrl(record.patient_id, record.id)
      const audio = new Audio(url)
      audio.onended = () => setPlayingId(null)
      audio.onerror = () => {
        setPlayingId(null)
        showError('Failed to play audio.')
      }
      await audio.play()
    } catch (err) {
      setPlayingId(null)
      showError(err instanceof Error ? err.message : 'Failed to load audio.')
    }
  }

  if (loading) {
    return <LoadingState message="Loading your recording history…" />
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className={styles.errorText}>{error}</p>
        <Button variant="secondary" onClick={() => void loadHistory()}>
          Retry
        </Button>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No past recordings"
        description="Observations you record will appear here, organized by date and patient."
      />
    )
  }

  return (
    <div className={styles.page}>
      <SectionHeader
        title="Recording history"
        description="Browse observations by date, then select a patient to view their recordings and ADL entries."
      />

      {sortedDates.map((dateKey) => {
        const patientMap = grouped.get(dateKey)!
        const patientEntries = [...patientMap.entries()].sort((a, b) => {
          const codeA = patients.get(a[0])?.patient_code ?? ''
          const codeB = patients.get(b[0])?.patient_code ?? ''
          return codeA.localeCompare(codeB)
        })

        return (
          <section key={dateKey} className={styles.card}>
            <h2 className={styles.cardTitle}>{formatDateLabel(dateKey)}</h2>
            <p className={styles.cardDescription}>
              {patientEntries.length} patient{patientEntries.length === 1 ? '' : 's'} ·{' '}
              {[...patientMap.values()].reduce((sum, list) => sum + list.length, 0)} observation
              {[...patientMap.values()].reduce((sum, list) => sum + list.length, 0) === 1
                ? ''
                : 's'}
            </p>

            <ul className={styles.accordionList}>
              {patientEntries.map(([patientId, dayRecords]) => {
                const patientCode = patients.get(patientId)?.patient_code ?? 'Unknown'
                const key = selectionKey(dateKey, patientId)
                const isExpanded = expandedSelection === key

                return (
                  <li
                    key={key}
                    className={`${styles.accordionItem} ${isExpanded ? styles.accordionItemExpanded : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => togglePatient(dateKey, patientId)}
                      className={`${styles.accordionTrigger} ${isExpanded ? styles.accordionTriggerExpanded : ''}`}
                      aria-expanded={isExpanded}
                    >
                      <span className={styles.accordionTriggerLabel}>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-slate-500" aria-hidden="true" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-500" aria-hidden="true" />
                        )}
                        {patientCode}
                        <span className={styles.accordionTriggerMeta}>
                          {dayRecords.length} recording{dayRecords.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      {dayRecords.some((record) => record.alert_required) && (
                        <StatusBadge variant="alert" label="Has flagged ADL" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className={styles.accordionBody}>
                        <ObservationTable
                          records={dayRecords}
                          playingId={playingId}
                          onPlay={handlePlay}
                          showAdlDetails={false}
                          statusMode="processing"
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
