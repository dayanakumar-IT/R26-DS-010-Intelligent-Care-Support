import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import SigningAvatar2D from './avatar/SigningAvatar2D'
import { getGlossSignDemoVideo, getGlossSignReference } from '../services/glossApi'
import type { GlossDemoVideo, GlossSignReference } from '../types/gloss'

// Which reference demonstration is on screen. '2d' (the 2D sign guide)
// is the primary mode and always available — it's driven by the same
// gloss_sign_references data the caregiver's attempt is scored against,
// and it supports play/pause/replay/speed/mirror. 'video' is an
// optional teaching-only mode showing a validated human reference video
// from Cloudflare R2. Both modes represent the SAME target sign; the
// video never affects scoring and never replaces the guide. Most signs
// have no validated video yet — that mode then shows a clear "not
// available" message and the 2D guide stays available.
type ReferenceMode = '2d' | 'video'

interface SignDemoPanelProps {
  signId: string
  signDisplayName?: string
}

type Status = 'loading' | 'ready' | 'error'

interface FetchState {
  key: string
  status: Status
  reference: GlossSignReference | null
}

type VideoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; video: GlossDemoVideo }
  | { status: 'unavailable' }
  | { status: 'error' }

// This panel owns fetching the reference sequence (with caching via
// glossApi) and loading/error states; SigningAvatar2D owns the actual
// guide rendering + playback controls. The validated video is fetched
// lazily the first time the caregiver switches to the Reference Video
// tab, so signs practised entirely with the guide cost no extra request.
export default function SignDemoPanel({ signId, signDisplayName }: SignDemoPanelProps) {
  const [retryToken, setRetryToken] = useState(0)
  const [mode, setMode] = useState<ReferenceMode>('2d')
  const key = `${signId}:${retryToken}`

  // "key" doubles as a request-id: state.key only matches the CURRENT
  // key once its fetch has resolved, so "loading" is derived by
  // comparing keys rather than an explicit setState('loading') at the
  // top of the effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [state, setState] = useState<FetchState>({ key, status: 'loading', reference: null })
  const [videoState, setVideoState] = useState<VideoState>({ status: 'idle' })
  // Bumped by "Try Again" to force a fresh demo-video fetch (presigned
  // URLs expire, so a retry must re-request).
  const [videoRetry, setVideoRetry] = useState(0)

  useEffect(() => {
    let isMounted = true

    getGlossSignReference(signId)
      .then((result) => {
        if (isMounted) setState({ key, status: 'ready', reference: result })
      })
      .catch(() => {
        if (isMounted) setState({ key, status: 'error', reference: null })
      })

    return () => {
      isMounted = false
    }
  }, [key, signId])

  // Fetch the reference video whenever the caregiver is in 'video' mode.
  // Deps are ONLY [mode, signId, videoRetry] — deliberately NOT
  // videoState.status. Depending on videoState.status while also calling
  // setVideoState('loading') here made the effect re-run immediately,
  // which fired the previous run's cleanup (isMounted=false) before the
  // in-flight request resolved — so the response was discarded and the
  // panel stayed on "Loading reference video…" forever. `signId` is
  // stable per mount (callers key this component by signId), so this
  // effect runs once when mode flips to 'video', and again only on retry.
  useEffect(() => {
    if (mode !== 'video') return

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoState({ status: 'loading' })

    getGlossSignDemoVideo(signId)
      .then((video) => {
        if (cancelled) return
        setVideoState(video ? { status: 'ready', video } : { status: 'unavailable' })
      })
      .catch(() => {
        if (!cancelled) setVideoState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [mode, signId, videoRetry])

  const status: Status = state.key === key ? state.status : 'loading'
  const reference = state.key === key ? state.reference : null

  if (status === 'loading') {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
        Loading reference demonstration…
      </div>
    )
  }

  if (status === 'error' || !reference) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-600">
        <span>Reference demonstration unavailable for this sign.</span>
        <button
          type="button"
          onClick={() => setRetryToken((n) => n + 1)}
          className="flex items-center gap-1 text-xs font-medium underline"
        >
          <RotateCcw size={12} />
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 self-start rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode('2d')}
          aria-pressed={mode === '2d'}
          className={`rounded-full px-3 py-1 transition-colors ${
            mode === '2d' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          2D Sign Guide
        </button>
        <button
          type="button"
          onClick={() => setMode('video')}
          aria-pressed={mode === 'video'}
          className={`rounded-full px-3 py-1 transition-colors ${
            mode === 'video' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Reference Video
        </button>
      </div>

      {mode === 'video' ? (
        videoState.status === 'ready' ? (
          <video
            key={videoState.video.video_url}
            src={videoState.video.video_url}
            controls
            playsInline
            preload="metadata"
            // The <video> only mounts once videoState is 'ready', so the
            // "Loading…" text is already gone before onLoadedMetadata /
            // onCanPlay would fire — no state change needed there. onError
            // is the only handler that moves the machine (-> 'error').
            onError={() => setVideoState({ status: 'error' })}
            className="aspect-video w-full rounded-[var(--radius-md)] bg-black"
          />
        ) : videoState.status === 'error' ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-600">
            <span>Reference video could not be loaded.</span>
            <button
              type="button"
              onClick={() => setVideoRetry((n) => n + 1)}
              className="flex items-center gap-1 text-xs font-medium underline"
            >
              <RotateCcw size={12} />
              Try Again
            </button>
          </div>
        ) : videoState.status === 'unavailable' ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-400">
            <span>Reference video is not available for this sign yet.</span>
            <span className="text-xs">The 2D Sign Guide remains the primary reference demonstration.</span>
          </div>
        ) : (
          // 'loading' and the brief 'idle' before the fetch effect runs
          <div className="flex aspect-video w-full items-center justify-center rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
            Loading reference video…
          </div>
        )
      ) : (
        <SigningAvatar2D
          key={reference.sign_id}
          frames={reference.frames}
          signName={signDisplayName ?? reference.display_name}
          autoplay
          loop
        />
      )}
    </div>
  )
}