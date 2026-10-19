import { Info } from 'lucide-react'

export const QUALITY_TAG = 'Limited demo quality · 2D guide available'

// Short tag for signs whose reference demonstration is weak (no 3D Signer:
// me, good, stand, welcome, arm). The backend's full sentence is kept as the
// tooltip and for screen readers. Icon and text, not colour alone. A span, so
// it can sit inside the Browse card button.
export default function QualityNote({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <span
      title={text}
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 font-medium text-amber-900 ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      <Info size={compact ? 12 : 14} className="shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{QUALITY_TAG}</span>
      <span className="sr-only">{text}</span>
    </span>
  )
}
