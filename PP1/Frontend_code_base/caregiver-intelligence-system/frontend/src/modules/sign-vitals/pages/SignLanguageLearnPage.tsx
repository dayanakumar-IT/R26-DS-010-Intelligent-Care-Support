import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CaregiverAvatar } from '../../../components/signVitals/CaregiverAvatar'
import { MediaPipeHandTracker, type HandDetectionStatus } from '../../../components/signVitals/MediaPipeHandTracker'
import { RealCameraPractice } from '../../../components/signVitals/RealCameraPractice'
import { Button } from '../../../shared/components/Button'
import type { FeedbackBreakdown } from '../components/caresense/FeedbackPanel'
import { FeedbackPanel } from '../components/caresense/FeedbackPanel'
import { LessonProgress } from '../components/caresense/LessonProgress'
import { SurfaceCard } from '../components/caresense/SurfaceCard'
import type { SignMatchResult } from '../../../utils/signMatching'
import { getSignLessons, useSignVitalsStore } from '../store/signVitalsStore'

function difficultyFromScore(score: number) {
  if (score < 60) return 'Beginner' as const
  if (score <= 85) return 'Intermediate' as const
  return 'Advanced' as const
}

function toFeedback(smoothed: number, f: SignMatchResult['feedback']): FeedbackBreakdown {
  const d = difficultyFromScore(smoothed)
  const tips = [
    !f.handShape.ok ? f.handShape.tip : null,
    !f.handPosition.ok ? f.handPosition.tip : null,
    !f.movementPath.ok ? f.movementPath.tip : null,
    !f.holdTime.ok ? f.holdTime.tip : null,
  ].filter(Boolean) as string[]
  if (f.movementPath.ok && !tips.some((t) => t.includes('direction'))) {
    tips.push('Movement direction is correct')
  }
  return {
    handShapeOk: f.handShape.ok,
    movementOk: f.movementPath.ok,
    speedOk: smoothed >= 55,
    finalPositionOk: f.holdTime.ok,
    speedNote: f.holdTime.tip,
    movementNote: f.movementPath.tip,
    shapeNote: f.handShape.tip,
    positionNote: f.handPosition.tip,
    score: smoothed,
    stars: Math.min(5, Math.max(1, Math.round(smoothed / 22))),
    correctiveTips: tips.length ? tips : ['Nice — keep shoulders relaxed and finish clean.'],
    adaptiveSuggestion: `Difficulty band: ${d} — ${
      d === 'Beginner'
        ? 'extra framing guides stay on until your hold stabilizes.'
        : d === 'Intermediate'
          ? 'micro-corrections focus on timing and palm openness.'
          : 'challenge lane: maintain crisp final holds for advanced drills.'
    }`,
  }
}

