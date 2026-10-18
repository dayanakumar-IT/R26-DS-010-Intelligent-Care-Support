import { AlertTriangle, BadgeCheck, Check, Circle, FileText, Hourglass, Lock } from 'lucide-react'
import type { GlossProgressSummary, GlossSignStatus } from '../../types/gloss'
import BadgeIcon from '../gloss/BadgeIcon'
import { fmtDate } from '../../utils/journey'
import { LEVEL_COLORS, categoryColors, monthlyBadgeColors, practiceBadgeColors, type ColorFamily } from '../../utils/categoryColors'

/**
 * MyJourney.tsx
 * GLOSS component — the learner's path: levels along a coloured path (up
 * to the current level, which is highlighted), then the seven categories
 * as stages, each in its own colour family (stage marker, sign chips,
 * badge). Sign chips: Not started neutral, Practising light, Demonstrated
 * solid with a tick, Retained solid with a seal — always icon + word +
 * colour, never colour alone. Earned badges are filled with their date;
 * locked badges are a grey outline that says what is needed. No motion.
 * Data: GET /gloss/progress/summary only.
 */

const label = (sign: string) => sign.replace(/_/g, ' ')

const STATUS_WORD: Record<GlossSignStatus, string> = {
  not_started: 'Not started',
  practising: 'Practising',
  demonstrated: 'Demonstrated',
  retained: 'Retained',
}
const STATUS_ICON = { not_started: Circle, practising: Hourglass, demonstrated: Check, retained: BadgeCheck }

function chipStyle(status: GlossSignStatus | 'unreliable', f: ColorFamily): React.CSSProperties {
  switch (status) {
    case 'practising':
      return { background: f.soft, borderColor: f.border, color: f.solid }
    case 'demonstrated':
      return { background: f.solid, borderColor: f.solid, color: '#ffffff' }
    case 'retained':
      return { background: f.dark, borderColor: f.dark, color: '#ffffff', boxShadow: `0 0 0 2px #ffffff, 0 0 0 4px ${f.solid}` }
    case 'unreliable':
      return { background: '#f8fafc', borderColor: '#cbd5e1', borderStyle: 'dashed', color: '#475569' }
    default:
      return { background: '#ffffff', borderColor: '#cbd5e1', color: '#475569' }
  }
}

/** A practice / monthly badge: filled colour, gradient, soft glow and the
 *  date when earned; a grey dashed outline with a lock and what is needed
 *  when not yet. */
function BadgeCard({ kind, badgeKey, name, earnedAt, needed, family }: {
  kind: 'practice' | 'monthly'
  badgeKey: string
  name: string
  earnedAt: string | null
  needed: string
  family: ColorFamily
}) {
  const earned = !!earnedAt
  return (
    <div
      className="flex h-full flex-col items-center gap-1.5 rounded-[16px] border p-3 text-center"
      style={earned
        ? { borderColor: family.border, backgroundImage: `linear-gradient(160deg, #ffffff, ${family.soft} 60%, ${family.border})`, boxShadow: `0 6px 16px ${family.solid}22` }
        : { borderColor: '#cbd5e1', borderStyle: 'dashed', background: '#f8fafc' }}
    >
      <BadgeIcon kind={kind} badgeKey={badgeKey} earned={earned} size={52} label={name} family={family} />
      <span className="text-sm font-semibold" style={{ color: earned ? family.dark : '#475569' }}>{name}</span>
      {earned ? (
        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: family.solid }}>
          <Check size={12} aria-hidden="true" /> Earned {fmtDate(earnedAt)}
        </span>
      ) : (
        needed && (
          <span className="flex items-start gap-1 text-xs text-slate-600">
            <Lock size={12} aria-hidden="true" className="mt-0.5 shrink-0" /> {needed}
          </span>
        )
      )}
    </div>
  )
}

interface MyJourneyProps {
  summary: GlossProgressSummary
  onOpenSign: (signId: string) => void
  onOpenReport: () => void
}

