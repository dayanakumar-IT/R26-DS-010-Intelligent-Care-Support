import { useEffect, useRef, useState } from 'react'
import { LocateFixed, Pause, Play, RotateCcw } from 'lucide-react'
import * as THREE from 'three'
import skeletonJson from '../../assets/motion/standard_skeleton.json'
import { AvatarStage } from './avatarStage'
import { loadMotion, signPlayRange } from './motionCatalog'
import { frameAtTime, type MotionFile } from './motionPlayback'
import { samplePose, type BoneDef, type PoseSample } from './rig/AvatarRig'
import { MannequinRig } from './rig/MannequinRig'

/**
 * SigningAvatar3D.tsx
 * GLOSS component — the 3D Signer: a code-built mannequin playing a
 * sign's baked motion file (display only; grading never reads it).
 *
 * This file pulls in three.js, so callers load it with React.lazy and
 * pages without the 3D Signer never download three.js. If WebGL is
 * missing or anything fails to load, onUnavailable() fires and the
 * caller shows the 2D guide instead.
 *
 * Timing: frames are slerped using the motion file's own fps, so the
 * signer moves at the speed of the reference video (times the chosen
 * speed). Approved trims are applied (motionCatalog.signPlayRange).
 */

export interface SigningAvatar3DProps {
  signId: string
  signName: string
  autoplay?: boolean
  loop?: boolean
  onUnavailable?: (reason: string) => void
  /**
   * Shared Mirror view setting (mirrorView.ts). The character faces the
   * viewer, so the plain render is the real view; mirror view flips it.
   */
  mirrorView?: boolean
  /** Small preview (e.g. the Recommended next card): the view only, no controls or captions. */
  compact?: boolean
  /**
   * Review page: show this already-loaded motion at this frame (the video
   * is the clock). No player controls and no trim.
   */
  review?: { motion: MotionFile; frame: number }
}

const SPEED_OPTIONS = [0.5, 0.75, 1] as const
const SKELETON = skeletonJson.bones as BoneDef[]
const TURN_STEP = 0.08 // radians per arrow-key press

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const btn = 'flex items-center gap-1 rounded-[var(--radius-md)] border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]'

