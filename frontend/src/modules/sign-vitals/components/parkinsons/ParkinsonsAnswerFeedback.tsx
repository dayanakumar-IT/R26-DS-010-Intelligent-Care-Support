import { ArrowRight, Brain, CheckCircle2, Lightbulb, XCircle } from 'lucide-react'
import type { PkAnswerResult } from '../../types/parkinsons'

interface ParkinsonsAnswerFeedbackProps {
  result: PkAnswerResult
  isLastQuestion: boolean
  onNext: () => void
}

export default function ParkinsonsAnswerFeedback({
  result,
  isLastQuestion,
  onNext,
}: ParkinsonsAnswerFeedbackProps) {
  const correct = result.is_correct

  return (
    <div
      className={`flex flex-col gap-4 rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-sm)] ${
        correct ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-2 text-sm font-semibold ${
            correct ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {correct ? 'Correct!' : 'Not quite.'}
        </div>
        {result.xp_awarded > 0 && (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-violet-600 shadow-[var(--shadow-sm)]">
            +{result.xp_awarded} XP
          </span>
        )}
      </div>

      {!correct && (
        <div className="text-sm text-slate-700">
          Correct answer: <strong className="text-slate-900">{result.correct_answer}</strong>
        </div>
      )}

      <div className="flex flex-col gap-1 rounded-[var(--radius-md)] bg-white/70 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why</span>
        <p className="text-sm leading-relaxed text-slate-700">{result.explanation}</p>
      </div>

      {result.tip && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-white/70 px-4 py-3 text-sm text-slate-700">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{result.tip}</span>
        </div>
      )}

      {result.memory_trick && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-white/70 px-4 py-3 text-sm text-slate-700">
          <Brain size={16} className="mt-0.5 shrink-0 text-violet-500" />
          <span>
            Remember: <span className="font-medium">{result.memory_trick}</span>
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center justify-center gap-2 self-start rounded-[var(--radius-md)] bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        {isLastQuestion ? 'See results' : 'Next question'}
        <ArrowRight size={15} />
      </button>
    </div>
  )
}
