import { useEffect, useMemo, useState } from 'react'
import { Award, BookOpen, ListChecks, RotateCcw, Video } from 'lucide-react'
// eslint config runs the React Compiler rules; keep derived values that
// depend on plain locals as inline consts, not useMemo.
import { cachedGlossProgress, peekGlossProgress } from '../services/glossCache'
import type { GlossMasterySummaryRow, GlossProgressReport, GlossProgressSummary } from '../types/gloss'
import { LAST_RESULT_LABEL, STRONG_NEEDED, progressState, strongInARow } from '../utils/progressLabels'
import ProgressStatCard from './gloss/ProgressStatCard'
import PracticeCalendar from './gloss/PracticeCalendar'
import HistoryList from './HistoryList'

// Task 2 — polished caregiver learning dashboard. A learning report,
// not an analytics dashboard. GET /gloss/progress and GET /gloss/history
// are unchanged; every value below is derived from their real data
// only. The new day-popup is UI state + a client-side filter of the
// already-loaded history — no new endpoint, no new calculation.

type Status = 'loading' | 'ready' | 'error'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function InProgressCard({ row, strongNeeded }: { row: GlossMasterySummaryRow; strongNeeded: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#E1E7F0] bg-white px-4 py-3 shadow-[0_3px_12px_rgba(20,39,80,0.05)]">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold capitalize text-[#17223E]">
          {row.display_name}
        </span>
        <span className="text-xs text-[#4B5873]">
          Last practice: {formatDate(row.last_practiced_at)} · {row.attempts} attempt
          {row.attempts === 1 ? '' : 's'}
          {row.last_result && ` · Last result: ${LAST_RESULT_LABEL[row.last_result]}`}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-[#F1F4FA] px-2.5 py-0.5 text-xs font-semibold text-[#334155]">
        {row.camera_attempts === 0
          ? 'Quiz only'
          : `Strong in a row: ${strongInARow(row.consecutive_strong_streak, strongNeeded)}`}
      </span>
    </div>
  )
}

// Signs Practised and Demonstrated come from GET /gloss/progress/summary,
// the same numbers as Practice and My Journey.
export default function ProgressReport({ summary }: { summary: GlossProgressSummary | null }) {
  // Seed from the session cache so returning to this tab shows data
  // immediately instead of flashing a spinner.
  const [status, setStatus] = useState<Status>(peekGlossProgress() ? 'ready' : 'loading')
  const [report, setReport] = useState<GlossProgressReport | null>(peekGlossProgress() ?? null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let isMounted = true
    if (!peekGlossProgress()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('loading')
    }
    // cachedGlossProgress() resolves instantly from the session cache when
    // available (and de-dupes with SignLanguage's own progress read).
    cachedGlossProgress()
      .then((data) => {
        if (!isMounted) return
        setReport(data)
        setStatus('ready')
      })
      .catch(() => {
        if (isMounted) setStatus('error')
      })
    return () => {
      isMounted = false
    }
  }, [reloadToken])

  const calendarByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of report?.practice_calendar ?? []) map.set(day.date, day.attempt_count)
    return map
  }, [report])

  // Every attempted, not-yet-demonstrated sign, most recently practised first.
  const inProgress = useMemo(
    () =>
      (report?.mastery_summary ?? [])
        .filter((r) => progressState(r.mastery_status, r.attempts) === 'practising')
        .sort((a, b) => (b.last_practiced_at ?? '').localeCompare(a.last_practiced_at ?? '')),
    [report],
  )
  const strongNeeded = report?.strong_needed ?? STRONG_NEEDED

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">Loading your progress…</p>
  }

  if (status === 'error' || !report) {
    return (
      <div className="flex flex-col items-start gap-2 text-sm text-rose-600">
        <p>Couldn&apos;t load your progress right now.</p>
        <button
          type="button"
          onClick={() => setReloadToken((n) => n + 1)}
          className="flex items-center gap-1 text-xs font-medium underline"
        >
          <RotateCcw size={12} />
          Try again
        </button>
      </div>
    )
  }

  if (report.total_attempts === 0) {
    return (
      <p className="text-sm text-slate-500">
        No practice yet. Head to the Practice tab to try your first sign — your progress will show up
        here.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ProgressStatCard
          icon={BookOpen}
          label="Signs Practised"
          value={summary ? summary.counts.practised : '–'}
          border="#D9D5FF"
          tileBg="#F2EFFF"
          tileFg="#6E5AE6"
        />
        <ProgressStatCard
          icon={Award}
          label="Demonstrated"
          value={summary ? `${summary.counts.demonstrated} of ${summary.counts.countable}` : '–'}
          border="#CDEEDB"
          tileBg="#EDF9F1"
          tileFg="#32A862"
        />
        <ProgressStatCard
          icon={Video}
          label="Camera Attempts"
          value={report.camera_attempts}
          border="#D2E2FF"
          tileBg="#EEF5FF"
          tileFg="#365FD9"
        />
        <ProgressStatCard
          icon={ListChecks}
          label="Quiz Answers"
          value={report.quiz_answers}
          border="#FFDCC7"
          tileBg="#FFF3EA"
          tileFg="#EE7A32"
        />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="lg:w-[40%]">
          <PracticeCalendar
            byDate={calendarByDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        <div className="flex-1 lg:w-[60%]">
          <HistoryList selectedDate={selectedDate} onClearDate={() => setSelectedDate(null)} />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-[#17223E]">In Progress</h3>
        {inProgress.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[#E1E7F0] bg-white px-4 py-5 text-sm text-[#4B5873]">
            Nothing in progress right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {inProgress.map((row) => (
              <InProgressCard key={row.sign_id} row={row} strongNeeded={strongNeeded} />
            ))}
          </div>
        )}
      </section>


    </div>
  )
}