export default function SigningAvatar3D({
  signId,
  signName,
  autoplay = true,
  loop = true,
  onUnavailable,
  mirrorView = false,
  compact = false,
  review,
}: SigningAvatar3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<AvatarStage | null>(null)
  const poseRef = useRef<PoseSample>({ bones: {}, hips: new THREE.Vector3(), face: {} })
  const elapsedRef = useRef(0) // seconds of the clip already played (speed applied)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const unavailableRef = useRef(onUnavailable)
  useEffect(() => {
    unavailableRef.current = onUnavailable
  }, [onUnavailable])

  const [loaded, setLoaded] = useState<MotionFile | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [playing, setPlaying] = useState(() => autoplay && !prefersReducedMotion())
  const [rate, setRate] = useState<number>(1)
  const [replayToken, setReplayToken] = useState(0)

  const reviewMotion = review?.motion
  const reviewFrame = review?.frame
  const motion = reviewMotion ?? loaded

  const fail = (reason: string) => {
    setFailure(reason)
    unavailableRef.current?.(reason)
  }
  const failRef = useRef(fail)
  useEffect(() => {
    failRef.current = fail
  })

  // Renderer + mannequin, once per mount; GPU memory freed on unmount.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let stage: AvatarStage
    try {
      stage = new AvatarStage(host, new MannequinRig(SKELETON))
    } catch {
      failRef.current('WebGL is not available')
      return
    }
    stageRef.current = stage
    const lost = (e: Event) => {
      e.preventDefault()
      failRef.current('The 3D view stopped working')
    }
    stage.renderer.domElement.addEventListener('webglcontextlost', lost)
    return () => {
      stage.renderer.domElement.removeEventListener('webglcontextlost', lost)
      stage.dispose()
      stageRef.current = null
    }
  }, [])

  // Load this sign's motion file (its own lazy chunk).
  useEffect(() => {
    if (reviewMotion) return
    let live = true
    loadMotion(signId)
      .then((m) => live && setLoaded(m))
      .catch(() => live && failRef.current('The 3D demonstration could not be loaded'))
    return () => {
      live = false
    }
  }, [signId, reviewMotion])

  const show = (m: MotionFile, frame: number, last: number) => {
    const stage = stageRef.current
    if (!stage) return
    stage.rig.applyPose(samplePose(m, frame, last, poseRef.current))
    stage.render()
  }
  const showRef = useRef(show)
  useEffect(() => {
    showRef.current = show
  })

  // Review page: follow the external frame.
  useEffect(() => {
    if (reviewMotion && reviewFrame !== undefined) showRef.current(reviewMotion, reviewFrame, reviewMotion.frames - 1)
  }, [reviewMotion, reviewFrame])

  // Built-in player.
  useEffect(() => {
    if (!loaded || reviewMotion) return
    const range = signPlayRange(signId, loaded)
    const draw = () => {
      const { frame, finished } = frameAtTime(elapsedRef.current, loaded.fps, range, loop)
      showRef.current(loaded, frame, range[1])
      return finished
    }
    if (!playing) {
      draw()
      return
    }
    let raf = 0
    let last: number | null = null
    const tick = (ts: number) => {
      if (last !== null) elapsedRef.current += ((ts - last) / 1000) * rate
      last = ts
      if (draw()) {
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [loaded, reviewMotion, signId, playing, rate, loop, replayToken])

  const togglePlay = () => {
    if (!playing && loaded && !loop) {
      const range = signPlayRange(signId, loaded)
      if (frameAtTime(elapsedRef.current, loaded.fps, range, false).finished) elapsedRef.current = 0
    }
    setPlaying((p) => !p)
  }
  const replay = () => {
    elapsedRef.current = 0
    setReplayToken((n) => n + 1)
    setPlaying(true)
  }

  // Limited view turning: drag, or arrow keys when the view has focus.
  // The mirror is a CSS flip, so horizontal drags are flipped back.
  const turn = (dx: number, dy: number) => stageRef.current?.turn(mirrorView ? dx : -dx, dy)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    turn((e.clientX - d.x) * 0.008, (e.clientY - d.y) * 0.006)
    dragRef.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => {
    dragRef.current = null
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-TURN_STEP, 0],
      ArrowRight: [TURN_STEP, 0],
      ArrowUp: [0, -TURN_STEP],
      ArrowDown: [0, TURN_STEP],
    }
    const s = step[e.key]
    if (!s) return
    e.preventDefault()
    turn(s[0], s[1])
  }

  if (failure && onUnavailable) return null

  return (
    <div className={`flex flex-col gap-2 ${compact ? 'h-full' : ''}`}>
      <div
        className="relative w-full overflow-hidden rounded-[var(--radius-md)] bg-[#eef2f6]"
        style={compact ? { height: '100%' } : { aspectRatio: '4 / 3', maxHeight: 420 }}
      >
        <div
          ref={hostRef}
          tabIndex={0}
          role="img"
          aria-roledescription="3D view"
          aria-label={`${signName}: 3D signer. Drag or use the arrow keys to turn the view.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="h-full w-full cursor-grab focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-blue)] active:cursor-grabbing"
          style={{ width: '100%', height: '100%', transform: mirrorView ? 'scaleX(-1)' : undefined, touchAction: 'pan-y' }}
        />
        {!motion && !failure && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Loading 3D signer…
          </div>
        )}
        {failure && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-rose-600">
            {failure}. Please use the 2D Sign Guide.
          </div>
        )}
      </div>

      {!compact && (
        <p className="text-center text-xs text-slate-500">
          3D demonstration generated from a reference signer&apos;s video.
        </p>
      )}

      {!review && !compact && (
        <>
          <p className="text-center text-[11px] text-slate-400">
            {mirrorView
              ? "Mirrored: the signer's right hand is on your right, like a mirror."
              : "Facing you: the signer's right hand is on your left."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={togglePlay} className={btn} disabled={!motion}>
              {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={replay} className={btn} disabled={!motion}>
              <RotateCcw size={14} aria-hidden />
              Replay
            </button>
            <button type="button" onClick={() => stageRef.current?.resetView()} className={btn}>
              <LocateFixed size={14} aria-hidden />
              Reset view
            </button>
            <div role="group" aria-label="Playback speed" className="flex items-center gap-1 rounded-[var(--radius-md)] border border-slate-200 p-0.5">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setRate(speed)}
                  aria-pressed={rate === speed}
                  aria-label={`${speed} times speed`}
                  className={`rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)] ${
                    rate === speed ? 'bg-[var(--brand-blue)] text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {speed}×
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
