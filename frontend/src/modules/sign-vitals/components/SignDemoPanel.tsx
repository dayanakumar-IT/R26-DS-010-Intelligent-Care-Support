import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import SigningAvatar3D from './avatar/SigningAvatar3D'
import { getGlossSignReference } from '../services/glossApi'
import type { GlossSignReference } from '../types/gloss'

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

// Reference demonstration is now a live 3D avatar driven by the same
// gloss_sign_references data DTW compares against — see components/avatar/.
// This panel owns fetching (with caching via glossApi) and loading/error
// states; SigningAvatar3D owns the actual rendering + playback controls.
export default function SignDemoPanel({ signId, signDisplayName }: SignDemoPanelProps) {
  const [retryToken, setRetryToken] = useState(0)
  const key = `${signId}:${retryToken}`

  // "key" doubles as a request-id: state.key only matches the CURRENT
  // key once its fetch has resolved, so "loading" is derived by
  // comparing keys rather than needing an explicit setState('loading')
  // at the top of the effect (React's recommended pattern — see
  // https://react.dev/learn/you-might-not-need-an-effect).
  const [state, setState] = useState<FetchState>({ key, status: 'loading', reference: null })

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
    <SigningAvatar3D
      frames={reference.frames}
      signName={signDisplayName ?? reference.display_name}
      autoplay
      loop
    />
  )
}
