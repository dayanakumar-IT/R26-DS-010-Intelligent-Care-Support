import { FileText } from 'lucide-react'
import type { GlossProgressSummary } from '../../types/gloss'
import BadgeIcon from '../gloss/BadgeIcon'
import { STATUS_STYLE, fmtDate } from '../../utils/journey'

/**
 * MyJourney.tsx
 * GLOSS component — the learner's path: levels along the top, then the
 * seven categories as stages, each sign a node coloured by its status
 * (always icon + word + colour, never colour alone). Category badges show
 * locked or earned with the date. Clicking a sign opens its lesson.
 * Data: GET /gloss/progress/summary only.
 */

const label = (sign: string) => sign.replace(/_/g, ' ')

interface MyJourneyProps {
  summary: GlossProgressSummary
  onOpenSign: (signId: string) => void
  onOpenReport: () => void
}

export default function MyJourney({ summary, onOpenSign, onOpenReport }: MyJourneyProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-[var(--brand-blue)]">My Journey</h2>
          <p className="text-sm text-slate-600">
            {summary.counts.demonstrated} of {summary.counts.countable} signs Demonstrated ·{' '}
            {summary.counts.retained} Retained · {summary.counts.practised} practised
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenReport}
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FileText size={16} aria-hidden="true" />
          My progress report
        </button>
      </div>

      {/* Levels along the path */}
      <section aria-label="Levels" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Levels</h3>
        <ol className="relative grid grid-cols-5 gap-2">
          <span aria-hidden="true" className="absolute left-[10%] right-[10%] top-[28px] h-0.5 bg-slate-200" />
          {summary.levels.map((lvl) => (
            <li key={lvl.key} className="relative flex flex-col items-center gap-1 text-center">
              <BadgeIcon kind="level" badgeKey={lvl.key} earned={!!lvl.earned_at} label={`Level: ${lvl.name}`} />
              <span className={`text-sm font-semibold ${lvl.earned_at ? 'text-[var(--brand-blue)]' : 'text-slate-400'}`}>{lvl.name}</span>
              <span className="text-[11px] text-slate-500">{fmtDate(lvl.earned_at) ?? lvl.rule}</span>
            </li>
          ))}
        </ol>
        {summary.next_level && (
          <p className="text-sm text-slate-700">
            Next: <b>{summary.next_level.name}</b> — {summary.next_level.missing}.
          </p>
        )}
      </section>

      {/* Categories as stages along a path */}
      <section aria-label="Categories" className="flex flex-col">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Stages</h3>
        <ol className="flex flex-col">
          {summary.categories.map((cat, i) => (
            <li key={cat.key} className="relative flex gap-4 pb-6">
              {i < summary.categories.length - 1 && (
                <span aria-hidden="true" className="absolute left-[27px] top-[56px] bottom-0 w-0.5 bg-slate-200" />
              )}
              <BadgeIcon kind="category" badgeKey={cat.key} earned={!!cat.badge_earned_at} label={`${cat.name} badge`} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-lg font-semibold text-slate-900">{cat.name}</span>
                  <span className="text-sm text-slate-500">
                    {cat.demonstrated} of {cat.countable} Demonstrated
                  </span>
                  <span className={`text-xs font-medium ${cat.badge_earned_at ? 'text-teal-700' : 'text-slate-400'}`}>
                    {cat.badge_earned_at ? `Badge earned ${fmtDate(cat.badge_earned_at)}` : 'Badge locked'}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {cat.signs.map((s) => {
                    const st = STATUS_STYLE[s.countable ? s.status : 'unreliable']
                    const Icon = st.icon
                    return (
                      <li key={s.sign_id}>
                        <button
                          type="button"
                          onClick={() => onOpenSign(s.sign_id)}
                          title={s.note ?? (s.demonstrated_at ? `Demonstrated ${fmtDate(s.demonstrated_at)}` : st.label)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm capitalize hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)] ${st.cls}`}
                        >
                          <Icon size={14} aria-hidden="true" />
                          <span className="font-medium">{label(s.sign_id)}</span>
                          <span className="text-[11px] normal-case opacity-80">· {s.countable ? st.label : s.note}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Practice and monthly badges (effort, all history) */}
      <section aria-label="Practice badges" className="flex flex-col gap-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Practice badges</h3>
          <p className="text-xs text-slate-500">For effort over all your practice, including earlier versions. Separate from skill.</p>
        </div>
        <ul className="flex flex-wrap gap-4">
          {summary.practice_badges.map((b) => (
            <li key={b.key} className="flex w-28 flex-col items-center gap-1 text-center">
              <BadgeIcon kind="practice" badgeKey={b.key} earned={!!b.earned_at} label={b.name} />
              <span className={`text-xs font-semibold ${b.earned_at ? 'text-slate-700' : 'text-slate-400'}`}>{b.name}</span>
              <span className="text-[11px] text-slate-500">{fmtDate(b.earned_at) ?? 'not yet'}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-slate-200 p-3">
          <span className="text-sm text-slate-700">
            This month: <b>{summary.monthly.active_days}</b> active day{summary.monthly.active_days === 1 ? '' : 's'}
            <span className="text-slate-500"> · badges at {summary.monthly.tiers.join(' / ')} days, nothing is ever lost</span>
          </span>
          <ul className="flex flex-wrap gap-3">
            {summary.monthly.tiers.map((t) => {
              const earned = summary.monthly.badges.find((b) => b.month === summary.monthly.month && b.days === t)
              return (
                <li key={t} className="flex flex-col items-center gap-0.5 text-center">
                  <BadgeIcon kind="monthly" badgeKey={`${summary.monthly.month}:${t}`} earned={!!earned} size={44} label={`${t} active days this month`} />
                  <span className="text-[11px] text-slate-500">{t} days</span>
                </li>
              )
            })}
            {summary.monthly.badges.filter((b) => b.month !== summary.monthly.month).map((b) => (
              <li key={b.key} className="flex flex-col items-center gap-0.5 text-center">
                <BadgeIcon kind="monthly" badgeKey={b.key} earned size={44} label={b.name} />
                <span className="text-[11px] text-slate-500">{new Date(`${b.month}-01`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
