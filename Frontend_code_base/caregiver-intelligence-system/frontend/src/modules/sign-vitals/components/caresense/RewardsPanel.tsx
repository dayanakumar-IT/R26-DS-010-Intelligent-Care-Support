import { Button } from '../../../../shared/components/Button'
import { SurfaceCard } from './SurfaceCard'

const ACHIEVEMENTS = [
  { id: 'firstStep', title: 'First Step', desc: 'Complete your first guided lesson.' },
  { id: 'quickLearner', title: 'Quick Learner', desc: 'Answer 3 quiz prompts correctly in a row.' },
  { id: 'consistentLearner', title: 'Consistent Learner', desc: 'Maintain a 3-day learning streak.' },
  { id: 'helpingHands', title: 'Helping Hands', desc: 'Finish 10 sign practices with green overlays.' },
] as const

type RewardsPanelProps = {
  points: number
  unlocked: Record<string, boolean>
  onContinue: () => void
}

export function RewardsPanel({ points, unlocked, onContinue }: RewardsPanelProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-2 w-2 animate-bounce rounded-full opacity-70"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animationDuration: `${1.2 + (i % 5) * 0.2}s`,
              animationDelay: `${i * 0.05}s`,
              background:
                i % 3 === 0 ? '#c4b5fd' : i % 3 === 1 ? '#6ee7b7' : '#fcd34d',
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-2xl space-y-8 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-200 to-amber-400 text-4xl shadow-lg">
          🏆
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Wonderful work!</h1>
          <p className="mt-2 text-lg text-emerald-700">+{points} Care Points earned</p>
        </div>

        <SurfaceCard title="Achievements">
          <div className="grid gap-3 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => {
              const on = unlocked[a.id]
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    on
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-100 bg-slate-50 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                    <span className="text-lg">{on ? '✅' : '🔒'}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{a.desc}</p>
                </div>
              )
            })}
          </div>
        </SurfaceCard>

        <Button size="lg" onClick={onContinue}>
          Continue Learning
        </Button>
      </div>
    </div>
  )
}
