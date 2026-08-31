import { useEffect, useMemo, useState } from 'react'
import { Activity, Award, BookOpen, ClipboardList, RotateCcw, TrendingUp } from 'lucide-react'
// eslint config runs the React Compiler rules; keep derived values that
// depend on plain locals as inline consts, not useMemo.
import {
  cachedGlossHistory,
  cachedGlossProgress,
  peekGlossHistory,
  peekGlossProgress,
} from '../services/glossCache'
import type {
  GlossHistoryEntry,
  GlossMasteryStatus,
  GlossMasterySummaryRow,
  GlossProgressReport,
} from '../types/gloss'
import ProgressStatCard from './gloss/ProgressStatCard'
import PracticeCalendar from './gloss/PracticeCalendar'
import DailyPracticePopup from './gloss/DailyPracticePopup'

// Task 2 — polished caregiver learning dashboard. A learning report,
// not an analytics dashboard. GET /gloss/progress and GET /gloss/history
// are unchanged; every value below is derived from their real data
// only. The new day-popup is UI state + a client-side filter of the
// already-loaded history — no new endpoint, no new calculation.

type Status = 'loading' | 'ready' | 'error'

const HISTORY_LIMIT = 200

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function localDateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATUS_DOT: Record<GlossMasteryStatus, string> = {
  new: '#94a3b8',
  learning: '#6E5AE6',
  weak: '#EE7A32',
  improving: '#EE7A32',
  mastered: '#32A862',
  needs_revision: '#E9792D',
}

function MasteredChip({ row }: { row: GlossMasterySummaryRow }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-[12px] border border-[#CDEEDB] bg-white px-3 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold capitalize text-[#17223E]">
          {row.display_name}
        </span>
        <span className="text-[11px] text-[#73809A]">
          Last practised {formatDate(row.last_practiced_at)} · {row.attempts} attempt
          {row.attempts === 1 ? '' : 's'}
          {row.best_score != null && ` · best ${Math.round(row.best_score * 100)}%`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#EDF9F1] px-2 py-0.5 text-[11px] font-semibold text-[#2F9E57]">
        <Award size={11} />
        Mastered
      </span>
    </li>
  )
}

function ImprovingCard({ row }: { row: GlossMasterySummaryRow }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#FFDCC7] bg-white px-4 py-3 shadow-[0_3px_12px_rgba(20,39,80,0.05)]">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold capitalize text-[#17223E]">
          {row.display_name}
        </span>
        <span className="text-[11px] text-[#73809A]">
          Last practice: {formatDate(row.last_practiced_at)} · {row.attempts} attempt
          {row.attempts === 1 ? '' : 's'}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#FFF3EA] px-2.5 py-0.5 text-[11px] font-semibold text-[#EE7A32]">
        <TrendingUp size={11} />
        Improving
      </span>
    </div>
  )
}

export default function ProgressReport() {
  // Seed from the session cache so returning to this tab shows data
  // immediately instead of flashing a spinner.
  const [status, setStatus] = useState<Status>(peekGlossProgress() ? 'ready' : 'loading')
  const [report, setReport] = useState<GlossProgressReport | null>(peekGlossProgress() ?? null)
  const [history, setHistory] = useState<GlossHistoryEntry[]>(
    peekGlossHistory(HISTORY_LIMIT) ?? [],
  )
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
    // Same endpoint the History tab uses — powers the calendar day-popup.
    // A failure just leaves the popup empty.
    cachedGlossHistory(HISTORY_LIMIT)
      .then((data) => {
        if (isMounted) setHistory(data)
      })
      .catch(() => {
        /* popup shows its empty state; progress view unaffected */
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

  const historyByDate = useMemo(() => {
    const map = new Map<string, GlossHistoryEntry[]>()
    for (const entry of history) {
      const key = localDateKey(entry.attempted_at)
      if (!key) continue
      const list = map.get(key)
      if (list) list.push(entry)
      else map.set(key, [entry])
    }
    return map
  }, [history])

  const mastered = useMemo(
    () => (report?.mastery_summary ?? []).filter((r) => r.mastery_status === 'mastered'),
    [report],
  )
  const improving = useMemo(
    () => (report?.mastery_summary ?? []).filter((r) => r.mastery_status === 'improving'),
    [report],
  )
  const recent = useMemo(
    () =>
      [...(report?.mastery_summary ?? [])]
        .filter((r) => r.last_practiced_at)
        .sort((a, b) => (b.last_practiced_at ?? '').localeCompare(a.last_practiced_at ?? ''))
        .slice(0, 6),
    [report],
  )

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
          value={report.signs_practiced}
          border="#D9D5FF"
          tileBg="#F2EFFF"
          tileFg="#6E5AE6"
        />
        <ProgressStatCard
          icon={Award}
          label="Mastered"
          value={report.mastered_count}
          border="#CDEEDB"
          tileBg="#EDF9F1"
          tileFg="#32A862"
        />
        <ProgressStatCard
          icon={TrendingUp}
          label="Improving"
          value={report.improving_count}
          border="#FFDCC7"
          tileBg="#FFF3EA"
          tileFg="#EE7A32"
        />
        <ProgressStatCard
          icon={Activity}
          label="Total Attempts"
          value={report.total_attempts}
          border="#D2E2FF"
          tileBg="#EEF5FF"
          tileFg="#365FD9"
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

        <section className="flex flex-1 flex-col gap-3 lg:w-[60%]">
          <h3 className="text-sm font-bold text-[#17223E]">Words Learnt</h3>
          {mastered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-[#D9D5FF] bg-[#FBFAFF] px-4 py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F2EFFF] text-[#6E5AE6]">
                <ClipboardList size={22} aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-[#17223E]">No signs mastered yet</p>
              <p className="max-w-xs text-xs text-[#73809A]">
                Keep practising with the camera — mastered signs will appear here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {mastered.map((row) => (
                <MasteredChip key={row.sign_id} row={row} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-[#17223E]">Currently Improving</h3>
        {improving.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[#E1E7F0] bg-white px-4 py-5 text-sm text-[#73809A]">
            Nothing in progress right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {improving.map((row) => (
              <ImprovingCard key={row.sign_id} row={row} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-[#17223E]">Recently Practised</h3>
        <ul className="overflow-hidden rounded-[14px] border border-[#E1E7F0] bg-white">
          {recent.map((row, i) => (
            <li
              key={row.sign_id}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-[#F7F9FC] ${
                i > 0 ? 'border-t border-[#EEF1F6]' : ''
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: STATUS_DOT[row.mastery_status] ?? '#94a3b8' }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate font-medium capitalize text-[#17223E]">
                {row.display_name}
              </span>
              <span className="shrink-0 text-[11px] capitalize text-[#73809A]">
                {row.mastery_status.replace(/_/g, ' ')}
              </span>
              <span className="w-[128px] shrink-0 text-right text-[11px] text-[#73809A]">
                {formatDateTime(row.last_practiced_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {selectedDate && (
        <DailyPracticePopup
          dateIso={selectedDate}
          entries={historyByDate.get(selectedDate) ?? []}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
