import { useEffect, useMemo, useState } from 'react'
import { Activity, Award, BookOpen, RotateCcw, TrendingUp } from 'lucide-react'
// eslint config runs the React Compiler rules; keep derived values that
// depend on plain locals as inline consts, not useMemo.
import { getGlossProgress } from '../services/glossApi'
import type { GlossMasterySummaryRow, GlossProgressReport } from '../types/gloss'

// Task 2 — polished caregiver learning dashboard. A learning report,
// not an analytics dashboard: four compact stat cards, a compact
// month calendar beside the mastered-signs list, then improving and
// recently-practised rows. GET /gloss/progress is unchanged; all
// values below are derived from its real data only.

type Status = 'loading' | 'ready' | 'error'

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

interface StatCardProps {
  icon: typeof Award
  label: string
  value: number
  accent: string // pastel background
  fg: string // icon/number tint
}

function StatCard({ icon: Icon, label, value, accent, fg }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-slate-200 bg-white p-3 shadow-[var(--shadow-sm)]">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
        style={{ background: accent, color: fg }}
      >
        <Icon size={18} />
      </span>
      <span className="flex flex-col">
        <span className="text-xl font-semibold leading-tight text-slate-900">{value}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      </span>
    </div>
  )
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function CompactCalendar({ byDate }: { byDate: Map<string, number> }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const todayIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = new Date(year, month, 1).getDay()

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const practiceDays = Array.from(byDate.entries()).filter(
    ([d, c]) => c > 0 && d.startsWith(monthPrefix),
  ).length

  function tone(count: number): { bg: string; fg: string } {
    if (count <= 0) return { bg: '#f1f5f9', fg: '#94a3b8' }
    if (count === 1) return { bg: '#e0ecff', fg: '#1e40af' }
    if (count <= 3) return { bg: '#93b4f7', fg: '#0b2a66' }
    return { bg: 'var(--brand-blue)', fg: '#ffffff' }
  }

  const cells: Array<{ day: number; iso: string; count: number } | null> = []
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ day, iso, count: byDate.get(iso) ?? 0 })
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-slate-200 bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col">
        <p className="text-sm font-semibold text-slate-800">Practice Activity</p>
        <p className="text-xs text-slate-400">
          {now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div style={{ width: 316 }} className="max-w-full">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-slate-400">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-0.5">
              {d}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell, i) =>
            cell === null ? (
              <span key={`b-${i}`} style={{ height: 30 }} />
            ) : (
              <span
                key={cell.iso}
                title={
                  cell.count > 0
                    ? `${cell.iso}: ${cell.count} attempt${cell.count === 1 ? '' : 's'}`
                    : `${cell.iso}: no practice`
                }
                className="flex items-center justify-center rounded-[6px] text-[11px] font-medium"
                style={{
                  height: 30,
                  ...(() => {
                    const t = tone(cell.count)
                    return { background: t.bg, color: t.fg }
                  })(),
                  boxShadow: cell.iso === todayIso ? '0 0 0 2px var(--brand-blue) inset' : undefined,
                }}
              >
                {cell.day}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-slate-400">
          {practiceDays} practice day{practiceDays === 1 ? '' : 's'} this month
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400" aria-hidden="true">
          Less
          {['#f1f5f9', '#e0ecff', '#93b4f7', 'var(--brand-blue)'].map((c) => (
            <span
              key={c}
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: c }}
            />
          ))}
          More
        </span>
      </div>
    </div>
  )
}

function MasteredChip({ row }: { row: GlossMasterySummaryRow }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-slate-200 bg-white px-3 py-2">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold capitalize text-slate-800">{row.display_name}</span>
        <span className="text-[11px] text-slate-400">
          Last practised {formatDate(row.last_practiced_at)} · {row.attempts} attempt
          {row.attempts === 1 ? '' : 's'}
          {row.best_score != null && ` · best ${Math.round(row.best_score * 100)}%`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <Award size={11} />
        Mastered
      </span>
    </li>
  )
}

export default function ProgressReport() {
  const [status, setStatus] = useState<Status>('loading')
  const [report, setReport] = useState<GlossProgressReport | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let isMounted = true
    // Justified on-mount / reload fetch, mirroring SignLanguage.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading')
    getGlossProgress()
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
        No practice yet. Head to the Practice tab to try your first sign — your progress will show up here.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={BookOpen} label="Signs Practised" value={report.signs_practiced} accent="#eef2ff" fg="#4338ca" />
        <StatCard icon={Award} label="Mastered" value={report.mastered_count} accent="#ecfdf5" fg="#047857" />
        <StatCard icon={TrendingUp} label="Improving" value={report.improving_count} accent="#fff7ed" fg="#c2410c" />
        <StatCard icon={Activity} label="Total Attempts" value={report.total_attempts} accent="#eff6ff" fg="#1d4ed8" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:w-[38%]">
          <CompactCalendar byDate={calendarByDate} />
        </div>

        <section className="flex flex-1 flex-col gap-2 lg:w-[62%]">
          <p className="text-sm font-semibold text-slate-800">Words Learnt</p>
          {mastered.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-400">
              No signs mastered yet — keep practising with the camera.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {mastered.map((row) => (
                <MasteredChip key={row.sign_id} row={row} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-slate-800">Currently Improving</p>
        {improving.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-400">
            Nothing in progress right now.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {improving.map((row) => (
              <li
                key={row.sign_id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-slate-200 bg-white px-3 py-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold capitalize text-slate-800">
                    {row.display_name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {row.attempts} attempt{row.attempts === 1 ? '' : 's'} · last {formatDate(row.last_practiced_at)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                  <TrendingUp size={11} />
                  Improving
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-slate-800">Recently Practised</p>
        <ul className="flex flex-col">
          {recent.map((row, i) => (
            <li
              key={row.sign_id}
              className={`flex items-center justify-between gap-3 py-2 text-sm ${
                i > 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-blue)]" aria-hidden="true" />
                <span className="font-medium capitalize text-slate-800">{row.display_name}</span>
                <span className="text-[11px] capitalize text-slate-400">
                  {row.mastery_status.replace(/_/g, ' ')}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-slate-400">{formatDateTime(row.last_practiced_at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}