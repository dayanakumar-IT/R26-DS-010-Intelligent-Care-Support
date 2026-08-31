import { CheckCircle2, XCircle } from 'lucide-react'
import Button from '../../../shared/components/Button'
import type { PdeduResponseResult } from '../types/pdedu'

interface AnswerFeedbackCardProps {
  result: PdeduResponseResult
  correctSymptomDisplayName: string
  onContinue: () => void
}

export default function AnswerFeedbackCard({
  result,
  correctSymptomDisplayName,
  onContinue,
}: AnswerFeedbackCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm)]">
      <div
        className={`flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium ${
          result.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}
      >
        {result.is_correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        {result.is_correct ? 'Correct!' : `Not quite — the correct answer was ${correctSymptomDisplayName}.`}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Good to know
        </span>
        <p className="text-sm leading-relaxed text-slate-600">{result.extra_fact}</p>
      </div>

      <Button onClick={onContinue} className="self-start">
        Continue
      </Button>
    </div>
  )
}
