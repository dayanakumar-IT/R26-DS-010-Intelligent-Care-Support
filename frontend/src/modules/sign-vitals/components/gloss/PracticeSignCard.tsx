import { ChevronRight, Hand, RotateCcw } from 'lucide-react'

const ACCENTS = [
  { border: '#D7DEFF', bar: '#2563EB', preview: '#EEF3FF', icon: '#2563EB' },
  { border: '#CFE8F8', bar: '#0EA5E9', preview: '#ECF7FD', icon: '#0EA5E9' },
  { border: '#D7EBD9', bar: '#16A34A', preview: '#EDF7EE', icon: '#16A34A' },
]

interface PracticeSignCardProps {
  displayName: string
  /** 0–100, or null when the sign has no score yet. */
  masteryPct: number | null
  accentIndex: number
  /** Runs the caller's existing sign-selection behaviour. */
  onPracticeAgain: () => void
}

// Presentational only. The "Practice again" action is entirely the
// caller's — this component adds no selection/practice logic.
export default function PracticeSignCard({
  displayName,
  masteryPct,
  accentIndex,
  onPracticeAgain,
}: PracticeSignCardProps) {
  const a = ACCENTS[accentIndex % ACCENTS.length]
  const pct = masteryPct == null ? null : Math.max(0, Math.min(100, Math.round(masteryPct)))

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-[0_4px_14px_rgba(15,35,70,0.06)]"
      style={{ borderColor: a.border }}
    >
      <div className="flex items-center gap-4">
        <span
          className="grid h-20 w-20 shrink-0 place-items-center rounded-xl"
          style={{ background: a.preview, color: a.icon }}
          aria-hidden="true"
        >
          <Hand size={32} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-lg font-semibold capitalize text-slate-900">
            {displayName}
          </span>
          <span className="text-[13px] text-slate-400">
            Mastery {pct == null ? '—' : `${pct}%`}
          </span>
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: '#E7EAF0' }}
        role="progressbar"
        aria-valuenow={pct ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${displayName} mastery`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct ?? 0}%`, background: a.bar }}
        />
      </div>

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
