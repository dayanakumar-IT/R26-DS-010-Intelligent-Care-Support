import { useState } from 'react'
import {
  ArrowDownAZ,
  ArrowRight,
  CheckCircle2,
  Circle,
  Search,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { GlossMasterySummaryRow, GlossSign } from '../types/gloss'
import { getSignIcon } from './gloss/signIcons'

// UI-only enhancement of the sign catalogue. Search + selection behave
// exactly as before; the state grouping / sort are pure client-side
// views over data already provided (the caller passes the same
// mastery_summary the Progress tab uses — no metric is computed here).

interface SignBrowserProps {
  signs: GlossSign[]
  onSelect: (signId: string) => void
  /** Optional: the caller's existing GET /gloss/progress mastery rows.
   * Absent/empty just means every sign shows as "Not practiced". */
  mastery?: GlossMasterySummaryRow[]
}

type LearnState = 'not_practiced' | 'needs_practice' | 'mastered'
type FilterId = 'all' | LearnState
type SortDir = 'az' | 'za'

const STATE_STYLE: Record<LearnState, { leftBorder: string; circleBg: string; icon: string }> = {
  not_practiced: { leftBorder: '#93B4FF', circleBg: '#EEF4FF', icon: '#2563EB' },
  needs_practice: { leftBorder: '#FFB867', circleBg: '#FFF4E5', icon: '#F59E0B' },
  mastered: { leftBorder: '#69D995', circleBg: '#EAF9EF', icon: '#16A34A' },
}

const STATE_STATUS_ICON: Record<LearnState, LucideIcon> = {
  not_practiced: Circle,
  needs_practice: TrendingUp,
  mastered: CheckCircle2,
}

function pct(score: number | null | undefined): number | null {
  return score == null ? null : Math.round(score * 100)
}

function FilterPill({
  active,
  onClick,
  icon: Icon,
  iconColor,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: LucideIcon
  iconColor?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? 'bg-[var(--brand-blue)] text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {Icon && (
        <Icon
          size={14}
          aria-hidden="true"
          style={active ? undefined : iconColor ? { color: iconColor } : undefined}
        />
      )}
      {children}
    </button>
  )
}

export default function SignBrowser({ signs, onSelect, mastery = [] }: SignBrowserProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [sortDir, setSortDir] = useState<SortDir>('az')

  // Plain derived values (cheap over ~59 signs). The React Compiler
  // memoises these; no useMemo needed.
  const masteryById = new Map<string, GlossMasterySummaryRow>(
    mastery.map((row) => [row.sign_id, row]),
  )

  const stateOf = (signId: string): LearnState => {
    const row = masteryById.get(signId)
    if (!row) return 'not_practiced'
    return row.mastery_status === 'mastered' ? 'mastered' : 'needs_practice'
  }

  const q = query.trim().toLowerCase()
  const visible = signs
    .filter((sign) => sign.display_name.toLowerCase().includes(q))
    .filter((sign) => filter === 'all' || stateOf(sign.id) === filter)
    .slice()
    .sort((a, b) =>
      sortDir === 'az'
        ? a.display_name.localeCompare(b.display_name)
        : b.display_name.localeCompare(a.display_name),
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-[var(--brand-blue)]">Browse Signs</h2>
          <p className="text-sm text-slate-500">
            Find and practice signs from your learning library.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-[13px] font-semibold text-[var(--brand-blue)]">
          {signs.length} signs
        </span>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search signs..."
          aria-label="Search signs"
          className="h-[52px] w-full rounded-xl border border-[#D5E2F6] bg-white pl-11 pr-4 text-sm shadow-[0_1px_2px_rgba(15,35,70,0.04)] outline-none transition focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterPill>
        <FilterPill
          active={filter === 'needs_practice'}
          onClick={() => setFilter('needs_practice')}
          icon={TrendingUp}
          iconColor="#F59E0B"
        >
          Needs Practice
        </FilterPill>
        <FilterPill
          active={filter === 'mastered'}
          onClick={() => setFilter('mastered')}
          icon={CheckCircle2}
          iconColor="#16A34A"
        >
          Mastered
        </FilterPill>
        <FilterPill
          active={filter === 'not_practiced'}
          onClick={() => setFilter('not_practiced')}
          icon={Circle}
          iconColor="#2563EB"
        >
          Not Practiced
        </FilterPill>

        <button
          type="button"
          onClick={() => setSortDir((dir) => (dir === 'az' ? 'za' : 'az'))}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50"
          aria-label={`Sort ${sortDir === 'az' ? 'Z to A' : 'A to Z'}`}
        >
          <ArrowDownAZ size={15} aria-hidden="true" />
          Sort: {sortDir === 'az' ? 'A–Z' : 'Z–A'}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
          {query.trim() ? 'No signs match your search.' : 'No signs in this group yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((sign) => {
            const state = stateOf(sign.id)
            const style = STATE_STYLE[state]
            const Icon = getSignIcon(sign.id)
            const StatusIcon = STATE_STATUS_ICON[state]
            const row = masteryById.get(sign.id)
            const masteryPct = row ? pct(row.last_score ?? row.best_score) : null

            const statusText =
              state === 'mastered'
                ? masteryPct == null
                  ? 'Mastered'
                  : `Mastery ${masteryPct}%`
                : state === 'needs_practice'
                  ? 'Needs practice'
                  : 'Not practiced'
            const actionText = state === 'mastered' ? 'Review' : 'Practice'

            return (
              <button
                key={sign.id}
                type="button"
                onClick={() => onSelect(sign.id)}
                aria-label={`Open ${sign.display_name}`}
                className="group flex items-center gap-3 rounded-[14px] border border-slate-200 bg-white py-3.5 pl-4 pr-3 text-left shadow-[0_1px_2px_rgba(15,35,70,0.05)] transition duration-150 hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_6px_16px_rgba(15,35,70,0.08)]"
                style={{ borderLeft: `3px solid ${style.leftBorder}` }}
              >
                <span
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
                  style={{ background: style.circleBg, color: style.icon }}
                  aria-hidden="true"
                >
                  <Icon size={24} />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold capitalize text-slate-900">
                    {sign.display_name}
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px] text-slate-500">
                    <StatusIcon size={13} aria-hidden="true" style={{ color: style.icon }} />
                    {statusText}
                  </span>
                  <span className="text-[13px] font-medium text-[var(--brand-blue)]">
                    {actionText} &rarr;
                  </span>
                </span>

                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-[var(--brand-blue)] transition group-hover:border-blue-300 group-hover:bg-blue-50"
                  aria-hidden="true"
                >
                  <ArrowRight size={16} />
                </span>
              </button>
            )
          })}
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {visible.length} sign{visible.length === 1 ? '' : 's'} shown
      </span>
    </div>
  )
}
