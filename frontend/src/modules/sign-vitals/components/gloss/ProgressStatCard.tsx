import type { LucideIcon } from 'lucide-react'

interface ProgressStatCardProps {
  icon: LucideIcon
  label: string
  value: number
  /** Thick left-edge accent colour for this metric. */
  border: string
  tileBg: string
  tileFg: string
}

// Presentational only — receives the already-computed metric via props.
export default function ProgressStatCard({
  icon: Icon,
  label,
  value,
  border,
  tileBg,
  tileFg,
}: ProgressStatCardProps) {
  return (
    <div
      className="flex items-center gap-3.5 rounded-[16px] border border-[#E9EDF5] bg-white px-4 py-4 shadow-[0_3px_12px_rgba(20,39,80,0.06)] transition hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(20,39,80,0.09)]"
      style={{ borderLeft: `6px solid ${border}` }}
    >
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
        style={{ background: tileBg, color: tileFg }}
      >
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[1.9rem] font-bold leading-none text-[#17223E]">{value}</span>
        <span className="mt-1 text-[12px] font-medium uppercase tracking-wide text-[#73809A]">
          {label}
        </span>
      </span>
    </div>
  )
}