export default function MyJourney({ summary, onOpenSign, onOpenReport }: MyJourneyProps) {
  const levels = summary.levels
  const currentIndex = levels.reduce((last, lvl, i) => (lvl.earned_at ? i : last), -1)
  const pathPct = levels.length > 1 ? (Math.max(currentIndex, 0) / (levels.length - 1)) * 100 : 0

  return (
    <div className="flex flex-col gap-8 text-base">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-[var(--brand-blue)]">My Journey</h2>
          <p className="text-base text-slate-700">
            {summary.counts.demonstrated} of {summary.counts.countable} signs Demonstrated ·{' '}
            {summary.counts.retained} Retained · {summary.counts.practised} practised
            {summary.counts.not_assessed ? (
              <span className="text-slate-500"> · {summary.counts.not_assessed} signs not assessed by camera</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenReport}
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]"
        >
          <FileText size={16} aria-hidden="true" />
          My progress report
        </button>
      </div>

      {/* Levels along a path, coloured up to the current level */}
      <section aria-label="Levels" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Levels</h3>
        <ol className="relative grid grid-cols-5 gap-2">
          <span aria-hidden="true" className="absolute left-[10%] right-[10%] top-[30px] h-1 rounded-full bg-slate-200">
            <span
              className="block h-full rounded-full"
              style={{ width: `${pathPct}%`, backgroundImage: `linear-gradient(90deg, ${LEVEL_COLORS.light}, ${LEVEL_COLORS.solid})` }}
            />
          </span>
          {levels.map((lvl, i) => {
            const current = i === currentIndex
            return (
              <li
                key={lvl.key}
                className="relative flex flex-col items-center gap-1 text-center"
                aria-current={current ? 'step' : undefined}
              >
                <span
                  className="rounded-full bg-white p-0.5"
                  style={current ? { boxShadow: `0 0 0 3px ${LEVEL_COLORS.solid}` } : undefined}
                >
                  <BadgeIcon kind="level" badgeKey={lvl.key} earned={!!lvl.earned_at} size={56} label={`Level: ${lvl.name}`} />
                </span>
                <span className={`text-base font-semibold ${lvl.earned_at ? 'text-[var(--brand-blue)]' : 'text-slate-500'}`}>
                  {lvl.name}
                </span>
                {current && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: LEVEL_COLORS.solid }}>
                    You are here
                  </span>
                )}
                <span className="text-sm text-slate-600">
                  {lvl.earned_at ? `Earned ${fmtDate(lvl.earned_at)}` : lvl.rule}
                </span>
              </li>
            )
          })}
        </ol>
        {summary.next_level && (
          <p className="text-base text-slate-700">
            Next: <b>{summary.next_level.name}</b> — {summary.next_level.missing}.
          </p>
        )}
      </section>

      {/* Categories as stages, one colour family each */}
      <section aria-label="Categories" className="flex flex-col">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Stages</h3>
        <ol className="flex flex-col">
          {summary.categories.map((cat, i) => {
            const f = categoryColors(cat.key)
            const left = cat.countable - cat.demonstrated
            const pct = cat.countable ? (100 * cat.demonstrated) / cat.countable : 0
            return (
              <li key={cat.key} className="relative flex gap-4 pb-8">
                {i < summary.categories.length - 1 && (
                  <span aria-hidden="true" className="absolute bottom-0 left-[27px] top-[60px] w-1 rounded-full" style={{ background: f.border }} />
                )}
                <BadgeIcon kind="category" badgeKey={cat.key} earned={false} marker label={cat.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-lg font-semibold" style={{ color: f.dark }}>{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-28 overflow-hidden rounded-full"
                          style={{ background: f.soft, outline: `1px solid ${f.border}` }}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={cat.countable}
                          aria-valuenow={cat.demonstrated}
                          aria-label={`${cat.name}: ${cat.demonstrated} of ${cat.countable} Demonstrated`}
                        >
                          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: f.solid }} />
                        </span>
                        <span className="text-sm text-slate-700">
                          {cat.demonstrated} of {cat.countable} Demonstrated
                        </span>
                      </div>
                    </div>
                    {/* The category badge: filled when earned, grey outline + what is needed when locked */}
                    <div
                      className="flex items-center gap-2 rounded-[14px] border px-3 py-2"
                      style={cat.badge_earned_at ? { borderColor: f.border, background: f.soft } : { borderColor: '#e2e8f0', background: '#f8fafc' }}
                    >
                      <BadgeIcon kind="category" badgeKey={cat.key} earned={!!cat.badge_earned_at} size={40} label={`${cat.name} badge`} />
                      <span className="flex flex-col text-sm leading-tight">
                        <span className="font-semibold" style={{ color: cat.badge_earned_at ? f.dark : '#475569' }}>
                          {cat.name} badge
                        </span>
                        {cat.badge_earned_at ? (
                          <span style={{ color: f.solid }}>Earned {fmtDate(cat.badge_earned_at)}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Lock size={12} aria-hidden="true" />
                            Demonstrate {left} more sign{left === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {cat.signs.map((s) => {
                      const status = s.countable ? s.status : 'unreliable'
                      const Icon = status === 'unreliable' ? AlertTriangle : STATUS_ICON[status]
                      const word = status === 'unreliable' ? 'Not assessed by camera' : STATUS_WORD[status]
                      return (
                        <li key={s.sign_id}>
                          <button
                            type="button"
                            onClick={() => onOpenSign(s.sign_id)}
                            title={s.note ?? (s.demonstrated_at ? `Demonstrated ${fmtDate(s.demonstrated_at)}` : word)}
                            style={chipStyle(status, f)}
                            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 capitalize hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)] motion-reduce:transition-none"
                          >
                            <Icon size={15} aria-hidden="true" />
                            <span className="text-base font-medium">{label(s.sign_id)}</span>
                            <span className="text-sm normal-case">· {word}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Practice and monthly badges (effort, all history) */}
      <section aria-label="Practice badges" className="flex flex-col gap-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Practice badges</h3>
          <p className="text-sm text-slate-600">For effort over all your practice, including earlier versions. Separate from skill.</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summary.practice_badges.map((b) => (
            <li key={b.key}>
              <BadgeCard
                kind="practice"
                badgeKey={b.key}
                name={b.name}
                earnedAt={b.earned_at}
                needed={b.description}
                family={practiceBadgeColors(b.key)}
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 rounded-[16px] border border-slate-200 p-4">
          <span className="text-base text-slate-700">
            This month: <b>{summary.monthly.active_days}</b> active day{summary.monthly.active_days === 1 ? '' : 's'}
            <span className="text-slate-600"> · badges at {summary.monthly.tiers.join(' / ')} days, nothing is ever lost</span>
          </span>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {summary.monthly.tiers.map((t, i) => {
              const earned = summary.monthly.badges.find((b) => b.month === summary.monthly.month && b.days === t)
              const left = Math.max(t - summary.monthly.active_days, 0)
              return (
                <li key={t}>
                  <BadgeCard
                    kind="monthly"
                    badgeKey={`${summary.monthly.month}:${t}`}
                    name={`${t} active days`}
                    earnedAt={earned?.earned_at ?? null}
                    needed={`${left} more active day${left === 1 ? '' : 's'} this month`}
                    family={monthlyBadgeColors(i)}
                  />
                </li>
              )
            })}
            {summary.monthly.badges.filter((b) => b.month !== summary.monthly.month).map((b) => (
              <li key={b.key}>
                <BadgeCard
                  kind="monthly"
                  badgeKey={b.key}
                  name={`${b.days} days · ${new Date(`${b.month}-01`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
                  earnedAt={b.earned_at}
                  needed=""
                  family={monthlyBadgeColors(summary.monthly.tiers.indexOf(b.days))}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
