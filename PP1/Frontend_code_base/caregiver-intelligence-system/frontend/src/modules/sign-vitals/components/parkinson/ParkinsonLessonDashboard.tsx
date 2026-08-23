import { Star } from 'lucide-react'
import { ElderAvatar } from '../../../../components/signVitals/ElderAvatar'
import { Button } from '../../../../shared/components/Button'
import {
  PARKINSON_BADGE_LABELS,
  PARKINSON_LESSON_META,
  PARKINSON_LESSON_ORDER,
  lessonTitleToElderPose,
  type ParkinsonLessonId,
} from '../../data/parkinsonLessonData'
import type { ParkinsonLessonProgressRow } from '../../store/signVitalsStore'
import { SurfaceCard } from '../caresense/SurfaceCard'

type ParkinsonLessonDashboardProps = {
  progress: Record<string, ParkinsonLessonProgressRow>
  achievements: Record<string, boolean>
  rewardPoints: number
  onStartLesson: (id: ParkinsonLessonId) => void
}

function starsRow(n: number) {
  return (
    <div className="flex gap-0.5 text-amber-400" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i < n ? 'fill-amber-400' : 'fill-slate-200 text-slate-200'}`} />
      ))}
    </div>
  )
}

export function ParkinsonLessonDashboard({
  progress,
  achievements,
  rewardPoints,
  onStartLesson,
}: ParkinsonLessonDashboardProps) {
  const badgeIds = Object.keys(PARKINSON_BADGE_LABELS)

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-100/90 bg-gradient-to-br from-white via-violet-50/40 to-emerald-50/50 p-6 shadow-[0_12px_40px_rgba(16,185,129,0.09)] md:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-200/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-violet-200/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Non-verbal sign vitals</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Caregiver observation · competency hub
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Educational tutoring only — symptom recognition drills, caregiver responses, and gentle quizzes. Not disease
              detection.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reward points</div>
              <div className="text-2xl font-black tabular-nums text-emerald-700">{rewardPoints}</div>
            </div>
          </div>
        </div>
      </div>

      <SurfaceCard accent="green" title="Achievement badges" titleAside={<span className="text-xs text-emerald-800">Unlocked in quiz play</span>}>
        <div className="flex flex-wrap gap-2">
          {badgeIds.map((id) => {
            const on = achievements[id]
            return (
              <span
                key={id}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                  on
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {PARKINSON_BADGE_LABELS[id] ?? id}
              </span>
            )
          })}
        </div>
      </SurfaceCard>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {PARKINSON_LESSON_ORDER.map((id) => {
          const meta = PARKINSON_LESSON_META[id]
          const row = progress[id]
          return (
            <div
              key={id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-emerald-100/90 bg-white/95 shadow-[0_10px_30px_rgba(16,185,129,0.06)] backdrop-blur-sm transition hover:shadow-[0_14px_36px_rgba(16,185,129,0.1)]"
            >
              <div className="flex items-center gap-4 border-b border-emerald-50/80 bg-gradient-to-r from-emerald-50/50 to-white p-5">
                <div className="relative w-[104px] shrink-0 rounded-2xl border border-emerald-100 bg-white p-2 shadow-inner">
                  <ElderAvatar pose={lessonTitleToElderPose(id)} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">{id}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                      {meta.difficulty}
                    </span>
                    <span className="text-slate-500">~{meta.minutes} min</span>
                    {row?.completed ? starsRow(row.stars) : <span className="text-slate-400">Not completed</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-4 p-5">
                <p className="text-sm leading-relaxed text-slate-600">{meta.cardTeaser}</p>
                {row?.bestAccuracy ? (
                  <p className="text-xs text-emerald-800">
                    Best quiz accuracy: <strong>{row.bestAccuracy}%</strong>
                  </p>
                ) : null}
                <Button
                  className="mt-auto w-full transition hover:scale-[1.02]"
                  onClick={() => onStartLesson(id)}
                  type="button"
                >
                  Start Lesson
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
