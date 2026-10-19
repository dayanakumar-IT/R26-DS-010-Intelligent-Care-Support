import type { PdeduMastery } from '../types/pdedu'

interface MasteryProgressCardProps {
  mastery: PdeduMastery
  symptomDisplayName: string
}

export default function MasteryProgressCard({ mastery, symptomDisplayName }: MasteryProgressCardProps) {
  const score = Math.round(mastery.mastery_score)

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600">{symptomDisplayName} mastery</span>
        <span className="font-semibold text-slate-900">{score}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[var(--brand-purple)] transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>{mastery.correct_count} correct</span>
        <span>{mastery.incorrect_count} incorrect</span>
      </div>
    </div>
  )
}
