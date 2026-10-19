import { useEffect, useRef } from 'react'
import { Users, X } from 'lucide-react'
import { markTeamPopupSeen } from '../../utils/teamPopup'

/**
 * TeamPopup.tsx
 * Supervisors: once a day (per supervisor, per browser), a dismissible
 * summary with one neutral line per caregiver, e.g. "Harsha: 4 active days
 * this week, 1 new sign demonstrated". No rankings, no warnings.
 */

interface TeamPopupProps {
  userKey: string
  lines: string[]
  onClose: () => void
  onViewTeam: () => void
}

export default function TeamPopup({ userKey, lines, onClose, onViewTeam }: TeamPopupProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    markTeamPopupSeen(userKey)
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [userKey, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" role="dialog" aria-modal="true" aria-labelledby="team-popup-title">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-[20px] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="team-popup-title" className="flex items-center gap-2 text-xl font-bold text-[var(--brand-blue)]">
            <Users size={20} aria-hidden="true" /> Your team this week
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-[var(--radius-md)] p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]">
            <X size={20} />
          </button>
        </div>
        {lines.length === 0 ? (
          <p className="text-base text-slate-600">No caregivers have a Sign &amp; Vitals account yet.</p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {lines.map((line) => (
              <li key={line} className="rounded-[12px] bg-slate-50 px-3 py-2 text-base text-slate-800">{line}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-[var(--radius-md)] border border-slate-300 px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]">
            Close
          </button>
          <button type="button" onClick={onViewTeam} className="rounded-[var(--radius-md)] bg-[var(--brand-blue)] px-4 py-2 text-base font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]">
            View team progress
          </button>
        </div>
      </div>
    </div>
  )
}
