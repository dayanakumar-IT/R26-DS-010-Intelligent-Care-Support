import { Button } from '../../../../shared/components/Button'
import { SurfaceCard } from './SurfaceCard'

const TABLE_ROWS = [
  { sign: 'HELP', accuracy: 88, sessions: 6, trend: '+4%' },
  { sign: 'THANK YOU', accuracy: 76, sessions: 4, trend: '+1%' },
  { sign: 'EAT', accuracy: 71, sessions: 3, trend: '-2%' },
  { sign: 'DRINK', accuracy: 82, sessions: 5, trend: '+6%' },
]

export function AssessmentDashboard({
  competencyScore,
  recommendedLesson,
  difficulty,
  onDownloadReport,
}: {
  competencyScore: number
  recommendedLesson: string
  difficulty: string
  onDownloadReport?: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <SurfaceCard accent="green" title="Caregiver competency">
          <div className="text-4xl font-bold text-emerald-700">{competencyScore}%</div>
          <p className="mt-2 text-sm text-slate-600">
            Blended from sign accuracy, consistency, and module completion (simulated).
          </p>
        </SurfaceCard>
        <SurfaceCard accent="purple" title="Performance timeline" className="lg:col-span-2">
          <svg viewBox="0 0 400 120" className="h-32 w-full" role="img" aria-label="Performance over last sessions">
            <defs>
              <linearGradient id="perfLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="400" height="120" fill="#f8fafc" rx="12" />
            <path
              d="M20 90 C80 40 120 100 160 70 S260 20 320 50 S380 30 390 45"
              fill="none"
              stroke="url(#perfLine)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {[20, 100, 180, 260, 340].map((x, i) => (
              <circle key={i} cx={x} cy={55 + i * 5} r="4" fill="#c4b5fd" />
            ))}
          </svg>
          <p className="mt-2 text-xs text-slate-500">Last 8 practice sessions (dummy series)</p>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Sign performance">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Sign</th>
                <th className="pb-2">Accuracy</th>
                <th className="pb-2">Sessions</th>
                <th className="pb-2">7d trend</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_ROWS.map((row) => (
                <tr key={row.sign} className="border-t border-slate-100">
                  <td className="py-3 font-semibold text-slate-800">{row.sign}</td>
                  <td className="py-3 text-emerald-700">{row.accuracy}%</td>
                  <td className="py-3 text-slate-600">{row.sessions}</td>
                  <td className="py-3 text-slate-600">{row.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SurfaceCard title="Recent assessment summary">
          <ul className="space-y-2 text-sm text-slate-700">
            <li>• Overall pacing improved vs. last review.</li>
            <li>• Final hold timing is the top gap for HELP.</li>
            <li>• Non-verbal vitals quiz score: stable (educational mode).</li>
          </ul>
          <div className="mt-4">
            <Button variant="secondary" className="transition hover:scale-[1.02]" onClick={onDownloadReport}>
              Download report
            </Button>
          </div>
        </SurfaceCard>
        <SurfaceCard accent="purple" title="Adaptive lesson planning">
          <p className="text-sm text-slate-700">
            <strong>Next recommended lesson:</strong> {recommendedLesson}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Difficulty adjusted to <strong>{difficulty}</strong> based on your latest competency score.
          </p>
          <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-xs text-violet-900">
            CareSense prioritizes movement control drills when speed cues oscillate — purely tutoring logic for this
            prototype.
          </div>
        </SurfaceCard>
      </div>
    </div>
  )
}
