import { Compass, RefreshCw, Sparkles, SearchCheck } from 'lucide-react'
import type { PkQuizSummary } from '../../types/parkinsons'
import { accuracyBar, accuracyTone } from './pkHelpers'
import ParkinsonsBadges from './ParkinsonsBadges'

interface ParkinsonsQuizSummaryProps {
  summary: PkQuizSummary
  onReviewMistakes: () => void
  onRetry: () => void
  onExplore: () => void
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-md)] bg-white/70 px-4 py-3 text-center">
      <span className="text-2xl font-semibold text-slate-900">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
    </div>
  )
}

export default function ParkinsonsQuizSummary({
  summary,
  onReviewMistakes,
  onRetry,
  onExplore,
}: ParkinsonsQuizSummaryProps) {
  const hasMistakes = summary.review.length > 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900">Quiz complete</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Correct" value={`${summary.correct_answers}/${summary.answered}`} />
          <Stat label="Quiz score" value={`${summary.accuracy_pct}%`} />
          <Stat label="XP earned" value={`+${summary.xp_earned}`} />
          <Stat label="Best streak" value={`${summary.best_streak}`} />
        </div>

        <ParkinsonsBadges badges={summary.badges} />
      </div>

      {summary.symptom_breakdown.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-5 shadow-[var(--shadow-sm)]">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recognition accuracy in training
          </span>
          <div className="flex flex-col gap-2.5">
            {summary.symptom_breakdown.map((s) => (
              <div key={s.symptom_id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{s.display_name}</span>
                  <span className={`font-medium ${accuracyTone(s.accuracy_pct)}`}>
                    {s.correct}/{s.total} · {s.accuracy_pct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${accuracyBar(s.accuracy_pct)}`}
                    style={{ width: `${s.accuracy_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {summary.strongest.length > 0 && (
          <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Strongest
            </span>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm text-emerald-900">
              {summary.strongest.map((s) => (
                <li key={s.symptom_id}>{s.display_name}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.needs_review.length > 0 && (
          <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Needs review
            </span>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm text-amber-900">
              {summary.needs_review.map((s) => (
                <li key={s.symptom_id}>{s.display_name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {hasMistakes && (
          <button
            type="button"
            onClick={onReviewMistakes}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            <SearchCheck size={15} />
            Review mistakes
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
        >
          <RefreshCw size={15} />
          Try another quiz
        </button>
        <button
          type="button"
          onClick={onExplore}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Compass size={15} />
          Explore symptoms
        </button>
      </div>
    </div>
  )
}
