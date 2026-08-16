import { ElderAvatar } from '../../../../components/signVitals/ElderAvatar'
import { Button } from '../../../../shared/components/Button'
import {
  PARKINSON_LESSON_COPY,
  PARKINSON_LESSON_META,
  lessonTitleToElderPose,
  type ParkinsonLessonId,
} from '../../data/parkinsonLessonData'
import { LessonProgress } from '../caresense/LessonProgress'
import { SurfaceCard } from '../caresense/SurfaceCard'

type ParkinsonLessonScreenProps = {
  lessonId: ParkinsonLessonId
  replayTick: number
  slowMo: boolean
  onReplay: () => void
  onToggleSlow: () => void
  lessonIndexAmongAll: number
  totalLessons: number
  sessionScore: number
  streak: number
  quizProgressPct: number
  onBeginQuiz: () => void
  onBackDashboard: () => void
}

export function ParkinsonLessonScreen({
  lessonId,
  replayTick,
  slowMo,
  onReplay,
  onToggleSlow,
  lessonIndexAmongAll,
  totalLessons,
  sessionScore,
  streak,
  quizProgressPct,
  onBeginQuiz,
  onBackDashboard,
}: ParkinsonLessonScreenProps) {
  const meta = PARKINSON_LESSON_META[lessonId]
  const copy = PARKINSON_LESSON_COPY[lessonId]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" className="-ml-3 w-fit text-emerald-700 hover:text-emerald-800" onClick={onBackDashboard} type="button">
          ← Lesson dashboard
        </Button>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Lesson study</p>
        <h1 className="text-3xl font-bold text-slate-900">{lessonId}</h1>
        <p className="max-w-3xl text-slate-600">
          Read the vignette, note caregiver responses, then complete the observation quiz. No camera — competency only.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SurfaceCard accent="green" title="Session score">
          <div className="text-3xl font-black tabular-nums text-slate-900">{sessionScore}</div>
          <p className="mt-1 text-xs text-slate-500">Points earned this visit</p>
        </SurfaceCard>
        <SurfaceCard accent="green" title="Streak">
          <div className="text-3xl font-black tabular-nums text-amber-600">{streak}</div>
          <p className="mt-1 text-xs text-slate-500">Correct streak (resets if you miss)</p>
        </SurfaceCard>
        <SurfaceCard accent="purple" title="Track progress">
          <LessonProgress current={lessonIndexAmongAll} total={totalLessons} label="Lesson path" variant="green" />
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-violet-400 transition-[width] duration-700 ease-out"
              style={{ width: `${quizProgressPct}%` }}
            />
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard accent="green" title="Scenario demonstration" titleAside={<span className="text-xs text-emerald-800">Visual tutor</span>}>
          <div className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white p-6">
            <div
              key={`${lessonId}-${replayTick}`}
              className={`w-full max-w-[260px] transition-transform ${slowMo ? 'duration-[3.8s] ease-linear scale-[0.96]' : 'duration-700 ease-out scale-100'}`}
            >
              <ElderAvatar pose={lessonTitleToElderPose(lessonId)} />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button size="sm" variant={slowMo ? 'primary' : 'ghost'} type="button" className="transition hover:scale-[1.03]" onClick={onToggleSlow}>
                Slow Motion
              </Button>
              <Button size="sm" variant="secondary" type="button" className="transition hover:scale-[1.03]" onClick={onReplay}>
                Replay
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              Tremor arcs and pacing are illustrative only — caregiver education, not a clinical readout.
            </p>
          </div>
        </SurfaceCard>

        <div className="space-y-4">
          <SurfaceCard accent="neutral" title="Educational explanation">
            <p className="text-sm text-slate-700">{meta.cardTeaser}</p>
            <p className="mt-3 text-xs text-slate-500">{copy.education}</p>
          </SurfaceCard>

          <SurfaceCard id="sv-indicators-panel" accent="neutral" title="Key indicators">
            <ul className="space-y-2">
              {copy.bullets.map((b) => (
                <li key={b} className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700">
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900">
              <strong>Caregiver response:</strong> {copy.caregiver}
            </div>
          </SurfaceCard>
        </div>
      </div>

      <SurfaceCard accent="green" title={meta.observeQuestion}>
        <ul className="space-y-2">
          {meta.observeBullets.map((line) => (
            <li key={line} className="rounded-xl border border-emerald-50 bg-emerald-50/35 px-3 py-2 text-sm text-slate-700">
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="transition hover:scale-[1.03]" onClick={onBeginQuiz} type="button">
            Start competency quiz
          </Button>
        </div>
      </SurfaceCard>
    </div>
  )
}
