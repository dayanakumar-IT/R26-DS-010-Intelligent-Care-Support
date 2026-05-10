import { ProgressRing } from './ProgressRing'
import { SurfaceCard } from './SurfaceCard'

export type FeedbackBreakdown = {
  handShapeOk: boolean
  movementOk: boolean
  speedOk: boolean
  finalPositionOk: boolean
  speedNote: string
  movementNote: string
  shapeNote: string
  positionNote: string
  score: number
  stars: number
  correctiveTips: string[]
  adaptiveSuggestion: string
}

type FeedbackPanelProps = {
  data: FeedbackBreakdown
}

function Row({
  label,
  ok,
  detail,
}: {
  label: string
  ok: boolean
  detail: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <div>
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">{detail}</div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
          ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'
        }`}
      >
        {ok ? 'Correct' : 'Adjust'}
      </span>
    </div>
  )
}

export function FeedbackPanel({ data }: FeedbackPanelProps) {
  const stars = Array.from({ length: 5 }, (_, i) => i < data.stars)

  return (
    <SurfaceCard
      accent="purple"
      title="Explainable AI feedback"
      titleAside={<span className="text-violet-600">CareSense tutor</span>}
    >
      <div className="grid gap-6 lg:grid-cols-[160px_1fr]">
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
          <ProgressRing value={data.score} label="Session score" gradientFrom="#22c55e" gradientTo="#14b8a6" />
          <div className="flex gap-1" aria-label={`${data.stars} out of 5 stars`}>
            {stars.map((on, i) => (
              <span key={i} className={on ? 'text-amber-400' : 'text-slate-200'}>
                ★
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Row
            label="Hand shape"
            ok={data.handShapeOk}
            detail={data.shapeNote}
          />
          <Row
            label="Movement"
            ok={data.movementOk}
            detail={data.movementNote}
          />
          <Row label="Speed" ok={data.speedOk} detail={data.speedNote} />
          <Row label="Final position" ok={data.finalPositionOk} detail={data.positionNote} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
          <div className="text-sm font-semibold text-amber-900">Corrective tips</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900/90">
            {data.correctiveTips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Adaptive difficulty</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{data.adaptiveSuggestion}</p>
        </div>
      </div>
    </SurfaceCard>
  )
}
