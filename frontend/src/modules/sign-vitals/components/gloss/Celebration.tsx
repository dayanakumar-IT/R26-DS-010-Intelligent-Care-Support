import { useEffect, useState } from 'react'
import type { GlossNewMilestone } from '../../types/gloss'
import BadgeIcon from './BadgeIcon'

/**
 * Celebration.tsx
 * GLOSS component — a short, quiet "newly earned" moment. Shown only when
 * the caller passes milestones the attempt NEWLY earned and only after a
 * successful attempt (the caller decides). The animation lasts under one
 * second (a fade and small lift); with prefers-reduced-motion it simply
 * appears. The card stays until dismissed or the learner moves on, so the
 * text can be read at any pace. Demonstrated / Retained are announced via
 * the sign itself; badges and levels get the artwork.
 */

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function Celebration({ milestones, onClose }: { milestones: GlossNewMilestone[]; onClose: () => void }) {
  const [shown, setShown] = useState(reducedMotion())
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(id)
  }, [])
  if (milestones.length === 0) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[#c7d2fe] bg-[#eef2ff] p-4"
      style={{
        transition: reducedMotion() ? undefined : 'opacity 700ms ease-out, transform 700ms ease-out',
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(6px)',
      }}
    >
      <div className="flex -space-x-3">
        {milestones.slice(0, 3).map((m) => (
          <BadgeIcon key={`${m.type}:${m.key}`} kind={m.type} badgeKey={m.key} earned size={48} label={m.name} />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-[var(--brand-blue)]">Newly earned</span>
        <span className="text-sm text-slate-700">{milestones.map((m) => m.name).join(' · ')}</span>
      </div>
      <button type="button" onClick={onClose} className="text-xs font-medium text-slate-500 underline">
        Close
      </button>
    </div>
  )
}
