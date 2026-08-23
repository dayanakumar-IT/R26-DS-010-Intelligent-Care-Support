import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '../../../../shared/components/Button'
import { CaregiverAvatar } from '../../../../components/signVitals/CaregiverAvatar'
import { LessonProgress } from './LessonProgress'
import { SurfaceCard } from './SurfaceCard'

export type QuizOption = {
  id: string
  label: string
}

const CELEBRATION_PTS = 160

type GameQuizProps = {
  questionIndex: number
  totalQuestions: number
  score: number
  streak: number
  rewardPoints: number
  correctId: string
  options: QuizOption[]
  onAnswer: (correct: boolean, selectedId: string) => void
  onAdvance?: () => void
  tutorWord: string
  tutorReplayKey?: number
  onReplaySign?: () => void
}

function MiniAvatarThumb({ label }: { label: string }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white text-xs font-bold text-violet-700 shadow-sm">
      {label.slice(0, 1)}
    </div>
  )
}

function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 6) * 0.05}s`,
        rotate: `${i * 24}deg`,
        bg: ['#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa'][i % 5]!,
      })),
    [],
  )

  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-1/2 h-2 w-2 animate-[pop_0.9s_ease-out_forwards] rounded-sm opacity-90"
          style={{
            left: p.left,
            background: p.bg,
            transform: `translateY(-50%) rotate(${p.rotate})`,
            animationDelay: p.delay,
          }}
        />
      ))}
      <style>{`
        @keyframes pop {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(-140px) translateX(28px) rotate(180deg) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export function GameQuiz({
  questionIndex,
  totalQuestions,
  score,
  streak,
  rewardPoints,
  correctId,
  options,
  onAnswer,
  onAdvance,
  tutorWord,
  tutorReplayKey = 0,
  onReplaySign,
}: GameQuizProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  const progress = Math.round((questionIndex / Math.max(1, totalQuestions)) * 100)

  const handlePick = (id: string) => {
    if (locked) return
    setPicked(id)
    setLocked(true)
    onAnswer(id === correctId, id)
  }

  const showCorrect = picked && picked === correctId
  const showWrong = picked && picked !== correctId
  const correctLabel = options.find((o) => o.id === correctId)?.label

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Let&apos;s Play &amp; Learn!</h1>
        <p className="mt-2 text-lg text-slate-600">Pick the meaning of the sign. Caregiver-friendly and stress-free.</p>
      </div>

      <div className="relative">
        <ConfettiBurst active={!!showCorrect} />
        <SurfaceCard
          accent="purple"
          title="What does this sign mean?"
          titleAside={
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">+{rewardPoints} pts</span>
          }
        >
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
            <div className="relative flex w-full max-w-md flex-col items-stretch rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-3 shadow-inner">
              <div className="flex justify-center pb-2">
                <CaregiverAvatar lessonWord={tutorWord} compact replayKey={tutorReplayKey} />
              </div>
            </div>
            <div className="w-full flex-1 space-y-3">
              {options.map((opt) => {
                const selected = picked === opt.id
                const isCorrect = opt.id === correctId
                const cls = [
                  'flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-transform duration-150',
                  locked && isCorrect ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200/60' : '',
                  locked && selected && !isCorrect ? 'border-red-300 bg-red-50' : '',
                  !locked ? 'border-slate-200 bg-white hover:scale-[1.02] hover:border-violet-200 hover:shadow-md' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button key={opt.id} type="button" disabled={locked} onClick={() => handlePick(opt.id)} className={cls}>
                    <MiniAvatarThumb label={opt.label} />
                    <span className="text-base font-semibold text-slate-900">{opt.label}</span>
                    {locked && isCorrect ? (
                      <span className="ml-auto flex h-9 w-9 animate-[bounce-sm_0.6s_ease-out] items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                        <Check className="h-5 w-5" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
          <style>{`
            @keyframes bounce-sm {
              0% { transform: scale(0); }
              55% { transform: scale(1.15); }
              100% { transform: scale(1); }
            }
          `}</style>

          {showWrong ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-red-100 bg-red-50/85 px-4 py-3 text-sm text-red-950">
              <p>
                Gentle heads-up — the correct answer is <strong>{correctLabel}</strong>.
              </p>
              <p className="text-red-900/90">
                You&apos;re still doing great. Caregiving learning is about steady tries, not perfection on the first tap.
              </p>
              {onReplaySign ? (
                <button
                  type="button"
                  onClick={onReplaySign}
                  className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:scale-[1.03]"
                >
                  Replay demonstration
                </button>
              ) : null}
            </div>
          ) : null}
          {showCorrect ? (
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-4 text-emerald-950 shadow-inner">
              <p className="text-base font-bold">
                Great job! <span className="text-emerald-700">+{CELEBRATION_PTS} pts</span> added to your score
              </p>
              <p className="mt-1 text-sm text-emerald-900/90">
                Streak energy up — that sign means <strong>{correctLabel}</strong>.
              </p>
              <span className="pointer-events-none absolute -right-2 -top-2 text-5xl opacity-[0.12]">★</span>
            </div>
          ) : null}
        </SurfaceCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SurfaceCard title="Score">
          <div className="text-3xl font-black text-slate-900 tabular-nums">{score}</div>
          <p className="text-xs text-slate-500">Points this round</p>
        </SurfaceCard>
        <SurfaceCard title="Streak">
          <div className="text-3xl font-black text-amber-600 tabular-nums">{streak}</div>
          <p className="text-xs text-slate-500">You&apos;re building rhythm</p>
        </SurfaceCard>
        <SurfaceCard title="Progress">
          <LessonProgress current={questionIndex} total={totalQuestions} variant="purple" />
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-400 transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </SurfaceCard>
      </div>

      {locked ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            className="min-w-[180px] transition hover:scale-[1.03]"
            onClick={() => {
              setPicked(null)
              setLocked(false)
              onAdvance?.()
            }}
          >
            Continue
          </Button>
        </div>
      ) : null}
    </div>
  )
}
