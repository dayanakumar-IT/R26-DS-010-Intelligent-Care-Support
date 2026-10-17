import { STRONG_NEEDED } from '../../utils/progressLabels'

interface StrongInARowMeterProps {
  streak: number
  needed?: number
  /** 'lg' for the Practice hero, 'sm' for cards. */
  size?: 'lg' | 'sm'
}

// "Strong in a row: n of 3" as segments — the demonstrated rule is
// yes/no after 3 consecutive strong camera attempts, so it is shown as a
// count, never as a percentage.
export default function StrongInARowMeter({ streak, needed = STRONG_NEEDED, size = 'sm' }: StrongInARowMeterProps) {
  const filled = Math.min(streak, needed)
  const segment = size === 'lg' ? 'h-3 w-10' : 'h-2 flex-1'
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`flex gap-1.5 ${size === 'lg' ? '' : 'w-full'}`}
        role="img"
        aria-label={`Strong in a row: ${filled} of ${needed}`}
      >
        {Array.from({ length: needed }, (_, i) => (
          <span
            key={i}
            className={`${segment} rounded-full ${i < filled ? 'bg-emerald-500' : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <span className={size === 'lg' ? 'text-base text-slate-600' : 'text-sm text-slate-500'}>
        Strong in a row: <strong className="text-slate-800">{filled} of {needed}</strong>
      </span>
    </div>
  )
}
