const tones = {
  good:    { bg: 'rgba(22,163,74,0.10)',   fg: '#166534', ring: 'rgba(22,163,74,0.22)',   dot: '#16A34A' },
  warn:    { bg: 'rgba(249,115,22,0.10)',  fg: '#9A3412', ring: 'rgba(249,115,22,0.22)',  dot: '#F97316' },
  danger:  { bg: 'rgba(239,68,68,0.10)',   fg: '#991B1B', ring: 'rgba(239,68,68,0.22)',   dot: '#EF4444' },
  info:    { bg: 'rgba(124,58,237,0.10)',  fg: '#5B21B6', ring: 'rgba(124,58,237,0.22)',  dot: '#7C3AED' },
  neutral: { bg: 'rgba(15,23,42,0.06)',    fg: 'rgba(15,23,42,0.72)', ring: 'rgba(15,23,42,0.12)', dot: '#64748B' },
} as const

export function StatusBadge({
  label,
  tone = 'neutral',
  pulse = false,
}: {
  label: string
  tone?: keyof typeof tones
  pulse?: boolean
}) {
  const t = tones[tone]
  return (
    <span
      className={pulse ? 'vl-badgePulse' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.ring}`,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: t.dot,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  )
}
