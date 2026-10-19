import { lazy, Suspense, useEffect, useState } from 'react'
import { Hand } from 'lucide-react'
import SigningAvatar2D from '../avatar/SigningAvatar2D'
import { default3D } from '../avatar/motionCatalog'
import { useMirrorView } from '../mirrorView'
import { getGlossSignReference } from '../../services/glossApi'
import type { GlossReferenceFrame } from '../../types/gloss'

// three.js is only downloaded when a 3D preview is actually shown.
const SigningAvatar3D = lazy(() => import('../avatar/SigningAvatar3D'))

/**
 * SignPreview.tsx
 * GLOSS component — small looping demonstration of a sign for the
 * "Recommended next" card: the 3D Signer when the sign is approved for 3D,
 * otherwise the 2D guide. Follows the shared Mirror view setting. Callers
 * key it by sign id.
 */
export default function SignPreview({ signId, signName }: { signId: string; signName: string }) {
  const [mirrorView] = useMirrorView()
  const [use3D, setUse3D] = useState(() => default3D(signId))
  const [frames, setFrames] = useState<GlossReferenceFrame[] | null>(null)

  useEffect(() => {
    if (use3D) return
    let live = true
    getGlossSignReference(signId)
      .then((ref) => live && setFrames(ref.frames))
      .catch(() => {
        /* the placeholder stays; the practice flow is unaffected */
      })
    return () => {
      live = false
    }
  }, [signId, use3D])

  const placeholder = (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm text-slate-400">
      Loading demonstration…
    </div>
  )

  return (
    <div className="relative h-full w-full">
      {use3D ? (
        <Suspense fallback={placeholder}>
          <SigningAvatar3D signId={signId} signName={signName} mirrorView={mirrorView} compact onUnavailable={() => setUse3D(false)} />
        </Suspense>
      ) : frames ? (
        <SigningAvatar2D frames={frames} signName={signName} autoplay loop mirrorView={mirrorView} compact />
      ) : (
        placeholder
      )}
      <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-blue)] shadow-sm backdrop-blur">
        <Hand size={13} aria-hidden="true" />
        {use3D ? '3D Signer' : '2D Sign Guide'}
      </span>
    </div>
  )
}
