import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ParkinsonLessonDashboard } from '../components/parkinson/ParkinsonLessonDashboard'
import { ParkinsonLessonScreen } from '../components/parkinson/ParkinsonLessonScreen'
import { ParkinsonLessonSummary } from '../components/parkinson/ParkinsonLessonSummary'
import { ParkinsonQuizPanel, type ParkinsonQuizFinishStats } from '../components/parkinson/ParkinsonQuizPanel'
import {
  PARKINSON_LESSON_ORDER,
  PARKINSON_LESSON_QUIZZES,
  type ParkinsonLessonId,
} from '../data/parkinsonLessonData'
import { useSignVitalsStore } from '../store/signVitalsStore'

type Flow = 'dashboard' | 'lesson' | 'quiz' | 'summary'

export function ParkinsonsVitalsPage() {
  const [flow, setFlow] = useState<Flow>('dashboard')
  const [activeLesson, setActiveLesson] = useState<ParkinsonLessonId | null>(null)
  const [replayTick, setReplayTick] = useState(0)
  const [slowMo, setSlowMo] = useState(false)
  const [quizStats, setQuizStats] = useState<ParkinsonQuizFinishStats | null>(null)

  const parkinsonLessonProgress = useSignVitalsStore((s) => s.parkinsonLessonProgress)
  const achievements = useSignVitalsStore((s) => s.achievements)
  const rewardPoints = useSignVitalsStore((s) => s.rewardPoints)
  const addRewardPoints = useSignVitalsStore((s) => s.addRewardPoints)
  const recordParkinsonQuizComplete = useSignVitalsStore((s) => s.recordParkinsonQuizComplete)
  const unlockAchievement = useSignVitalsStore((s) => s.unlockAchievement)

  const wasFirstCompletionRef = useRef(false)

  const lessonIndexAmongAll = activeLesson ? PARKINSON_LESSON_ORDER.indexOf(activeLesson) + 1 : 1

  const openLesson = (id: ParkinsonLessonId) => {
    setActiveLesson(id)
    setReplayTick(0)
    setSlowMo(false)
    wasFirstCompletionRef.current = !parkinsonLessonProgress[id]?.completed
    setFlow('lesson')
  }

  const handleQuizFinish = (stats: ParkinsonQuizFinishStats) => {
    if (!activeLesson) return
    recordParkinsonQuizComplete(activeLesson, stats.accuracy)

    if (stats.perfectRun) unlockAchievement('observationExpert')
    if (stats.maxStreakInRow >= 4) unlockAchievement('consistentCaregiver')
    if (stats.tremorLessonCorrectWithoutMiss) unlockAchievement('tremorSpotter')
    if (stats.accuracy >= 85 && wasFirstCompletionRef.current) unlockAchievement('quickLearner')

    setQuizStats(stats)
    setFlow('summary')
  }

  return (
    <div className="min-h-[60vh] space-y-8">
      {flow === 'dashboard' ? (
        <>
          <div className="flex flex-col gap-2">
            <Link to="/sign-vitals" className="text-sm font-semibold text-emerald-700 hover:underline">
              ← Back to Sign &amp; Vitals
            </Link>
          </div>
          <ParkinsonLessonDashboard
            progress={parkinsonLessonProgress}
            achievements={achievements}
            rewardPoints={rewardPoints}
            onStartLesson={openLesson}
          />
        </>
      ) : null}

      {flow === 'lesson' && activeLesson ? (
        <>
          <ParkinsonLessonScreen
            lessonId={activeLesson}
            replayTick={replayTick}
            slowMo={slowMo}
            onReplay={() => setReplayTick((t) => t + 1)}
            onToggleSlow={() => setSlowMo((s) => !s)}
            lessonIndexAmongAll={lessonIndexAmongAll}
            totalLessons={PARKINSON_LESSON_ORDER.length}
            sessionScore={0}
            streak={0}
            quizProgressPct={0}
            onBeginQuiz={() => setFlow('quiz')}
            onBackDashboard={() => {
              setActiveLesson(null)
              setFlow('dashboard')
            }}
          />
        </>
      ) : null}

      {flow === 'quiz' && activeLesson ? (
        <ParkinsonQuizPanel
          key={activeLesson}
          lessonTitle={activeLesson}
          questions={PARKINSON_LESSON_QUIZZES[activeLesson]}
          rewardPointsStore={rewardPoints}
          addRewardPoints={addRewardPoints}
          onBackToLesson={() => setFlow('lesson')}
          onFinish={handleQuizFinish}
        />
      ) : null}

      {flow === 'summary' && activeLesson && quizStats ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Link to="/sign-vitals" className="text-sm font-semibold text-emerald-700 hover:underline">
              ← Sign &amp; Vitals home
            </Link>
          </div>
          <ParkinsonLessonSummary
            lessonId={activeLesson}
            stats={quizStats}
            onBackDashboard={() => {
              setActiveLesson(null)
              setQuizStats(null)
              setFlow('dashboard')
            }}
            onReplayLesson={() => {
              setQuizStats(null)
              setReplayTick(0)
              setSlowMo(false)
              setFlow('lesson')
            }}
          />
        </>
      ) : null}
    </div>
  )
}
