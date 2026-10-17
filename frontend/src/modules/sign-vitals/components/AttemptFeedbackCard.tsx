import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import Button from '../../../shared/components/Button'
import type { GlossAttemptResult } from '../types/gloss'
import {
  PROGRESS_LABEL,
  STRONG_NEEDED,
  TIER_LABEL,
  TIER_SENTENCE,
  progressState,
  strongInARow,
} from '../utils/progressLabels'

function signLabel(signId: string): string {
  return signId.replace(/_/g, ' ')
}

// The result banner. Below the confidence cut-off ('not_recognised') no
// sign is ever named and the colour is neutral — the learner is asked to
// repeat, not told they signed something else.
function resultBanner(result: GlossAttemptResult, targetSignId: string) {
  switch (result.outcome) {
    case 'target_sign':
    case 'quiz_correct':
      return {
        tone: 'bg-emerald-50 text-emerald-700',
        icon: <CheckCircle2 size={18} />,
        text: `Recognized as "${signLabel(targetSignId)}" — correct!`,
      }
    case 'not_recognised':
      return {
        tone: 'bg-slate-100 text-slate-700',
        icon: <HelpCircle size={18} />,
        text: "I couldn't recognise that sign clearly. Please try it again.",
      }
    default:
      return {
        tone: 'bg-rose-50 text-rose-700',
        icon: <XCircle size={18} />,
        text: `Recognized as "${signLabel(result.recognized_sign_id ?? '')}", not "${signLabel(targetSignId)}".`,
      }
  }
}

interface AttemptFeedbackCardProps {
  result: GlossAttemptResult
  targetSignId: string
  onPracticeAgain: () => void
  onNextSign: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-md)] bg-slate-50 px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-base font-semibold text-slate-800">{value}</span>
    </div>
  )
}

export default function AttemptFeedbackCard({
  result,
  targetSignId,
  onPracticeAgain,
  onNextSign,
}: AttemptFeedbackCardProps) {
  const banner = resultBanner(result, targetSignId)
  const isCamera = result.outcome !== 'quiz_correct' && result.outcome !== 'quiz_wrong'
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm)]">
      <div
        className={`flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium ${banner.tone}`}
      >
        {banner.icon}
        {banner.text}
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        {result.quality_tier && (
          <Stat label="Movement" value={TIER_LABEL[result.quality_tier]} />
        )}
        {isCamera && (
          <Stat
            label="Strong in a row"
            value={strongInARow(result.mastery.consecutive_strong_streak)}
          />
        )}
        <Stat
          label="This sign"
          value={PROGRESS_LABEL[progressState(result.mastery.mastery_status, result.mastery.attempts)]}
        />
      </div>

      {result.quality_tier && (
        <p className="text-sm text-slate-600">{TIER_SENTENCE[result.quality_tier]}</p>
      )}

      <div className="rounded-[var(--radius-md)] bg-blue-50 px-4 py-3 text-base text-blue-900">
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

      <p className="text-sm text-slate-500">
        {result.outcome === 'not_recognised'
          ? 'This attempt was not counted towards your progress.'
          : `${result.mastery.attempts} counted attempt${result.mastery.attempts === 1 ? '' : 's'} on this sign. ` +
            `${STRONG_NEEDED} strong camera attempts in a row = demonstrated.`}
      </p>

      {result.diagnostics && (
        <details className="rounded-[var(--radius-md)] border border-slate-200 text-xs text-slate-600">
          <summary className="cursor-pointer select-none px-4 py-2 font-medium text-slate-500">
            Technical details
          </summary>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 border-t border-slate-100 px-4 py-3 sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Expected sign</dt>
              <dd className="font-medium text-slate-700">{result.diagnostics.target_sign_id}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Predicted</dt>
              <dd className="font-medium text-slate-700">
                {result.diagnostics.predicted_sign_id ?? '—'}
                {result.diagnostics.confidence != null &&
                  ` (${Math.round(result.diagnostics.confidence * 100)}%)`}
              </dd>
            </div>
            {result.diagnostics.top3 && result.diagnostics.top3.length > 0 && (
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="text-slate-400">Top 3</dt>
                <dd className="text-right font-medium text-slate-700">
                  {result.diagnostics.top3
                    .map((t) => `${t.sign_id} ${Math.round(t.confidence * 100)}%`)
                    .join(' · ')}
                </dd>
              </div>
            )}
            {result.diagnostics.missing_landmark_fraction != null && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Landmarks missing</dt>
                <dd
                  className={`font-medium ${
                    result.diagnostics.missing_landmark_fraction > 0.6 ? 'text-rose-600' : 'text-slate-700'
                  }`}
                >
                  {Math.round(result.diagnostics.missing_landmark_fraction * 100)}%
                  {result.diagnostics.raw_frame_count != null &&
                    ` · ${result.diagnostics.raw_frame_count} frames`}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Model</dt>
              <dd className="font-medium text-slate-700">
                {result.diagnostics.model_name ?? '—'}
                {result.diagnostics.class_count != null && ` · ${result.diagnostics.class_count} classes`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Server-side mirroring</dt>
              <dd className="font-medium text-slate-700">
                {result.diagnostics.server_side_mirroring ? 'yes' : 'no'}
              </dd>
            </div>
            {result.diagnostics.preprocessing && (
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <dt className="text-slate-400">Preprocessing</dt>
                <dd className="text-slate-600">{result.diagnostics.preprocessing}</dd>
              </div>
            )}
            {result.diagnostics.note && (
              <div className="sm:col-span-2 text-slate-500">{result.diagnostics.note}</div>
            )}
          </dl>
          {result.diagnostics.missing_landmark_fraction != null &&
            result.diagnostics.missing_landmark_fraction > 0.6 && (
              <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-rose-600">
                Many hand/body points weren&apos;t detected in this clip. For a reliable result, keep
                your whole upper body and both hands in frame, with even lighting, and hold the sign
                clearly.
              </p>
            )}
        </details>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onPracticeAgain}>
          Practice Again
        </Button>
        <Button onClick={onNextSign}>Next Recommended Sign</Button>
      </div>
    </div>
  )
}
