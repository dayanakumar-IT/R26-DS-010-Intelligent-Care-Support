import { Check, X } from 'lucide-react'
import type { PkChoice } from '../../types/parkinsons'

interface ParkinsonsAnswerOptionsProps {
  choices: PkChoice[]
  selected: string | null
  onSelect: (symptomId: string) => void
  /** Once submitted, options lock and correct / chosen-wrong are marked. */
  submitted: boolean
  correctSymptomId: string | null
}

export default function ParkinsonsAnswerOptions({
  choices,
  selected,
  onSelect,
  submitted,
  correctSymptomId,
}: ParkinsonsAnswerOptionsProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {choices.map((choice, index) => {
        const isSelected = selected === choice.symptom_id
        const isCorrect = submitted && correctSymptomId === choice.symptom_id
        const isWrongChoice = submitted && isSelected && correctSymptomId !== choice.symptom_id

        let tone =
          'border-slate-200 bg-white text-slate-700 hover:border-violet-400 hover:bg-violet-50'
        if (!submitted && isSelected) {
          tone = 'border-violet-500 bg-violet-50 text-violet-900 ring-1 ring-violet-500'
        } else if (isCorrect) {
          tone = 'border-emerald-500 bg-emerald-50 text-emerald-900'
        } else if (isWrongChoice) {
          tone = 'border-rose-400 bg-rose-50 text-rose-900'
        } else if (submitted) {
          tone = 'border-slate-200 bg-white text-slate-400'
        }

        return (
          <button
            key={choice.symptom_id}
            type="button"
            disabled={submitted}
            onClick={() => onSelect(choice.symptom_id)}
            className={`flex items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left text-sm font-medium transition disabled:cursor-default ${tone}`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                isCorrect
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : isWrongChoice
                    ? 'border-rose-400 bg-rose-400 text-white'
                    : isSelected
                      ? 'border-violet-500 bg-violet-500 text-white'
                      : 'border-slate-300 text-slate-400'
              }`}
            >
              {isCorrect ? <Check size={14} /> : isWrongChoice ? <X size={14} /> : String.fromCharCode(65 + index)}
            </span>
            {choice.label}
          </button>
        )
      })}
    </div>
  )
}