export function SignLanguageLearnPage() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { useCamera?: boolean } }
  const useCamera = location.state?.useCamera !== false

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [live, setLive] = useState<{
    score: number
    smoothed: number
    status: HandDetectionStatus
    fb: SignMatchResult['feedback'] | null
  }>({ score: 0, smoothed: 0, status: 'idle', fb: null })

  const [trackerKey, setTrackerKey] = useState(0)

  const lessonIndex = useSignVitalsStore((s) => s.lessonIndex)
  const setLandmarkMatchCorrect = useSignVitalsStore((s) => s.setLandmarkMatchCorrect)
  const nextSignLesson = useSignVitalsStore((s) => s.nextSignLesson)
  const prevSignLesson = useSignVitalsStore((s) => s.prevSignLesson)
  const resetLessonFeedback = useSignVitalsStore((s) => s.resetLessonFeedback)
  const bumpCompetency = useSignVitalsStore((s) => s.bumpCompetency)
  const addRewardPoints = useSignVitalsStore((s) => s.addRewardPoints)
  const unlockAchievement = useSignVitalsStore((s) => s.unlockAchievement)
  const lessons = getSignLessons()
  const lesson = lessons[lessonIndex] ?? lessons[0]

  const onMatch = useCallback(
    (r: SignMatchResult & { smoothedScore: number; status: HandDetectionStatus }) => {
      setLandmarkMatchCorrect(r.correct)
      setLive({
        score: r.score,
        smoothed: r.smoothedScore,
        status: r.status,
        fb: r.feedback,
      })
    },
    [setLandmarkMatchCorrect],
  )

  const feedback: FeedbackBreakdown = useMemo(() => {
    if (!live.fb) {
      return {
        handShapeOk: false,
        movementOk: false,
        speedOk: false,
        finalPositionOk: false,
        speedNote: 'Start your camera, then sign clearly in frame.',
        movementNote: 'Trace the tutor arc steadily.',
        shapeNote: 'Open your palm wider',
        positionNote: 'Move hand slightly higher',
        score: 0,
        stars: 1,
        correctiveTips: ['Open your palm wider', 'Hold the final position longer'],
        adaptiveSuggestion: 'Difficulty band: Beginner — enable the camera to unlock live coaching.',
      }
    }
    return toFeedback(live.smoothed, live.fb)
  }, [live])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 border-b border-violet-100/80 bg-white/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/sign-vitals"
          className="text-sm font-semibold text-violet-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600"
        >
          ← Back to Sign &amp; Vitals
        </Link>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
            {useCamera ? 'Camera practice · MediaPipe Hands' : 'Guided lane'}
          </span>
          <Button size="sm" variant="secondary" onClick={() => navigate('/sign-vitals/review')}>
            Finish &amp; review
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard
          accent="purple"
          title="Sign tutor"
          titleAside={<span className="text-xs font-medium text-slate-500">Animated reference</span>}
        >
          <LessonProgress
            current={lessonIndex + 1}
            total={lessons.length}
            label="Sign lesson pathway"
            variant="purple"
          />
          <div className="mt-6 flex flex-col items-center">
            <CaregiverAvatar lessonWord={lesson.word} showControls replayKey={`${lessonIndex}-${trackerKey}`} />
            <p className="mt-4 max-w-md text-center text-sm leading-relaxed text-slate-600">{lesson.hint}</p>
          </div>
        </SurfaceCard>

        <SurfaceCard
          accent="green"
          title="Live webcam & landmarks"
          titleAside={<span className="text-xs text-emerald-700">MediaPipe 0.10.14</span>}
        >
          <RealCameraPractice
            videoRef={videoRef}
            mirrored
            overlay={
              useCamera ? (
                <MediaPipeHandTracker
                  key={`${lesson.word}-${lessonIndex}-${trackerKey}`}
                  videoRef={videoRef}
                  targetWord={lesson.word}
                  mirrored
                  enabled
                  onMatch={onMatch}
                />
              ) : null
            }
          />
          {!useCamera ? (
            <p className="mt-3 text-sm text-slate-600">
              You opened the guided lane without camera.{' '}
              <button
                type="button"
                className="font-semibold text-violet-700 underline"
                onClick={() => navigate('/sign-vitals/sign-game')}
              >
                Switch to no-camera game
              </button>{' '}
              or allow camera next session for live overlays.
            </p>
          ) : null}
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Live tutor score</span>
              <span className="rounded-full bg-white px-3 py-0.5 text-lg font-bold text-emerald-800">{live.smoothed}%</span>
            </div>
            <p className="mt-2 text-xs text-emerald-800/90">
              Status:{' '}
              <strong>
                {live.status === 'tracking' || live.status === 'off_frame'
                  ? live.status === 'off_frame'
                    ? 'Adjust position'
                    : 'Tracking'
                  : live.status}
              </strong>{' '}
              — landmarks turn <span className="text-emerald-600">green</span> when the prototype rules align with{' '}
              <strong>{lesson.word}</strong>.
            </p>
          </div>
        </SurfaceCard>
      </div>

      <FeedbackPanel data={feedback} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              prevSignLesson()
              resetLessonFeedback()
              setTrackerKey((k) => k + 1)
            }}
          >
            Previous Sign
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              resetLessonFeedback()
              setTrackerKey((k) => k + 1)
              bumpCompetency(live.smoothed >= 68 ? 1 : -1)
            }}
          >
            Try Again
          </Button>
          <Button
            onClick={() => {
              nextSignLesson()
              addRewardPoints(live.smoothed >= 68 ? 40 : 10)
              if (live.smoothed >= 68) unlockAchievement('helpingHands')
              setTrackerKey((k) => k + 1)
            }}
          >
            Next Sign
          </Button>
        </div>
        <Button variant="ghost" onClick={() => navigate('/sign-vitals/review')}>
          Open sign review timeline
        </Button>
      </div>
    </div>
  )
}
