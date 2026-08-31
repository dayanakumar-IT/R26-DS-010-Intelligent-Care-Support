import type { PkQuizQuestion } from '../../types/parkinsons'
import ParkinsonsTextQuestion from './ParkinsonsTextQuestion'
import ParkinsonsVideoQuestion from './ParkinsonsVideoQuestion'

interface ParkinsonsQuizCardProps {
  question: PkQuizQuestion
  selected: string | null
  onSelect: (symptomId: string) => void
  submitted: boolean
  correctSymptomId: string | null
  submitting: boolean
  onSubmit: () => void
}

export default function ParkinsonsQuizCard({
  question,
  selected,
  onSelect,
  submitted,
  correctSymptomId,
  submitting,
  onSubmit,
}: ParkinsonsQuizCardProps) {
  return (
    <div className="flex flex-col gap-6 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm)]">
      {question.format === 'video' ? (
        <ParkinsonsVideoQuestion
          question={question}
          selected={selected}
          onSelect={onSelect}
          submitted={submitted}
          correctSymptomId={correctSymptomId}
        />
      ) : (
        <ParkinsonsTextQuestion
          question={question}
          selected={selected}
          onSelect={onSelect}
          submitted={submitted}
          correctSymptomId={correctSymptomId}
        />
      )}

      {!submitted && (
        <button
          type="button"
          disabled={!selected || submitting}
          onClick={onSubmit}
          className="inline-flex items-center justify-center self-start rounded-[var(--radius-md)] bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Checking…' : 'Submit answer'}
        </button>
      )}
    </div>
  )
}
