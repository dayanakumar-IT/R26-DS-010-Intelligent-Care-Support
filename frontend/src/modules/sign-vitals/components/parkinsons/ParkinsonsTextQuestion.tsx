import { BookOpen } from 'lucide-react'
import type { PkQuizQuestion } from '../../types/parkinsons'
import ParkinsonsAnswerOptions from './ParkinsonsAnswerOptions'

interface ParkinsonsTextQuestionProps {
  question: PkQuizQuestion
  selected: string | null
  onSelect: (symptomId: string) => void
  submitted: boolean
  correctSymptomId: string | null
}

export default function ParkinsonsTextQuestion({
  question,
  selected,
  onSelect,
  submitted,
  correctSymptomId,
}: ParkinsonsTextQuestionProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <BookOpen size={14} />
        Symptom-recognition question
      </div>
      <p className="text-base font-medium leading-relaxed text-slate-900">{question.prompt}</p>
      <ParkinsonsAnswerOptions
        choices={question.choices}
        selected={selected}
        onSelect={onSelect}
        submitted={submitted}
        correctSymptomId={correctSymptomId}
      />
    </div>
  )
}
