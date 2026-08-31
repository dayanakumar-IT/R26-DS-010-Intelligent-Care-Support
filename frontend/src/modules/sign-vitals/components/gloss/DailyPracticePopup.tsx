import { CalendarDays, Heart, Sparkles, Trophy, X } from 'lucide-react'
import type { GlossHistoryEntry } from '../../types/gloss'
import { getSignIcon } from './signIcons'

// Presentational only. Receives the day's entries (already filtered
// from the existing GET /gloss/history response) — no fetching, no
// scoring, no new categories. Badges reuse the existing quality_tier /
// is_correct_sign values verbatim.

const TIER_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  strong: { label: 'Excellent', bg: '#EAF3FF', fg: '#2E6AD8' },
  moderate: { label: 'Good', bg: '#EAF8EF', fg: '#2F9E57' },
  weak: { label: 'Fair', bg: '#FFF2E8', fg: '#E9792D' },
}
const TIER_RANK: Record<string, number> = { strong: 3, moderate: 2, weak: 1 }

function badgeFor(entry: GlossHistoryEntry): { label: string; bg: string; fg: string } {
  if (entry.quality_tier && TIER_BADGE[entry.quality_tier]) return TIER_BADGE[entry.quality_tier]
  return entry.is_correct_sign
    ? { label: 'Correct', bg: '#EAF8EF', fg: '#2F9E57' }
    : { label: 'Keep trying', bg: '#F1F4FA', fg: '#73809A' }
}

function rankOf(entry: GlossHistoryEntry): number {
  if (entry.quality_tier) return TIER_RANK[entry.quality_tier] ?? 0
  return entry.is_correct_sign ? 0.5 : 0
}

interface DailyPracticePopupProps {
  dateIso: string
  entries: GlossHistoryEntry[]
  onClose: () => void
}

export default function DailyPracticePopup({ dateIso, entries, onClose }: DailyPracticePopupProps) {
  const [y, m, d] = dateIso.split('-').map(Number)
  const dateLabel = new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // One row per sign — keep that day's best existing result for the badge.
  const bySign = new Map<string, GlossHistoryEntry>()
  for (const entry of entries) {
    const prev = bySign.get(entry.target_sign_id)
    if (!prev || rankOf(entry) > rankOf(prev)) bySign.set(entry.target_sign_id, entry)
  }
  const rows = [...bySign.values()]
  const totalAttempts = entries.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#242D5A]/30 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Practice on ${dateLabel}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-[22px] border-2 border-[#E4DEFB] bg-white shadow-[0_20px_44px_rgba(36,45,90,0.20)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative flex items-start gap-3.5 px-6 pb-4 pt-5"
          style={{ backgroundImage: 'linear-gradient(135deg,#F3EFFF,#E9F0FF)' }}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-[#6E5AE6] shadow-[0_4px_12px_rgba(109,93,251,0.18)]">
            <CalendarDays size={22} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6E5AE6]">
              <Sparkles size={13} aria-hidden="true" />
              Words practised on
            </span>
            <span className="text-[17px] font-bold leading-tight text-[#17223E]">{dateLabel}</span>
            {rows.length > 0 && (
              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-[#73809A]">
                <Trophy size={13} className="text-[#EE7A32]" aria-hidden="true" />
                {rows.length} sign{rows.length === 1 ? '' : 's'} · {totalAttempts} attempt
                {totalAttempts === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#73809A] transition hover:bg-white/70"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[440px] overflow-y-auto px-5 py-4">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#E4DEFB] bg-[#FBFAFF] px-4 py-12 text-center">
              <CalendarDays size={28} className="text-[#B7B2E8]" aria-hidden="true" />
              <p className="text-[15px] font-semibold text-[#17223E]">
                No practice recorded on this day.
              </p>
              <p className="text-[13px] text-[#73809A]">Pick a highlighted day to see your practice.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((entry) => {
                const Icon = getSignIcon(entry.target_sign_id)
                const badge = badgeFor(entry)
                return (
                  <li
                    key={entry.attempt_id}
                    className="flex items-center gap-3.5 rounded-2xl border border-[#EEF1F6] bg-white px-3.5 py-3 transition hover:border-[#DED9FB] hover:bg-[#FBFAFF]"
                  >
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F2EFFF] text-[#6E5AE6]"
                      aria-hidden="true"
                    >
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold capitalize text-[#17223E]">
                      {entry.target_display_name}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold"
                      style={{ background: badge.bg, color: badge.fg }}
                    >
                      {badge.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 border-t border-[#EEF1F6] bg-[#FBFAFF] px-5 py-3 text-[12px] font-medium text-[#73809A]">
            <Heart size={13} className="text-[#EE7A32]" aria-hidden="true" />
            Great job — keep practising daily.
          </div>
        )}
      </div>
    </div>
  )
}
