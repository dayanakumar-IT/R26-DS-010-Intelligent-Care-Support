import { useEffect, useState } from 'react'
import { ArrowLeft, Brain, CalendarDays, ChevronRight, FileText, Hand, RotateCcw, TrendingUp, Users } from 'lucide-react'
import { getSupervisorCaregiver } from '../../services/glossApi'
import type { SupervisorCaregiverDetail, SupervisorCaregiverRow, SupervisorOverview } from '../../types/gloss'
import { fmtDate } from '../../utils/journey'
import ProgressReportPrint from '../journey/ProgressReportPrint'

/**
 * TeamLearning.tsx
 * Supervisors only (the server checks the role): every caregiver's learning,
 * sorted by name — never ranked. Sign language: Demonstrated / Retained /
 * practised, pace (Demonstrated per week, last 4 weeks) and active days;
 * Parkinson's education: quizzes completed, questions answered, mastery.
 * Selecting a caregiver shows their detail and their progress report.
 * No video, no failed attempts, no streaks.
 */

const weekLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not yet')

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function Pace({ row }: { row: SupervisorCaregiverRow }) {
  const max = Math.max(1, ...row.pace.demonstrated)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-1.5" role="img" aria-label={`Demonstrated per week, last 4 weeks: ${row.pace.demonstrated.join(', ')}`}>
        {row.pace.demonstrated.map((n, i) => (
          <span key={row.pace.weeks[i]} className="flex w-9 flex-col items-center gap-0.5">
            <span className="text-xs font-semibold text-slate-700">{n}</span>
            <span className="w-full rounded-t bg-[#c7d7fb]" style={{ height: `${6 + (n / max) * 22}px` }} aria-hidden="true" />
            <span className="text-[11px] text-slate-500">{weekLabel(row.pace.weeks[i])}</span>
          </span>
        ))}
      </div>
      <span className="text-sm text-slate-600">{row.pace.trend}</span>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[12px] border border-slate-200 bg-white px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-lg font-bold text-slate-900">{value}</span>
      {sub && <span className="text-sm text-slate-600">{sub}</span>}
    </div>
  )
}

function Detail({ caregiverId, onBack }: { caregiverId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<SupervisorCaregiverDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    let alive = true
    getSupervisorCaregiver(caregiverId)
      .then((d) => alive && setDetail(d))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load this caregiver.'))
    return () => {
      alive = false
    }
  }, [caregiverId])

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1 text-base font-medium text-[#2563EB] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]">
        <ArrowLeft size={16} aria-hidden="true" /> All caregivers
      </button>
      {error && <p className="text-base text-rose-700">{error}</p>}
      {!detail && !error && <p className="text-base text-slate-500">Loading…</p>}
      {detail && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{detail.name}</h3>
              <p className="text-sm text-slate-500">ID {detail.short_id} · Level: {detail.summary.level?.name ?? 'none yet'}</p>
            </div>
            <button type="button" onClick={() => setShowReport(true)} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]">
              <FileText size={16} aria-hidden="true" /> Progress report
            </button>
          </div>
          <section aria-label="Sign language" className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600"><Hand size={15} aria-hidden="true" /> Sign language</h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Demonstrated" value={`${detail.demonstrated} of ${detail.countable}`} />
              <Stat label="Retained" value={String(detail.retained)} />
              <Stat label="Signs practised" value={String(detail.practised)} />
              <Stat label="Active days" value={`${detail.active_days_this_week} of 7`} sub={`this week · ${detail.active_days_total} overall`} />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-[12px] border border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pace · Demonstrated per week</span>
                <Pace row={detail} />
              </div>
              <span className="text-sm text-slate-600">Last active: {day(detail.last_active)}</span>
            </div>
            <ul className="flex flex-wrap gap-2 text-sm">
              {detail.summary.categories.map((c) => (
                <li key={c.key} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                  {c.name}: {c.demonstrated} of {c.countable}
                  {c.badge_earned_at && ` · badge ${fmtDate(c.badge_earned_at)}`}
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Parkinson's education" className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600"><Brain size={15} aria-hidden="true" /> Parkinson&apos;s education</h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Quizzes completed" value={String(detail.parkinsons.quizzes_completed)} />
              <Stat label="Questions answered" value={String(detail.parkinsons.questions_answered)} />
              <Stat
                label="Mastery"
                value={`${detail.parkinsons.symptoms_mastered} of ${detail.parkinsons.symptom_count} symptoms`}
                sub={detail.parkinsons.average_mastery == null ? 'not started' : `average ${detail.parkinsons.average_mastery} / 100`}
              />
            </div>
          </section>
          {showReport && <ProgressReportPrint summary={detail.summary} learnerName={detail.name} onClose={() => setShowReport(false)} />}
        </>
      )}
    </div>
  )
}

