import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { FlipHorizontal2, RotateCcw } from 'lucide-react'
import SigningAvatar2D from './avatar/SigningAvatar2D'
import ReferenceVideoPlayer from './ReferenceVideoPlayer'
import { MIRROR_LABEL, REAL_LABEL, useMirrorView } from './mirrorView'
import { default3D, offer3D } from './avatar/motionCatalog'
import { getGlossSignDemoVideo, getGlossSignReference } from '../services/glossApi'
import type { GlossDemoVideo, GlossSignReference } from '../types/gloss'

// three.js is only downloaded when the 3D Signer is first shown.
const SigningAvatar3D = lazy(() => import('./avatar/SigningAvatar3D'))

// Which reference demonstration is on screen. '2d' (the 2D sign guide)
// is the primary mode and always available — it's driven by the same
// gloss_sign_references data the caregiver's attempt is scored against,
// and it supports play/pause/replay/speed/mirror. 'video' is an
// optional teaching-only mode showing a validated human reference video
// from Cloudflare R2. '3d' is the 3D Signer: a mannequin playing the
// baked motion of the same reference video; it is the default only for
// signs approved on the motion review page (motionCatalog.default3D)
// and falls back to the 2D guide if it cannot run. All modes represent
// the SAME target sign and none affects scoring.
type ReferenceMode = '2d' | 'video' | '3d'

// Catches a failed download of the 3D chunk so the panel can fall back.
class LoadBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

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
  const [mode, setMode] = useState<ReferenceMode>(() => (default3D(signId) ? '3d' : '2d'))
  const [threeDFailed, setThreeDFailed] = useState(false)
  // One view side for all three demonstrations (display only).
  const [mirrorView, setMirrorView] = useMirrorView()
  const show3DTab = offer3D(signId) && !threeDFailed
  const fallBackTo2D = () => {
    setThreeDFailed(true)
    setMode('2d')
  }
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

  // The 3D Signer doesn't need the 2D reference data, so it can show
  // while that loads (or if it fails).
  if (status === 'loading' && mode !== '3d') {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
        Loading reference demonstration…
      </div>
    )
  }

  if ((status === 'error' || !reference) && mode !== '3d') {
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
        {show3DTab && (
          <button
            type="button"
            onClick={() => setMode('3d')}
            aria-pressed={mode === '3d'}
            className={`rounded-full px-3 py-1 transition-colors ${
              mode === '3d' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            3D Signer
          </button>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={mirrorView}
        onClick={() => setMirrorView(!mirrorView)}
        className={`flex items-center gap-2 self-start rounded-[var(--radius-md)] border px-2.5 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)] ${
          mirrorView ? 'border-[var(--brand-blue)] bg-blue-50 text-[var(--brand-blue)]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <FlipHorizontal2 size={14} aria-hidden />
        {mirrorView ? MIRROR_LABEL : REAL_LABEL}
      </button>
      {threeDFailed && mode === '2d' && (
        <p className="text-xs text-slate-500">The 3D Signer isn't available on this device, so the 2D Sign Guide is shown.</p>
      )}

      {mode === '3d' ? (
        <LoadBoundary onError={fallBackTo2D}>
          <Suspense
            fallback={
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[var(--radius-md)] bg-slate-50 text-sm text-slate-400">
                Loading 3D signer…
              </div>
            }
          >
            <SigningAvatar3D
              key={signId}
              signId={signId}
              signName={signDisplayName ?? reference?.display_name ?? signId}
              onUnavailable={fallBackTo2D}
              mirrorView={mirrorView}
            />
          </Suspense>
        </LoadBoundary>
      ) : mode === 'video' ? (
        videoState.status === 'ready' ? (
          <ReferenceVideoPlayer
            key={videoState.video.video_url}
            src={videoState.video.video_url}
            signName={signDisplayName ?? reference?.display_name ?? signId}
            mirrorView={mirrorView}
            onError={() => setVideoState({ status: 'error' })}
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
        reference && (
          <SigningAvatar2D
            key={reference.sign_id}
            frames={reference.frames}
            signName={signDisplayName ?? reference.display_name}
            autoplay
            loop
            mirrorView={mirrorView}
          />
        )
      )}
    </div>
  )
}