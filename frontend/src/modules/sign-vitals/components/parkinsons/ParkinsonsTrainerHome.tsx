import { useEffect, useState } from 'react'
import { BarChart3, Compass, Flame, Play, ShieldCheck, Star } from 'lucide-react'
import type { PkProgress } from '../../types/parkinsons'
import { getParkinsonsProgress } from '../../services/parkinsonsApi'
import parkinsonsHero from '../../assets/images/parkinsons-hero.jpg'

interface ParkinsonsTrainerHomeProps {
  starting: boolean
  startError: string | null
  onStartQuiz: () => void
  onExplore: () => void
  onOpenProgress: () => void
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[var(--radius-md)] bg-white/80 px-3 py-2.5 text-center backdrop-blur">
      <span className="text-violet-600">{icon}</span>
      <span className="text-lg font-semibold text-slate-900">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  )
}

export default function ParkinsonsTrainerHome({
  starting,
  startError,
  onStartQuiz,
  onExplore,
  onOpenProgress,
}: ParkinsonsTrainerHomeProps) {
  const [progress, setProgress] = useState<PkProgress | null>(null)

  useEffect(() => {
    let active = true
    getParkinsonsProgress()
      .then((res) => {
        if (active) setProgress(res)
      })
      .catch(() => {
        /* summary strip is optional — silently skip if it fails */
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex flex-1 flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
              <ShieldCheck size={13} />
              Educational · not a diagnostic tool
            </span>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Parkinson&apos;s Symptom Trainer
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600">
              Learn to recognise movement patterns through short videos, quick questions, and
              practical caregiver tips. This is symptom-recognition training — it does not diagnose
              Parkinson&apos;s disease.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onStartQuiz}
                disabled={starting}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                <Play size={16} />
                {starting ? 'Starting…' : 'Start learning quiz'}
              </button>
              <button
                type="button"
                onClick={onExplore}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Compass size={16} />
                Explore symptoms
              </button>
            </div>
            {startError && <p className="text-sm text-rose-600">{startError}</p>}
          </div>

          <img
            src={parkinsonsHero}
            alt=""
            className="hidden aspect-[4/3] w-56 rounded-[var(--radius-md)] object-cover sm:block"
          />
        </div>
      </div>

      {/* Progress summary */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Your progress
          </span>
          <button
            type="button"
            onClick={onOpenProgress}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 transition hover:text-violet-700"
          >
            <BarChart3 size={13} />
            View details
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MiniStat
            icon={<Star size={15} />}
            label="XP"
            value={progress ? String(progress.total_xp) : '—'}
          />
          <MiniStat
            icon={<BarChart3 size={15} />}
            label="Quiz score"
            value={progress ? `${progress.overall_accuracy_pct}%` : '—'}
          />
          <MiniStat
            icon={<Flame size={15} />}
            label="Best streak"
            value={progress ? String(progress.best_streak) : '—'}
          />
          <MiniStat
            icon={<Compass size={15} />}
            label="Symptoms practised"
            value={
              progress
                ? String(progress.symptom_progress.filter((s) => s.attempts > 0).length)
                : '—'
            }
          />
        </div>
      </div>
    </div>
  )
}
