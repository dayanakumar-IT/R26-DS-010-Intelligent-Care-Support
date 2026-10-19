import type { LucideIcon } from 'lucide-react'

type Accent = 'blue' | 'green' | 'purple'

const ACCENT: Record<Accent, { border: string; circle: string; icon: string }> = {
  blue: { border: '#C9DBFF', circle: '#EFF6FF', icon: '#2563EB' },
  green: { border: '#CDEFD7', circle: '#ECF9EF', icon: '#16A34A' },
  purple: { border: '#DDD3FF', circle: '#F2EFFF', icon: '#6D5DD3' },
}

interface GlossStatCardProps {
  icon: LucideIcon
  label: string
  value: string
  caption: string
  accent: Accent
}

// Presentational only — receives already-computed strings via props.
export default function GlossStatCard({ icon: Icon, label, value, caption, accent }: GlossStatCardProps) {
  const a = ACCENT[accent]
  return (
    <div
      className="flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-[0_4px_14px_rgba(15,35,70,0.06)]"
      style={{ borderColor: a.border }}
    >
      <span
        className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
        style={{ background: a.circle, color: a.icon }}
      >
        <Icon size={26} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className="text-[1.75rem] font-bold leading-tight text-slate-900">{value}</span>
        <span className="text-[13px] text-slate-400">{caption}</span>
      </span>
    </div>
  )
}
