// Small shared helpers for the Parkinson's Symptom Trainer UI.

/** "just now" / "3 days ago" / "12 Aug 2026" — friendly, no deps. */
export function relativeDate(iso: string | null): string {
  if (!iso) return 'Not practised yet'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diffMs = Date.now() - then
  const day = 24 * 60 * 60 * 1000
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 60 * 60_000) return `${Math.round(diffMs / 60_000)} min ago`
  if (diffMs < day) return `${Math.round(diffMs / (60 * 60_000))} h ago`
  if (diffMs < 7 * day) return `${Math.round(diffMs / day)} days ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fullDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Tailwind text colour for an accuracy percentage — calm, not alarm. */
export function accuracyTone(pct: number): string {
  if (pct >= 80) return 'text-emerald-600'
  if (pct >= 60) return 'text-amber-600'
  return 'text-rose-500'
}

export function accuracyBar(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-rose-400'
}
