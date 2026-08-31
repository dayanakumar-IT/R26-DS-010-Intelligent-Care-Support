import { useEffect, useState } from 'react'
import { ChevronLeft, Flame, ListChecks, Star, Trophy } from 'lucide-react'
import type { PkProgress } from '../../types/parkinsons'
import { getParkinsonsProgress } from '../../services/parkinsonsApi'
import { accuracyBar, accuracyTone, relativeDate } from './pkHelpers'
import ParkinsonsHistory from './ParkinsonsHistory'

interface ParkinsonsProgressProps {
  onBack: () => void
  onStartQuiz: () => void
}

function HeadlineStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-4 shadow-[var(--shadow-sm)]">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-semibold text-slate-900">{value}</span>
    </div>
  )
}

export default function ParkinsonsProgress({ onBack, onStartQuiz }: ParkinsonsProgressProps) {
  const [progress, setProgress] = useState<PkProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getParkinsonsProgress()
      .then((res) => {
        if (active) setProgress(res)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load progress.')
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <h2 className="text-lg font-semibold text-slate-900">Learning progress</h2>

      {error && (
        <p className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {!progress && !error && (
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] border border-slate-200 bg-slate-50" />
      )}

      {progress && !progress.has_activity && (
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-dashed border-slate-300 bg-white p-8">
          <p className="text-sm text-slate-500">
            You haven&apos;t completed any training quizzes yet. Your quiz score, XP, streak and
            per-symptom progress will show up here.
          </p>
          <button
            type="button"
            onClick={onStartQuiz}
            className="rounded-[var(--radius-md)] bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            Start a quiz
          </button>
        </div>
      )}

      {progress && progress.has_activity && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeadlineStat
              icon={<ListChecks size={13} />}
              label="Quiz score"
              value={`${progress.overall_accuracy_pct}%`}
            />
            <HeadlineStat
              icon={<Trophy size={13} />}
              label="Quizzes done"
              value={`${progress.quizzes_completed}`}
            />
            <HeadlineStat icon={<Star size={13} />} label="Total XP" value={`${progress.total_xp}`} />
            <HeadlineStat
              icon={<Flame size={13} />}
              label="Best streak"
              value={`${progress.best_streak}`}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-5 shadow-[var(--shadow-sm)]">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Performance by symptom
            </span>
            <p className="text-[11px] text-slate-400">
              Recognition accuracy in training — how often you identified each pattern correctly.
            </p>
            <div className="flex flex-col gap-3">
              {progress.symptom_progress.map((s) => (
                <div key={s.symptom_id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{s.display_name}</span>
                    <span className="text-slate-400">
                      {s.attempts === 0 ? (
                        'Not practised'
                      ) : (
                        <>
                          <span className={accuracyTone(s.accuracy_pct)}>
                            {s.correct}/{s.attempts} · {s.accuracy_pct}%
                          </span>
                          <span className="ml-2 text-[11px]">
                            {relativeDate(s.last_practiced_at)}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${accuracyBar(s.accuracy_pct)}`}
                      style={{ width: `${s.attempts === 0 ? 0 : s.accuracy_pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {progress.strongest_symptoms.length > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Strongest
                </span>
                <p className="mt-1 text-sm text-emerald-900">
                  {progress.strongest_symptoms.join(', ')}
                </p>
              </div>
            )}
            {progress.weakest_symptoms.length > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                  Keep practising
                </span>
                <p className="mt-1 text-sm text-amber-900">
                  {progress.weakest_symptoms.join(', ')}
                </p>
              </div>
            )}
          </div>

          <ParkinsonsHistory />
        </>
      )}
    </div>
  )
}
