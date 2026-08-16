import type { CSSProperties, ReactNode } from 'react'

type Accent = 'purple' | 'pink' | 'blue' | 'green' | 'orange' | 'red' | 'teal' | 'neutral'

const palette: Record<Accent, { hex: string; bg: string; ring: string; grad: string }> = {
  purple:  { hex: '#7C3AED', bg: 'rgba(124,58,237,0.10)',  ring: 'rgba(124,58,237,0.20)',  grad: 'linear-gradient(135deg,#7C3AED,#1E3A8A)' },
  pink:    { hex: '#7C3AED', bg: 'rgba(124,58,237,0.10)',  ring: 'rgba(124,58,237,0.20)',  grad: 'linear-gradient(135deg,#7C3AED,#1E3A8A)' },
  blue:    { hex: '#1E3A8A', bg: 'rgba(30,58,138,0.10)',   ring: 'rgba(30,58,138,0.20)',   grad: 'linear-gradient(135deg,#1E3A8A,#14B8A6)' },
  green:   { hex: '#16A34A', bg: 'rgba(22,163,74,0.10)',   ring: 'rgba(22,163,74,0.20)',   grad: 'linear-gradient(135deg,#16A34A,#0D9488)' },
  orange:  { hex: '#F97316', bg: 'rgba(249,115,22,0.10)',  ring: 'rgba(249,115,22,0.20)',  grad: 'linear-gradient(135deg,#F97316,#EAB308)' },
  red:     { hex: '#EF4444', bg: 'rgba(239,68,68,0.10)',   ring: 'rgba(239,68,68,0.20)',   grad: 'linear-gradient(135deg,#EF4444,#F97316)' },
  teal:    { hex: '#14B8A6', bg: 'rgba(20,184,166,0.10)',  ring: 'rgba(20,184,166,0.20)',  grad: 'linear-gradient(135deg,#14B8A6,#1E3A8A)' },
  neutral: { hex: '#334155', bg: 'rgba(15,23,42,0.06)',    ring: 'rgba(15,23,42,0.12)',    grad: 'linear-gradient(135deg,#334155,#475569)' },
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  accent = 'purple',
}: {
  title: string
  value: string | number
  icon: ReactNode
  subtitle?: string
  accent?: Accent
}) {
  const t = palette[accent]

  return (
    <div
      className="vl-dashCard"
      style={
        {
          '--stat-hex': t.hex,
          '--stat-bg': t.bg,
          '--stat-ring': t.ring,
          '--stat-grad': t.grad,
        } as CSSProperties
      }
    >
      {/* Coloured indicator bar */}
      <div
        aria-hidden
        style={{
          height: 4,
          background: t.grad,
          flexShrink: 0,
          borderRadius: '18px 18px 0 0',
        }}
      />
      <div className="vl-dashCardBody" style={{ paddingTop: 16 }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--vl-muted)' }}
            >
              {title}
            </div>
            <div
              className="mt-2 font-extrabold leading-none tracking-tight"
              style={{ fontSize: 28, color: 'var(--vl-text)' }}
            >
              {value}
            </div>
            <div
              className="mt-2 text-[12px] font-medium"
              style={{
                minHeight: 18,
                color: 'var(--vl-muted)',
                visibility: subtitle ? 'visible' : 'hidden',
              }}
            >
              {subtitle ?? '—'}
            </div>
          </div>

          {/* Icon bubble */}
          <div
            className="grid shrink-0 place-items-center rounded-2xl border"
            style={{
              width: 46,
              height: 46,
              background: t.bg,
              borderColor: t.ring,
              color: t.hex,
              boxShadow: `0 8px 20px ${t.bg}`,
            }}
          >
            {icon}
          </div>
        </div>
      </div>
    </div>
  )
}
