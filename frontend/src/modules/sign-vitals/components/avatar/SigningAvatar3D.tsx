import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { FlipHorizontal2, Pause, Play, RotateCcw } from 'lucide-react'
import type { GlossReferenceFrame } from '../../types/gloss'
import { computePlaybackPosition, interpolateFrame } from './avatarAnimation'
import { applyRigPose, computeRigPose, type RefMap } from './avatarRigMapper'
import ProceduralAvatar from './ProceduralAvatar'

/**
 * SigningAvatar3D.tsx
 * GLOSS component — rendering/scene layer. Owns the React Three Fiber
 * Canvas, the fixed teaching camera, playback state, and the per-frame
 * animation loop, plus the Play/Pause/Replay/speed/Mirror controls
 * (self-contained — SignDemoPanel only needs to fetch the reference
 * and render this component, wrapped in its own loading/error states).
 *
 * Delegates all geometry to ProceduralAvatar (the one layer meant to
 * be replaced by a licensed GLB later) and all landmark/rig math to
 * avatarAnimation.ts + avatarRigMapper.ts.
 */

export interface SigningAvatar3DProps {
  frames: GlossReferenceFrame[]
  signName: string
  autoplay?: boolean
  loop?: boolean
  playbackRate?: number
  mirrored?: boolean
}

const SPEED_OPTIONS = [0.5, 0.75, 1] as const

function AnimatedAvatar({
  frames,
  playing,
  loop,
  playbackRate,
  onFinished,
  resetToken,
}: {
  frames: GlossReferenceFrame[]
  playing: boolean
  loop: boolean
  playbackRate: number
  onFinished: () => void
  resetToken: number
}) {
  const refsBox = useRef<RefMap | null>(null)
  const elapsedRef = useRef(0)

  useEffect(() => {
    elapsedRef.current = 0
  }, [resetToken])

  useFrame((_state, delta) => {
    if (frames.length < 2 || !refsBox.current) return

    if (playing) {
      elapsedRef.current += delta
    }

    const position = computePlaybackPosition(elapsedRef.current, frames.length, playbackRate, loop)
    const frameA = frames[position.frameIndexA]!
    const frameB = frames[position.frameIndexB]!
    const interpolated = interpolateFrame(frameA, frameB, position.t)
    const pose = computeRigPose(interpolated)
    applyRigPose(refsBox.current, pose)

    if (position.finished && playing) {
      onFinished()
    }
  })

  return (
    <ProceduralAvatar
      onReady={(refs) => {
        refsBox.current = refs
      }}
    />
  )
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    )
  } catch {
    return false
  }
}

export default function SigningAvatar3D({
  frames,
  signName,
  autoplay = true,
  loop = true,
  playbackRate: initialPlaybackRate = 1,
  mirrored: initialMirrored = false,
}: SigningAvatar3DProps) {
  const [playing, setPlaying] = useState(autoplay)
  const [playbackRate, setPlaybackRate] = useState<number>(initialPlaybackRate)
  const [mirrored, setMirrored] = useState(initialMirrored)
  const [resetToken, setResetToken] = useState(0)
  const [webglOk] = useState(() => hasWebGL())

  if (!webglOk) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
        3D demonstration is not supported on this device/browser.
      </div>
    )
  }

  if (frames.length < 2) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
        Not enough reference frames to animate this sign.
      </div>
    )
  }

  const handleReplay = () => {
    setResetToken((n) => n + 1)
    setPlaying(true)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-md)] bg-slate-100"
        style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
      >
        {/* Camera framing (fixed here — root cause of "arms/hands not
            rendering" after the shoulder-offset fix): the avatar's
            vertical extent runs from the head top (~y=0.35) down through
            shoulders (~y=0), elbows (~y=-0.42, BONE_LENGTHS.upperArm),
            wrists (~y=-0.8), to fingertips (~y=-1.05 to -1.15,
            BONE_LENGTHS.upperArm+forearm+hand+2*fingerSegment below the
            shoulder). The previous camera (position.y=0.05, fov=32) only
            covered roughly [-0.41, 0.51] — everything from the elbows
            down was simply outside the frustum, regardless of correct
            positioning. This framing centers lower (y=-0.3) with a wider
            fov so the full reach (including raised-hand signs going
            above shoulder height) stays in frame with margin. */}
        <Canvas camera={{ position: [0, -0.3, 2.1], fov: 50 }} dpr={[1, 1.5]}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[1, 2, 2]} intensity={0.6} />
          <group position={[0, -0.1, 0]}>
            <AnimatedAvatar
              frames={frames}
              playing={playing}
              loop={loop}
              playbackRate={playbackRate}
              onFinished={() => setPlaying(false)}
              resetToken={resetToken}
            />
          </group>
        </Canvas>
        {mirrored && (
          <span
            className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium text-white"
            style={{ transform: 'scaleX(-1)' }}
          >
            Mirrored
          </span>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">Reference: {signName}</p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex items-center gap-1 rounded-[var(--radius-md)] border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={handleReplay}
          className="flex items-center gap-1 rounded-[var(--radius-md)] border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw size={14} />
          Replay
        </button>
        <button
          type="button"
          onClick={() => setMirrored((m) => !m)}
          className={`flex items-center gap-1 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-xs font-medium ${
            mirrored
              ? 'border-[var(--brand-blue)] bg-blue-50 text-[var(--brand-blue)]'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FlipHorizontal2 size={14} />
          Mirror
        </button>

        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-slate-200 p-0.5">
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setPlaybackRate(speed)}
              className={`rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium ${
                playbackRate === speed
                  ? 'bg-[var(--brand-blue)] text-white'
                  : 'text-slate-500 hover:bg-slate-50'
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
