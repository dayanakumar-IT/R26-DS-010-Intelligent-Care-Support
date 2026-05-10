import { Star } from 'lucide-react'
import { Button } from '../../../../shared/components/Button'
import { PARKINSON_LESSON_ORDER, type ParkinsonLessonId } from '../../data/parkinsonLessonData'
import type { ParkinsonQuizFinishStats } from './ParkinsonQuizPanel'
import { SurfaceCard } from '../caresense/SurfaceCard'

type ParkinsonLessonSummaryProps = {
  lessonId: ParkinsonLessonId
  stats: ParkinsonQuizFinishStats
  onBackDashboard: () => void
  onReplayLesson: () => void
}

function starsForAccuracy(a: number) {
  if (a >= 90) return 3
  if (a >= 75) return 2
  if (a >= 50) return 1
  return 0
}

export function ParkinsonLessonSummary({ lessonId, stats, onBackDashboard, onReplayLesson }: ParkinsonLessonSummaryProps) {
  const stars = starsForAccuracy(stats.accuracy)
  const idx = PARKINSON_LESSON_ORDER.indexOf(lessonId)
  const nextLesson = PARKINSON_LESSON_ORDER[idx + 1]

  const strengths: string[] = []
  if (stats.perfectRun) strengths.push('Flawless observation pass on this vignette set')
  if (stats.maxStreakInRow >= 3) strengths.push('Strong streak — you linked cues quickly')
  if (stats.accuracy >= 80) strengths.push('Solid label accuracy for caregiver tutoring')
  if (!strengths.length) strengths.push('You finished a full competency pass — that builds real-world readiness')

  const improvements: string[] = []
  if (stats.missedLabels.includes('Resting Tremor')) improvements.push('Review resting vs action-related movement with the tremor lesson cards')
  if (stats.missedLabels.includes('Bradykinesia')) improvements.push('Revisit bradykinesia pacing — narrate steps slowly during practice scenarios')
  if (stats.missedLabels.includes('Masked Face')) improvements.push('Contrast facial animation with spoken affect in the masked-face vignette')
  if (stats.missedLabels.includes('Postural Instability')) improvements.push('Re-scan environment + turning cues in the postural instability lesson')
  if (stats.missedLabels.includes('Rigidity')) improvements.push('Practice gentle range prompts from the rigidity caregiver-response card')
  if (!improvements.length && stats.accuracy < 100) improvements.push('Re-run the quiz to sharpen mixed-vignette discrimination')
  if (!improvements.length && stats.accuracy === 100) improvements.push('Schedule spaced revisit in a few days so cues stay effortless under stress')

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Lesson complete</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Great work on {lessonId}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Caregiver competency snapshot — educational only, not a clinical score.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SurfaceCard accent="green" title="Final score">
          <div className="text-4xl font-black tabular-nums text-emerald-800">{stats.sessionScore}</div>
          <p className="text-xs text-slate-500">Points from this quiz run</p>
        </SurfaceCard>
        <SurfaceCard accent="green" title="Accuracy">
          <div className="text-4xl font-black tabular-nums text-slate-900">{stats.accuracy}%</div>
          <p className="text-xs text-slate-500">
            {stats.correctCount}/{stats.total} vignettes matched
          </p>
        </SurfaceCard>
        <SurfaceCard accent="purple" title="Lesson stars">
          <div className="flex gap-1 text-amber-400">
            {[0, 1, 2].map((i) => (
              <Star key={i} className={`h-8 w-8 ${i < stars ? 'fill-amber-400' : 'fill-slate-200 text-slate-200'}`} />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Earned from this attempt (best is saved across visits)</p>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SurfaceCard title="Strengths">
          <ul className="space-y-2 text-sm text-slate-700">
            {strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-emerald-500">•</span>
                {s}
              </li>
            ))}
          </ul>
        </SurfaceCard>
        <SurfaceCard accent="green" title="Improvement ideas">
          <ul className="space-y-2 text-sm text-slate-700">
            {improvements.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-violet-500">•</span>
                {s}
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </div>

      <SurfaceCard accent="neutral" title="Recommended next step">
        <p className="text-sm text-slate-700">
          {nextLesson ? (
            <>
              Continue with <strong>{nextLesson}</strong> to broaden your observation vocabulary, or replay this lesson for
              mixed-vignette speed.
            </>
          ) : (
            <>You&apos;ve reached the end of the ordered track — revisit any card from the dashboard for spaced practice.</>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button className="transition hover:scale-[1.03]" onClick={onBackDashboard} type="button">
            Return to lesson dashboard
          </Button>
          <Button variant="secondary" className="transition hover:scale-[1.03]" onClick={onReplayLesson} type="button">
            Review lesson & quiz again
          </Button>
        </div>
      </SurfaceCard>
    </div>
  )
}
