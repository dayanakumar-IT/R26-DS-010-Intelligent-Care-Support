import { Award, Flame, Film, Compass, Sparkles, Trophy } from 'lucide-react'
import type { PkBadge } from '../../types/parkinsons'

const ICONS: Record<string, React.ReactNode> = {
  first_quiz: <Sparkles size={15} />,
  perfect_round: <Trophy size={15} />,
  streak_3: <Flame size={15} />,
  symptom_explorer: <Compass size={15} />,
  video_detective: <Film size={15} />,
}

interface ParkinsonsBadgesProps {
  badges: PkBadge[]
}

export default function ParkinsonsBadges({ badges }: ParkinsonsBadgesProps) {
  if (badges.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Milestones earned
      </span>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={badge.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700"
          >
            {ICONS[badge.id] ?? <Award size={15} />}
            {badge.label}
          </span>
        ))}
      </div>
    </div>
  )
}
