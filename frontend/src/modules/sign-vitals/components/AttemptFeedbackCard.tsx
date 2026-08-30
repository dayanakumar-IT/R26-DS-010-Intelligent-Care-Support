import { CheckCircle2, XCircle } from 'lucide-react'
import Button from '../../../shared/components/Button'
import type { GlossAttemptResult } from '../types/gloss'

interface AttemptFeedbackCardProps {
  result: GlossAttemptResult
  targetSignId: string
  onPracticeAgain: () => void
  onNextSign: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-md)] bg-slate-50 px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm font-semibold capitalize text-slate-800">{value}</span>
    </div>
  )
}

export default function AttemptFeedbackCard({
  result,
  targetSignId,
  onPracticeAgain,
  onNextSign,
}: AttemptFeedbackCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm)]">
      <div
        className={`flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium ${
          result.is_correct_sign ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}
      >
        {result.is_correct_sign ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        {result.is_correct_sign
          ? `Recognized as "${result.recognized_sign_id}" — correct!`
          : `Recognized as "${result.recognized_sign_id ?? 'unclear'}", not "${targetSignId}".`}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {result.recognition_confidence !== null && (
          <Stat label="Confidence" value={`${Math.round(result.recognition_confidence * 100)}%`} />
        )}
        {result.quality_tier && <Stat label="Quality" value={result.quality_tier} />}
        {result.execution_score !== null && (
          <Stat label="Execution score" value={`${Math.round(result.execution_score * 100)}%`} />
        )}
        <Stat label="Streak" value={String(result.mastery.consecutive_strong_streak)} />
      </div>

      <div className="rounded-[var(--radius-md)] bg-blue-50 px-4 py-3 text-sm text-blue-900">
        {result.corrective_feedback.summary}
      </div>

      {result.corrective_feedback.top_deviating_groups.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Areas to focus on
          </span>
          <ul className="flex flex-wrap gap-2">
            {result.corrective_feedback.top_deviating_groups.map((group) => (
              <li key={group.group} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {group.friendly_name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-slate-200 px-4 py-2 text-xs text-slate-500">
        <span>
          Mastery status: <strong className="text-slate-700">{result.mastery.mastery_status}</strong>
        </span>
        <span>{result.mastery.attempts} attempts on this sign</span>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onPracticeAgain}>
          Practice Again
        </Button>
        <Button onClick={onNextSign}>Next Recommended Sign</Button>
      </div>
    </div>
  )
}
