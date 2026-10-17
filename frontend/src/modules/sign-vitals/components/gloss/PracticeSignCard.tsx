import { ChevronRight, Hand, RotateCcw } from 'lucide-react'
import type { GlossMasterySummaryRow } from '../../types/gloss'
import { LAST_RESULT_LABEL, PROGRESS_LABEL, progressState } from '../../utils/progressLabels'
import StrongInARowMeter from './StrongInARowMeter'

const ACCENTS = [
  { border: '#D7DEFF', preview: '#EEF3FF', icon: '#2563EB' },
  { border: '#CFE8F8', preview: '#ECF7FD', icon: '#0EA5E9' },
  { border: '#D7EBD9', preview: '#EDF7EE', icon: '#16A34A' },
]

interface PracticeSignCardProps {
  row: GlossMasterySummaryRow
  strongNeeded: number
  accentIndex: number
  /** Runs the caller's existing sign-selection behaviour. */
  onPracticeAgain: () => void
}

// Presentational only. Shows the sign's progress state, its last result
// and "strong in a row" — never a percentage. The "Practice again"
// action is entirely the caller's.
export default function PracticeSignCard({
  row,
  strongNeeded,
  accentIndex,
  onPracticeAgain,
}: PracticeSignCardProps) {
  const a = ACCENTS[accentIndex % ACCENTS.length]
  const quizOnly = row.camera_attempts === 0
  const state = PROGRESS_LABEL[progressState(row.mastery_status, row.attempts)]
  const lastResult = row.last_result ? LAST_RESULT_LABEL[row.last_result] : null

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-[0_4px_14px_rgba(15,35,70,0.06)]"
      style={{ borderColor: a.border }}
    >
      <div className="flex items-center gap-4">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-xl"
          style={{ background: a.preview, color: a.icon }}
          aria-hidden="true"
        >
          <Hand size={28} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-lg font-semibold capitalize text-slate-900">
            {row.display_name}
          </span>
          <span className="text-sm text-slate-600">
            {state} · {row.attempts} attempt{row.attempts === 1 ? '' : 's'}
          </span>
          {lastResult && <span className="text-sm text-slate-500">Last result: {lastResult}</span>}
        </span>
      </div>

      {quizOnly ? (
        <p className="text-sm text-slate-600">Quiz only so far — try it with the camera.</p>
      ) : (
        <StrongInARowMeter streak={row.consecutive_strong_streak} needed={strongNeeded} />
      )}

      <button
        type="button"
        onClick={onPracticeAgain}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[15px] font-medium text-[#2563EB] transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
      >
        <span className="inline-flex items-center gap-2">
          <RotateCcw size={16} aria-hidden="true" />
          Practice again
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
