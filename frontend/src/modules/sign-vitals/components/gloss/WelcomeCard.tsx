import type { GlossProgressSummary } from '../../types/gloss'
import BadgeIcon from './BadgeIcon'
import { levelProgress } from '../../utils/journey'

/**
 * WelcomeCard.tsx
 * GLOSS component — shown on opening GLOSS: current level badge, a bar
 * toward the next level, and one "next goal" line. Every number
 * comes from GET /gloss/progress/summary (earned milestones only).
 * (No button: practice starts from Today's Practice right below.)
 */

export default function WelcomeCard({ summary }: { summary: GlossProgressSummary }) {
  const [done, needed] = levelProgress(summary)
  const level = summary.level
  return (
    <section
      aria-label="Your sign language level"
      className="flex flex-col gap-4 rounded-[22px] border border-[#c7d2fe] p-5 sm:flex-row sm:items-center sm:p-6"
      style={{ backgroundImage: 'linear-gradient(110deg, #ffffff, #eef2ff)' }}
    >
      <BadgeIcon kind="level" badgeKey={level?.key ?? 'starter'} earned={!!level} size={72}
        label={level ? `Level: ${level.name}` : 'No level yet'} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-[#4338ca]">
          {level ? `Level: ${level.name}` : 'Welcome to GLOSS'}
        </span>
        {summary.next_level ? (
          <>
            <div className="flex items-center gap-3">
              <div
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e0e7ff]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={needed}
                aria-valuenow={done}
                aria-label={`Progress to ${summary.next_level.name}`}
              >
                <div className="h-full rounded-full bg-[var(--brand-blue)]" style={{ width: `${(100 * done) / needed}%` }} />
              </div>
              <span className="shrink-0 text-xs font-medium text-slate-500">Next: {summary.next_level.name}</span>
            </div>
            <p className="text-base text-slate-700">Next goal: {summary.next_level.missing}.</p>
          </>
        ) : (
          <p className="text-base text-slate-700">Every countable sign Demonstrated and Retained.</p>
        )}
      </div>
    </section>
  )
}
