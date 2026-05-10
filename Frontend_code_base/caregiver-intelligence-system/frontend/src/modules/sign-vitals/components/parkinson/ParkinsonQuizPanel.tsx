import { Check } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ElderAvatar } from '../../../../components/signVitals/ElderAvatar'
import { Button } from '../../../../shared/components/Button'
import { PARKINSON_QUIZ_OPTIONS, type ParkinsonLessonId, type ParkinsonQuizQuestion } from '../../data/parkinsonLessonData'
import { LessonProgress } from '../caresense/LessonProgress'
import { SurfaceCard } from '../caresense/SurfaceCard'

const PTS_PER_CORRECT = 140

export type ParkinsonQuizFinishStats = {
  accuracy: number
  correctCount: number
  total: number
  sessionScore: number
  sessionStreakEnd: number
  maxStreakInRow: number
  missedLabels: ParkinsonLessonId[]
  tremorLessonCorrectWithoutMiss: boolean
  perfectRun: boolean
}

type ParkinsonQuizPanelProps = {
  lessonTitle: ParkinsonLessonId
  questions: ParkinsonQuizQuestion[]
  rewardPointsStore: number
  onBackToLesson: () => void
  onFinish: (stats: ParkinsonQuizFinishStats) => void
  addRewardPoints: (n: number) => void
}

