import { Flame, Star } from 'lucide-react'

interface ParkinsonsQuizHeaderProps {
  questionNumber: number
  totalQuestions: number
  score: number
  answered: number
  xp: number
  streak: number
}

export default function ParkinsonsQuizHeader({
  questionNumber,
  totalQuestions,
  score,
  answered,
  xp,
  streak,
}: ParkinsonsQuizHeaderProps) {
  const progress = totalQuestions > 0 ? Math.min(100, (questionNumber - 1) / totalQuestions * 100) : 0

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">
          Question {Math.min(questionNumber, totalQuestions)} of {totalQuestions}
        </span>
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            Score {score}/{answered}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-600">
            <Flame size={13} />
            {streak}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-violet-600">
            <Star size={13} />
            {xp} XP
          </span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
