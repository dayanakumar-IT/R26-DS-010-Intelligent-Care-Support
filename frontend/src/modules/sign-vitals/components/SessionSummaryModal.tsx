import { Award, Sparkles, TrendingUp, X } from 'lucide-react'
import Button from '../../../shared/components/Button'
import type { GlossAttemptResult } from '../types/gloss'

interface SessionSummaryModalProps {
  attempts: GlossAttemptResult[]
  onClose: () => void
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-md)] bg-slate-50 px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-xl font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function signLabel(signId: string): string {
  return signId.replace(/_/g, ' ')
}

export default function SessionSummaryModal({ attempts, onClose }: SessionSummaryModalProps) {
  const latestBySign = new Map<string, GlossAttemptResult>()
  for (const attempt of attempts) {
    latestBySign.set(attempt.mastery.sign_id, attempt)
  }
  const uniqueSigns = [...latestBySign.values()]

  const masteredSigns = uniqueSigns.filter((a) => a.mastery.mastery_status === 'mastered')
  const improvedSigns = uniqueSigns.filter((a) => a.mastery.mastery_status === 'improving')
  const needsPracticeSigns = uniqueSigns.filter((a) =>
    a.mastery.mastery_status === 'weak' || a.mastery.mastery_status === 'needs_revision',
  )

  const strongest = uniqueSigns
    .filter((a) => a.mastery.best_score !== null)
    .sort((a, b) => (b.mastery.best_score ?? 0) - (a.mastery.best_score ?? 0))[0]

  const feedbackHighlights = [
    ...new Set(
      attempts
        .filter((a) => !a.is_correct_sign || (a.quality_tier && a.quality_tier !== 'strong'))
        .map((a) => a.corrective_feedback.summary),
    ),
  ].slice(0, 3)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-[var(--radius-lg)] bg-white p-6 shadow-[var(--shadow-lg)]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-[var(--brand-purple)]" />
            <h2 className="text-lg font-semibold text-slate-900">Session Summary</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryStat label="Signs practised" value={uniqueSigns.length} />
          <SummaryStat label="Attempts made" value={attempts.length} />
          <SummaryStat label="Signs improved" value={improvedSigns.length} />
          <SummaryStat label="Signs mastered" value={masteredSigns.length} />
        </div>

        {strongest && (
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Award size={18} />
            Strongest sign this session:{' '}
            <strong className="capitalize">{signLabel(strongest.mastery.sign_id)}</strong>
          </div>
        )}

        {needsPracticeSigns.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Keep practising
            </span>
            <div className="flex flex-wrap gap-2">
              {needsPracticeSigns.map((a) => (
                <span
                  key={a.mastery.sign_id}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize text-slate-600"
                >
                  {signLabel(a.mastery.sign_id)}
                </span>
              ))}
            </div>
          </div>
        )}

        {feedbackHighlights.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Feedback highlights
            </span>
            <ul className="flex flex-col gap-1 text-sm text-slate-600">
              {feedbackHighlights.map((summary) => (
                <li key={summary} className="rounded-[var(--radius-md)] bg-slate-50 px-3 py-2">
                  {summary}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <TrendingUp size={18} />
          Nice progress today — come back soon to keep building your streaks.
        </div>

        <Button onClick={onClose} className="self-end">
          Done
        </Button>
      </div>
    </div>
  )
}
