import { useEffect, useRef } from 'react'
import { LandmarkOverlay } from './LandmarkOverlay'
import { SurfaceCard } from './SurfaceCard'

export type CameraPracticePanelProps = {
  correct: boolean
  onRequestFrame?: () => void
  /** Wired for future MediaPipe Hands 0.10.14 injection */
  mediaPipeEnabled?: boolean
}

/**
 * Visual practice panel with simulated webcam feed and overlay.
 * Replace the inner canvas with MediaPipe `Hands` results when integrating.
 */
export function CameraPracticePanel({ correct, onRequestFrame, mediaPipeEnabled }: CameraPracticePanelProps) {
  const tickRef = useRef(0)
  useEffect(() => {
    if (!onRequestFrame) return
    const id = window.setInterval(() => {
      tickRef.current += 1
      onRequestFrame()
    }, 800)
    return () => window.clearInterval(id)
  }, [onRequestFrame])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 shadow-inner">
        <div className="relative aspect-[4/3] w-full">
          {/* Simulated camera */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_30%,rgba(129,140,248,0.35),transparent_55%)]" />
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_70%_60%,rgba(52,211,153,0.28),transparent_50%)]" />
            <div className="flex h-full items-center justify-center">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 backdrop-blur">
                {mediaPipeEnabled ? 'MediaPipe stream' : 'Camera preview (simulated)'}
              </div>
            </div>
          </div>
          <LandmarkOverlay correct={correct} />
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </div>
        </div>
      </div>
      <SurfaceCard
        accent="green"
        title="Landmark detection"
        titleAside={<span className="text-emerald-600">Floating overlay</span>}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <div>
            <div className="font-semibold text-slate-800">Hand topology</div>
            <div className="text-xs text-slate-500">
              Structured for MediaPipe Hands — replace overlay points with normalized landmarks.
            </div>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              correct ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {correct ? 'Match: strong' : 'Match: adjust'}
          </div>
        </div>
      </SurfaceCard>
    </div>
  )
}
