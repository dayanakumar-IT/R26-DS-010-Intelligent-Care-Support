import { useCallback, useEffect, useState } from 'react'
import { Film, RotateCcw } from 'lucide-react'
import type { PkDemoVideo } from '../../types/parkinsons'

type VideoState = 'loading' | 'ready' | 'unavailable' | 'error'

interface ParkinsonsVideoPlayerProps {
  /** Fetches a fresh (presigned) video URL. Called on mount and on
   * every retry, so an expired URL is always replaced, never reused.
   * Remount the component (change its `key`) to load a different clip. */
  fetchUrl: () => Promise<PkDemoVideo>
  className?: string
}

const UNAVAILABLE_RE = /40[34]|not found|no (usable )?(demo )?video/i

export default function ParkinsonsVideoPlayer({ fetchUrl, className = '' }: ParkinsonsVideoPlayerProps) {
  const [state, setState] = useState<VideoState>('loading')
  const [url, setUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setUrl(null)
    setState('loading')
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchUrl()
        if (cancelled) return
        if (!data.video_url) {
          setState('unavailable')
          return
        }
        setUrl(data.video_url)
        setState('ready')
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        setState(UNAVAILABLE_RE.test(message) ? 'unavailable' : 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchUrl, attempt])

  return (
    <div
      className={`relative mx-auto w-full max-w-[500px] overflow-hidden rounded-[var(--radius-md)] border border-slate-200 bg-slate-900 shadow-[var(--shadow-sm)] ${className}`}
    >
      {/* Compact media area: at max-w 500px this 16:9 box is ~281px tall
          on desktop, and scales down (width 100%, height auto) on
          narrower screens. Loading / unavailable / error states share
          the exact same box so the card never jumps size. */}
      <div className="aspect-video max-h-[300px] w-full">
        {state === 'ready' && url && (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black object-contain"
            onError={() => setState('error')}
          >
            <track kind="captions" />
          </video>
        )}

        {state === 'loading' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-300">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
            <span className="text-sm">Loading the clip…</span>
          </div>
        )}

        {state === 'unavailable' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-300">
            <Film size={28} className="text-slate-500" />
            <span className="text-sm font-medium">Video coming soon</span>
            <span className="text-xs text-slate-400">
              This movement pattern doesn&apos;t have a clip yet.
            </span>
          </div>
        )}

        {state === 'error' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-200">
            <span className="text-sm font-medium">Video could not be loaded.</span>
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
            >
              <RotateCcw size={13} />
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
