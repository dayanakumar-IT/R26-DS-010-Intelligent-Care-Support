import { HelpCircle, Lightbulb } from 'lucide-react'
import type { PdeduNextQuestion } from '../types/pdedu'

interface SymptomQuestionCardProps {
  question: PdeduNextQuestion
  onAnswer: (selectedSymptomId: string) => void
  disabled: boolean
}

// Scenario questions deliberately test whether the caregiver can identify
// the symptom from a description alone — showing the symptom's name/
// definition alongside a scenario would give the answer away. Direct
// questions already name the symptom in their own prompt, so showing that
// context there is just reinforcing what was just taught, not a giveaway.
export default function SymptomQuestionCard({ question, onAnswer, disabled }: SymptomQuestionCardProps) {
  const showSymptomContext = question.question_type !== 'scenario'

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm)]">
      {showSymptomContext ? (
        <div className="flex flex-col gap-1 rounded-[var(--radius-md)] bg-purple-50 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-purple-700">
            {question.symptom_display_name}
          </span>
          <p className="text-sm leading-relaxed text-purple-900">{question.symptom_definition}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <HelpCircle size={14} />
          Symptom scenario
        </div>
      )}

      <p className="text-base font-medium leading-relaxed text-slate-900">{question.prompt}</p>

      <div className="flex flex-col gap-3">
        {question.choices.map((choice) => (
          <button
            key={choice.symptom_id}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(choice.symptom_id)}
            className="flex items-start gap-3 rounded-[var(--radius-md)] border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-[var(--brand-purple)] hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-slate-300" />
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )
}
