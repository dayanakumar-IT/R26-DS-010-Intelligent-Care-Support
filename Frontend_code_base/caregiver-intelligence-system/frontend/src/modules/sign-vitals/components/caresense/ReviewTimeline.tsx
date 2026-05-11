import { Button } from '../../../../shared/components/Button'
import { CaregiverAvatar } from '../../../../components/signVitals/CaregiverAvatar'
import { SurfaceCard } from './SurfaceCard'

export type TimelineMarker = {
  id: string
  label: string
  offsetPct: number
  status: 'good' | 'warn' | 'bad'
}

type ReviewTimelineProps = {
  attemptLabel: string
  referenceLabel: string
  markers: TimelineMarker[]
  feedback: string[]
  onTryAgain: () => void
  onNext: () => void
}

function VideoPanel({ title, variant }: { title: string; variant: 'attempt' | 'ref' }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <div className="relative overflow-hidden rounded-2xl border border-violet-100/80 bg-gradient-to-br from-violet-50/90 via-white to-emerald-50/50 shadow-inner">
        <div className="flex aspect-video items-center justify-center p-8">
          <div className="w-[160px]">
            <CaregiverAvatar pose="help" />
          </div>
        </div>
        <div className="border-t border-violet-100/60 bg-white/70 px-3 py-2 backdrop-blur-sm">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-400 transition-all duration-500"
              style={{ width: variant === 'attempt' ? '62%' : '100%' }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0:00</span>
            <span>{variant === 'attempt' ? '0:04.2' : '0:05.0'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReviewTimeline({
  attemptLabel,
  referenceLabel,
  markers,
  feedback,
  onTryAgain,
  onNext,
}: ReviewTimelineProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <VideoPanel title={attemptLabel} variant="attempt" />
        <VideoPanel title={referenceLabel} variant="ref" />
      </div>

      <SurfaceCard accent="neutral" title="Explainable timeline">
        <div className="relative h-14 rounded-2xl bg-slate-100">
          {markers.map((m) => (
            <button
              key={m.id}
              type="button"
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${m.offsetPct}%` }}
              title={m.label}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white shadow ${
                  m.status === 'good'
                    ? 'border-emerald-300 bg-emerald-500'
                    : m.status === 'warn'
                      ? 'border-amber-300 bg-amber-500'
                      : 'border-red-300 bg-red-500'
                }`}
              >
                {m.label.slice(0, 2)}
              </span>
            </button>
          ))}
          <div className="pointer-events-none absolute bottom-1 left-0 right-0 flex justify-between px-2 text-[10px] text-slate-400">
            <span>Hand shape</span>
            <span>Movement</span>
            <span>Position</span>
            <span>Hold time</span>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {markers.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                m.status === 'good'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
                  : m.status === 'warn'
                    ? 'border-amber-100 bg-amber-50 text-amber-900'
                    : 'border-red-100 bg-red-50 text-red-900'
              }`}
            >
              <strong className="block">{m.label}</strong>
              <span>{m.status === 'good' ? 'Aligned with reference tutor.' : 'Needs refinement vs. reference.'}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard title="Corrective feedback">
        <ul className="space-y-2 text-sm text-slate-700">
          {feedback.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-violet-500">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" className="transition hover:scale-[1.03]" onClick={onTryAgain}>
            Try Again
          </Button>
          <Button className="transition hover:scale-[1.03]" onClick={onNext}>
            Next Sign
          </Button>
        </div>
      </SurfaceCard>
    </div>
  )
}
