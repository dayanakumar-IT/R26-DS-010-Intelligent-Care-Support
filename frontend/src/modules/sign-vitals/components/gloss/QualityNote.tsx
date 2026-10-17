import { Info } from 'lucide-react'

// Shown for dictionary-only signs (weak reference demonstration). Icon and
// text, not colour alone. A span, so it can sit inside the Browse card button.
export default function QualityNote({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <span
      className={`flex items-start gap-2 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 text-amber-900 ${
        compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'
      }`}
    >
      <Info size={compact ? 14 : 16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </span>
  )
}
