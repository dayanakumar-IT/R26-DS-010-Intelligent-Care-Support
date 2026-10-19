import { AlertTriangle, BadgeCheck, Check, Circle, Hourglass } from 'lucide-react'
import type { GlossProgressSummary, GlossSignStatus } from '../types/gloss'

// Shared by the welcome card, My Journey and the progress report.

// Sign status: always icon + word + colour (never colour alone).
export const STATUS_STYLE: Record<GlossSignStatus | 'unreliable', { label: string; icon: typeof Check; cls: string }> = {
  not_started: { label: 'Not started', icon: Circle, cls: 'border-slate-200 bg-white text-slate-500' },
  practising: { label: 'Practising', icon: Hourglass, cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  demonstrated: { label: 'Demonstrated', icon: Check, cls: 'border-teal-300 bg-teal-50 text-teal-800' },
  retained: { label: 'Retained', icon: BadgeCheck, cls: 'border-indigo-300 bg-indigo-50 text-indigo-800' },
  unreliable: { label: 'Compare with the avatar', icon: AlertTriangle, cls: 'border-dashed border-slate-300 bg-slate-50 text-slate-500' },
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null

/** Progress toward the next level, as [done, needed], by that level's own rule. */
export function levelProgress(s: GlossProgressSummary): [number, number] {
  const next = s.next_level?.key
  const d = s.counts.demonstrated
  if (!next) return [1, 1]
  if (next === 'starter') return [0, 1]
  if (next === 'learner') return [Math.min(d, 5), 5]
  if (next === 'care_signer') return [Math.min(d, 30), 30]
  if (next === 'communicator') {
    const best = s.categories.reduce((a, c) => (c.demonstrated / c.countable > a.demonstrated / a.countable ? c : a))
    return [best.demonstrated, best.countable]
  }
  return [d + s.counts.retained, s.counts.countable * 2] // master
}