function shuffleOptions(seed: string, opts: ParkinsonLessonId[]): ParkinsonLessonId[] {
  const arr = [...opts]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: `${(i * 41) % 100}%`,
        delay: `${(i % 6) * 0.05}s`,
        rotate: `${i * 22}deg`,
        bg: ['#34d399', '#6ee7b7', '#a7f3d0', '#bbf7d0', '#d8b4fe'][i % 5]!,
      })),
    [],
  )

  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-1/2 h-2 w-2 animate-[parkPop_0.9s_ease-out_forwards] rounded-sm opacity-90"
          style={{
            left: p.left,
            background: p.bg,
            transform: `translateY(-50%) rotate(${p.rotate})`,
            animationDelay: p.delay,
          }}
        />
      ))}
      <style>{`
        @keyframes parkPop {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(-130px) translateX(24px) rotate(180deg) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function OptionMini({ label }: { label: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white text-xs font-black text-emerald-800 shadow-sm">
      {label.slice(0, 2).toUpperCase()}
    </div>
  )
}

export function ParkinsonQuizPanel({
  lessonTitle,
  questions,
  rewardPointsStore,
  onBackToLesson,
  onFinish,
  addRewardPoints,
}: ParkinsonQuizPanelProps) {
  const [qIdx, setQIdx] = useState(0)
  const [picked, setPicked] = useState<ParkinsonLessonId | null>(null)
  const [locked, setLocked] = useState(false)
  const [sessionScore, setSessionScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [misses, setMisses] = useState<ParkinsonLessonId[]>([])
  const correctRef = useRef(0)
  const [missedRestingTremor, setMissedRestingTremor] = useState(false)
  const [answeredRestingTremorCorrect, setAnsweredRestingTremorCorrect] = useState(false)

  const q = questions[qIdx]!

  const shuffledOpts = useMemo(() => shuffleOptions(q.id + lessonTitle, PARKINSON_QUIZ_OPTIONS), [q.id, lessonTitle])

  const progressPct = Math.round(((qIdx + (locked ? 1 : 0)) / Math.max(questions.length, 1)) * 100)

  const resetQuestionUi = () => {
    setPicked(null)
    setLocked(false)
  }

  const advance = () => {
    resetQuestionUi()
    if (qIdx + 1 >= questions.length) {
      const total = questions.length
      const rights = correctRef.current
      const acc = Math.round((rights / Math.max(total, 1)) * 100)
      onFinish({
        accuracy: acc,
        correctCount: rights,
        total,
        sessionScore,
        sessionStreakEnd: streak,
        maxStreakInRow: maxStreak,
        missedLabels: [...new Set(misses)],
        tremorLessonCorrectWithoutMiss: answeredRestingTremorCorrect && !missedRestingTremor,
        perfectRun: rights === total,
      })
    } else {
      setQIdx((i) => i + 1)
    }
  }

  const handlePick = useCallback(
    (id: ParkinsonLessonId) => {
      if (locked) return
      setPicked(id)
      setLocked(true)
      const ok = id === q.correct
      if (q.correct === 'Resting Tremor') {
        if (!ok) {
          setMissedRestingTremor(true)
        } else {
          setAnsweredRestingTremorCorrect(true)
        }
      }
      if (ok) {
        correctRef.current += 1
        setSessionScore((s) => s + PTS_PER_CORRECT)
        setStreak((s) => {
          const ns = s + 1
          setMaxStreak((mx) => Math.max(mx, ns))
          return ns
        })
        addRewardPoints(PTS_PER_CORRECT)
      } else {
        setStreak(0)
        setMisses((m) => [...m, q.correct])
      }
    },
    [addRewardPoints, locked, q],
  )

  const showCorrect = locked && picked === q.correct
  const showWrong = locked && picked !== q.correct

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" className="text-emerald-700 hover:text-emerald-800" onClick={onBackToLesson} type="button">
          ← Lesson review
        </Button>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
          Observation quiz · {lessonTitle}
        </span>
      </div>

      <div className="text-center md:text-left">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">What symptom is shown in this example?</h1>
        <p className="mt-2 text-slate-600">Educational vignette — pick the caregiver-training label that best matches the illustration.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SurfaceCard accent="green" title="Score">
          <div className="text-3xl font-black tabular-nums text-emerald-800">{sessionScore}</div>
          <p className="text-xs text-slate-500">This quiz session (+{PTS_PER_CORRECT}/correct)</p>
        </SurfaceCard>
        <SurfaceCard accent="green" title="Streak">
          <div className="text-3xl font-black tabular-nums text-amber-600">{streak}</div>
          <p className="text-xs text-slate-500">Rebuilds after a miss — stay curious</p>
        </SurfaceCard>
        <SurfaceCard accent="purple" title="Progress">
          <LessonProgress current={qIdx + 1} total={questions.length} label="Questions" variant="green" />
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-violet-400 transition-[width] duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Lifetime pts (store snapshot): {rewardPointsStore}</div>
        </SurfaceCard>
      </div>

      <div className="relative">
        <ConfettiBurst active={!!showCorrect} />
        <SurfaceCard accent="green" title="Observation vignette" titleAside={<span className="text-xs text-emerald-800">Quiz</span>}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex w-full justify-center lg:max-w-sm">
              <div className="w-full rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-inner">
                <div className="mx-auto max-w-[220px] py-3">
                  <ElderAvatar key={q.id} pose={q.pose} />
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              {shuffledOpts.map((opt) => {
                const selected = picked === opt
                const isCorr = opt === q.correct
                const cls = [
                  'flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-transform duration-150',
                  locked && isCorr ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200/60' : '',
                  locked && selected && !isCorr ? 'border-red-300 bg-red-50' : '',
                  !locked ? 'border-slate-200 bg-white hover:scale-[1.02] hover:border-emerald-200 hover:shadow-md' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button key={opt} type="button" disabled={locked} className={cls} onClick={() => handlePick(opt)}>
                    <OptionMini label={opt} />
                    <span className="text-base font-semibold text-slate-900">{opt}</span>
                    {locked && isCorr ? (
                      <span className="ml-auto flex h-9 w-9 animate-[bounceSm_0.6s_ease-out] items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                        <Check className="h-5 w-5" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <style>{`
            @keyframes bounceSm {
              0% { transform: scale(0); }
              55% { transform: scale(1.15); }
              100% { transform: scale(1); }
            }
          `}</style>

          {showWrong ? (
            <div className="mt-4 space-y-2 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-950">
              <p>
                <strong>Gentle coaching:</strong> This example highlights <strong>{q.correct}</strong> — {q.confusion}
              </p>
            </div>
          ) : null}

          {showCorrect ? (
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-4 py-4 text-emerald-950 shadow-inner">
              <p className="text-lg font-bold">Correct! Great observation.</p>
              <p className="mt-2 text-lg font-semibold text-emerald-700">+{PTS_PER_CORRECT} reward points</p>
              <span className="pointer-events-none absolute -right-1 -top-1 text-4xl opacity-10">★</span>
            </div>
          ) : null}

          <SurfaceCard accent="neutral" title="Educational coaching" className="mt-5 border-dashed shadow-none ring-1 ring-slate-100">
            {!locked ? (
              <p className="text-sm text-slate-500">Select an answer — we&apos;ll unpack the observation cues afterward.</p>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="rounded-xl border border-emerald-50 bg-emerald-50/40 p-3">
                  <dt className="font-bold text-emerald-900">Why this label fits</dt>
                  <dd className="mt-1 text-slate-700">{q.whyCorrect}</dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <dt className="font-bold text-slate-800">What to observe next time</dt>
                  <dd className="mt-1 text-slate-600">{q.observe}</dd>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/35 p-3">
                  <dt className="font-bold text-amber-900">Common confusion points</dt>
                  <dd className="mt-1 text-slate-700">{q.confusion}</dd>
                </div>
              </dl>
            )}
          </SurfaceCard>

          {locked ? (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" className="min-w-[160px] transition hover:scale-[1.03]" type="button" onClick={advance}>
                Continue
              </Button>
            </div>
          ) : null}
        </SurfaceCard>
      </div>
    </div>
  )
}
