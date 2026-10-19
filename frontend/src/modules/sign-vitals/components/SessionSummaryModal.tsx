import { Award, Sparkles, TrendingUp, X } from 'lucide-react'
import Button from '../../../shared/components/Button'
import type { GlossAttemptResult, GlossMasterySummaryRow } from '../types/gloss'
import { STRONG_NEEDED } from '../utils/progressLabels'

interface SessionSummaryModalProps {
  attempts: GlossAttemptResult[]
  // Mastery rows as they were at the start of the session (null if that
  // snapshot never loaded — every sign then counts as having no previous score).
  baseline: GlossMasterySummaryRow[] | null
  onClose: () => void
}

// When the v3 grading (tier-anchored execution score) went live. A stored
// best_score on a row last practised before this is on the old score scale
// and can't be compared with new scores, so it counts as "no previous score".
const NEW_GRADING_SINCE = Date.parse('2026-10-09T00:00:00Z')

function previousBestScore(row: GlossMasterySummaryRow | undefined): number | null {
  if (!row || row.best_score === null || !row.last_practiced_at) return null
  return Date.parse(row.last_practiced_at) >= NEW_GRADING_SINCE ? row.best_score : null
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

export default function SessionSummaryModal({
  attempts,
  baseline,
  onClose,
}: SessionSummaryModalProps) {
  const latestBySign = new Map<string, GlossAttemptResult>()
  const sessionBestBySign = new Map<string, number>()
  for (const attempt of attempts) {
    const signId = attempt.mastery.sign_id
    latestBySign.set(signId, attempt)
    if (attempt.execution_score !== null) {
      sessionBestBySign.set(
        signId,
        Math.max(sessionBestBySign.get(signId) ?? 0, attempt.execution_score),
      )
    }
  }
  const uniqueSigns = [...latestBySign.values()]
  const baselineBySign = new Map((baseline ?? []).map((row) => [row.sign_id, row]))

  const masteredSigns = uniqueSigns.filter((a) => a.mastery.mastery_status === 'mastered')
  // Improved = this session's best execution score beats the best score the
  // sign had when the session started (a first score counts), or the sign
  // became mastered this session.
  const improvedSigns = uniqueSigns.filter((a) => {
    const signId = a.mastery.sign_id
    const before = baselineBySign.get(signId)
    const becameMastered =
      a.mastery.mastery_status === 'mastered' && before?.mastery_status !== 'mastered'
    const sessionBest = sessionBestBySign.get(signId)
    const previousBest = previousBestScore(before)
    const beatPreviousBest =
      sessionBest !== undefined && (previousBest === null || sessionBest > previousBest)
    return becameMastered || beatPreviousBest
  })
  // Keep practising = every sign tried this session that isn't demonstrated
  // yet and whose latest attempt wasn't strong. (The old filter keyed on
  // the "improving" status only, so a sign tried once — status "learning"
  // — never appeared and the list was usually empty.)
  const needsPracticeSigns = uniqueSigns.filter(
    (a) => a.mastery.mastery_status !== 'mastered' && a.quality_tier !== 'strong',
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
          <SummaryStat label="Signs demonstrated" value={masteredSigns.length} />
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
          {masteredSigns.length > 0
            ? `You demonstrated ${masteredSigns.length} sign${masteredSigns.length === 1 ? '' : 's'} this session.`
            : `A sign is demonstrated after ${STRONG_NEEDED} strong camera attempts in a row.`}
        </div>

        <Button onClick={onClose} className="self-end">
          Done
        </Button>
      </div>
    </div>
  )
}
