import { useId } from 'react'

type ProgressRingProps = {
  value: number
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
  gradientFrom?: string
  gradientTo?: string
}

export function ProgressRing({
  value,
  size = 112,
  stroke = 10,
  label,
  sublabel,
  gradientFrom = '#6366f1',
  gradientTo = '#7c3aed',
}: ProgressRingProps) {
  const gid = useId()
  const gradId = `prg-${gid.replace(/:/g, '')}`
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const offset = c - (pct / 100) * c

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientFrom} />
              <stop offset="100%" stopColor={gradientTo} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e8e0ff"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold tabular-nums text-slate-900">{Math.round(pct)}%</span>
        </div>
      </div>
      {label ? <span className="text-xs font-medium text-slate-600">{label}</span> : null}
      {sublabel ? <span className="text-xs text-slate-400">{sublabel}</span> : null}
    </div>
  )
}
