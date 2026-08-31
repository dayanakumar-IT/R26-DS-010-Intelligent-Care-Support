import { useCallback } from 'react'
import { Film } from 'lucide-react'
import type { PkQuizQuestion } from '../../types/parkinsons'
import { getQuestionDemoVideo } from '../../services/parkinsonsApi'
import ParkinsonsAnswerOptions from './ParkinsonsAnswerOptions'
import ParkinsonsVideoPlayer from './ParkinsonsVideoPlayer'

interface ParkinsonsVideoQuestionProps {
  question: PkQuizQuestion
  selected: string | null
  onSelect: (symptomId: string) => void
  submitted: boolean
  correctSymptomId: string | null
}

export default function ParkinsonsVideoQuestion({
  question,
  selected,
  onSelect,
  submitted,
  correctSymptomId,
}: ParkinsonsVideoQuestionProps) {
  // Fetched by question id — the response never contains the symptom,
  // so watching the clip cannot reveal the answer.
  const fetchUrl = useCallback(
    () => getQuestionDemoVideo(question.question_id),
    [question.question_id],
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Film size={14} />
        Watch the movement
      </div>

      <ParkinsonsVideoPlayer key={question.question_id} fetchUrl={fetchUrl} />

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