interface TeamLearningProps {
  overview: SupervisorOverview | null
  error: string | null
  onRetry: () => void
}

export default function TeamLearning({ overview, error, onRetry }: TeamLearningProps) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <section id="team-learning" aria-label="Team learning" className="flex scroll-mt-6 flex-col gap-4 rounded-[20px] border border-[#E5EAF2] bg-white p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-[var(--brand-blue)]">
          <Users size={22} aria-hidden="true" /> Team learning
        </h2>
        <p className="text-base text-slate-600">
          Every caregiver&apos;s sign language and Parkinson&apos;s education, sorted by name. What they have achieved — no rankings, no video.
        </p>
      </div>

      {error && (
        <div className="flex flex-col items-start gap-2 text-base text-rose-700">
          <p>Couldn&apos;t load team learning: {error}</p>
          <button type="button" onClick={onRetry} className="flex items-center gap-1 font-medium underline"><RotateCcw size={14} /> Try again</button>
        </div>
      )}
      {!overview && !error && <p className="text-base text-slate-500">Loading team learning…</p>}

      {overview && selected && <Detail caregiverId={selected} onBack={() => setSelected(null)} />}

      {overview && !selected && (
        overview.caregivers.length === 0 ? (
          <p className="text-base text-slate-500">No caregivers have a Sign &amp; Vitals account yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {overview.caregivers.map((r) => (
              <li key={r.caregiver_profile_id}>
                <button
                  type="button"
                  onClick={() => setSelected(r.caregiver_profile_id)}
                  className="grid w-full gap-3 rounded-[14px] border border-slate-200 bg-white p-4 text-left hover:border-[#93b4f5] hover:bg-[#f8fbff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)] lg:grid-cols-[1.2fr_1.3fr_1.1fr_1.2fr_auto] lg:items-center"
                >
                  <span className="flex flex-col">
                    <span className="text-lg font-semibold text-slate-900">{r.name}</span>
                    <span className="text-sm text-slate-500">ID {r.short_id} · last active {day(r.last_active)}</span>
                  </span>
                  <span className="flex flex-col gap-0.5 text-base text-slate-700">
                    <span className="flex items-center gap-1.5"><Hand size={15} aria-hidden="true" className="text-[var(--brand-blue)]" /><b>{r.demonstrated}</b> of {r.countable} Demonstrated</span>
                    <span className="text-sm text-slate-600">{r.retained} Retained · {r.practised} practised</span>
                  </span>
                  <span className="flex flex-col gap-0.5 text-base text-slate-700">
                    <span className="flex items-center gap-1.5"><TrendingUp size={15} aria-hidden="true" className="text-[var(--brand-blue)]" />{r.pace.demonstrated.join(' · ')} <span className="text-sm text-slate-500">per week</span></span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-600"><CalendarDays size={14} aria-hidden="true" />{r.active_days_this_week} of 7 days this week · {r.active_days_total} overall</span>
                  </span>
                  <span className="flex flex-col gap-0.5 text-base text-slate-700">
                    <span className="flex items-center gap-1.5"><Brain size={15} aria-hidden="true" className="text-violet-700" />{plural(r.parkinsons.quizzes_completed, 'quiz', 'quizzes')} · {plural(r.parkinsons.questions_answered, 'answer')}</span>
                    <span className="text-sm text-slate-600">{r.parkinsons.symptoms_mastered} of {r.parkinsons.symptom_count} symptoms mastered</span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="hidden text-slate-400 lg:block" />
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  )
}
