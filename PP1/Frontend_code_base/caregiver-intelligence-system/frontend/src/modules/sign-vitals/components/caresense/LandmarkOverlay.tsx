/** Simulated 21-point hand model layout (MediaPipe Hands compatible indices, visual-only). */

type LandmarkOverlayProps = {
  /** When true, overlays green nodes; when false, red (mismatch simulation). */
  correct: boolean
  /** Optional class for the SVG layer */
  className?: string
}

const POINTS: [number, number][] = [
  [52, 154],
  [48, 138],
  [44, 120],
  [42, 96],
  [40, 74],
  [58, 92],
  [62, 72],
  [64, 52],
  [84, 88],
  [90, 68],
  [96, 50],
  [108, 92],
  [114, 74],
  [118, 58],
  [128, 98],
  [132, 82],
  [132, 64],
  [138, 118],
  [136, 100],
  [134, 86],
  [120, 130],
]

export function LandmarkOverlay({ correct, className }: LandmarkOverlayProps) {
  const stroke = correct ? '#22c55e' : '#ef4444'
  const fill = correct ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.3)'
  const glow = correct ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)'

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
      viewBox="0 0 180 200"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <filter id="lmGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {POINTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 4.5 : 3.2} fill={stroke} filter="url(#lmGlow)" opacity={0.95} />
      ))}
      <path
        d="M40 74 L42 96 L44 120 M58 92 L62 72 L64 52 M84 88 L90 68 L96 50 M108 92 L114 74 L118 58 M128 98 L132 82 L132 64 M138 118 L136 100 L134 86 M120 130 L52 154"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity={0.85}
      />
      <ellipse cx="92" cy="132" rx="48" ry="36" fill={fill} stroke={stroke} strokeWidth="1.25" opacity={0.25} />
      <circle cx="92" cy="108" r="62" fill="none" stroke={glow} strokeWidth="0.75" opacity={0.25} strokeDasharray="4 8">
        <animateTransform attributeName="transform" type="rotate" from="0 92 108" to="360 92 108" dur="18s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}
