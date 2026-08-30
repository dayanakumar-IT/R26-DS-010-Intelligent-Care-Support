import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import type { PkHistorySession } from '../../types/parkinsons'
import { getParkinsonsHistory } from '../../services/parkinsonsApi'
import { accuracyTone, fullDate } from './pkHelpers'

export default function ParkinsonsHistory() {
  const [sessions, setSessions] = useState<PkHistorySession[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getParkinsonsHistory()
      .then((res) => {
        if (active) setSessions(res.sessions)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load history.')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <p className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </p>
    )
  }

  if (!sessions) {
    return <div className="h-24 animate-pulse rounded-[var(--radius-lg)] border border-slate-200 bg-slate-50" />
  }

  if (sessions.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-5 shadow-[var(--shadow-sm)]">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Clock size={13} />
        Recent quizzes
      </span>
      <div className="flex flex-col divide-y divide-slate-100">
        {sessions.map((s) => (
          <div key={s.session_id} className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-slate-600">{fullDate(s.date)}</span>
            <div className="flex items-center gap-4 text-xs">
              <span className={`font-medium ${accuracyTone(s.accuracy_pct)}`}>
                {s.correct_answers}/{s.total_questions} · {s.accuracy_pct}%
              </span>
              <span className="text-violet-600">+{s.xp_earned} XP</span>
              <span className="text-amber-600">🔥 {s.best_streak}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
