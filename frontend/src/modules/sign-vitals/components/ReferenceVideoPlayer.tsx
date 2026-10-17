import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'

/**
 * ReferenceVideoPlayer.tsx
 * GLOSS component — the validated reference video with the same controls
 * as the 2D guide and 3D Signer (play/pause, replay, speed; loops).
 *
 * The video is recorded facing the camera, so as-is it is the real view;
 * mirror view flips it with CSS. The browser's own controls are not used
 * because they would be flipped too (reversed text and timeline).
 */

const SPEED_OPTIONS = [0.5, 0.75, 1] as const
const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const btn =
  'flex items-center gap-1 rounded-[var(--radius-md)] border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]'

interface ReferenceVideoPlayerProps {
  src: string
  signName: string
  mirrorView: boolean
  onError: () => void
}

export default function ReferenceVideoPlayer({ src, signName, mirrorView, onError }: ReferenceVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState<number>(1)

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate
  }, [rate])

  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }
  const replay = () => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = 0
    void v.play()
  }

  return (
    <div className="flex flex-col gap-2">
      <video
        ref={videoRef}
        src={src}
        loop
        muted
        playsInline
        autoPlay={!reducedMotion}
        preload="metadata"
        aria-label={`${signName}: reference video`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={onError}
        className="aspect-video w-full rounded-[var(--radius-md)] bg-black"
        style={{ transform: mirrorView ? 'scaleX(-1)' : undefined }}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={toggle} className={btn}>
          {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={replay} className={btn}>
          <RotateCcw size={14} aria-hidden />
          Replay
        </button>
        <div role="group" aria-label="Playback speed" className="flex items-center gap-1 rounded-[var(--radius-md)] border border-slate-200 p-0.5">
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setRate(speed)}
              aria-pressed={rate === speed}
              aria-label={`${speed} times speed`}
              className={`rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium ${
                rate === speed ? 'bg-[var(--brand-blue)] text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
