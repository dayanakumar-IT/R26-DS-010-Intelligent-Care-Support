import { useCallback, useState } from 'react'
import { ChevronLeft, Brain, Lightbulb, PlayCircle } from 'lucide-react'
import type { PkReviewItem } from '../../types/parkinsons'
import { getSymptomDemoVideo } from '../../services/parkinsonsApi'
import ParkinsonsVideoPlayer from './ParkinsonsVideoPlayer'

interface ParkinsonsReviewMistakesProps {
  review: PkReviewItem[]
  onBack: () => void
}

function ReviewCard({ item }: { item: PkReviewItem }) {
  const [showVideo, setShowVideo] = useState(false)
  const fetchUrl = useCallback(
    () => getSymptomDemoVideo(item.correct_symptom_id),
    [item.correct_symptom_id],
  )

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-5 shadow-[var(--shadow-sm)]">
      <p className="text-sm font-medium leading-relaxed text-slate-900">{item.prompt}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] bg-rose-50 px-3 py-2 text-sm">
          <span className="text-[11px] uppercase tracking-wide text-rose-500">Your answer</span>
          <p className="text-rose-900">{item.your_answer}</p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-emerald-50 px-3 py-2 text-sm">
          <span className="text-[11px] uppercase tracking-wide text-emerald-600">Correct answer</span>
          <p className="text-emerald-900">{item.correct_answer}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why</span>
        <p className="text-sm leading-relaxed text-slate-600">{item.explanation}</p>
      </div>

      {item.tip && (
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{item.tip}</span>
        </div>
      )}

      {item.memory_trick && (
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <Brain size={15} className="mt-0.5 shrink-0 text-violet-500" />
          <span>
            Remember: <span className="font-medium">{item.memory_trick}</span>
          </span>
        </div>
      )}

      {showVideo ? (
        <ParkinsonsVideoPlayer fetchUrl={fetchUrl} />
      ) : (
        <button
          type="button"
          onClick={() => setShowVideo(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-[var(--radius-md)] border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <PlayCircle size={14} />
          Watch example
        </button>
      )}
    </div>
  )
}

export default function ParkinsonsReviewMistakes({ review, onBack }: ParkinsonsReviewMistakesProps) {
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <ChevronLeft size={16} />
        Back to results
      </button>

      <h2 className="text-lg font-semibold text-slate-900">Review mistakes</h2>

      {review.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          No incorrect answers to review — nicely done.
        </p>
      ) : (
        review.map((item) => <ReviewCard key={item.question_id} item={item} />)
      )}
    </div>
  )
}
