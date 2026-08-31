interface MasteryRingProps {
  /** 0–100. Clamped and rounded for display. */
  value: number
  size?: number
}

// Presentational only — a lightweight inline-SVG circular progress
// indicator. No charting dependency. The value is passed in; this
// component never computes mastery.
export default function MasteryRing({ value, size = 104 }: MasteryRingProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const stroke = Math.round(size * 0.09)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (pct / 100) * circumference

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Mastery ${pct}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#DCE8FB"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--brand-blue)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-bold text-slate-900"
          style={{ fontSize: Math.round(size * 0.24) }}
        >
          {pct}%
        </span>
      </div>
    </div>
  )
}
