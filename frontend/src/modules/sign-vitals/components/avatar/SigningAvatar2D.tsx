import { useEffect, useMemo, useRef, useState } from 'react'
import { FlipHorizontal2, Pause, Play, RotateCcw } from 'lucide-react'
import type { GlossLandmark, GlossReferenceFrame } from '../../types/gloss'
import { computePlaybackPosition, interpolateFrame } from './avatarAnimation'

/**
 * SigningAvatar2D.tsx
 * GLOSS component — 2D landmark-driven sign guide (replaces the
 * procedural 3D avatar). Pure SVG, no extra dependency.
 *
 * Reads the same GET /gloss/signs/{sign_id}/reference data (49
 * landmarks/frame) and uses x/y only. In the stored reference data
 * +y points UP, so we negate y once when projecting into SVG space
 * (SVG +y points down).
 *
 * Readability choices (see task notes):
 *  - Framing is computed ONCE over the whole sequence so the view
 *    never jumps; padding keeps moving hands from cropping.
 *  - A light torso slab + neck + spine give the body a readable
 *    centre instead of a hollow "head + sticks" look.
 *  - Hands are the priority: full MediaPipe topology, but with small
 *    nodes, white halos, clear z-order (body behind, hands in front),
 *    faint transparency on the further-back hand, and a small
 *    horizontal nudge only when the two hands heavily overlap.
 *  - Left/right hands are two distinct muted colours AND labelled in
 *    a legend below (never colour alone). No floating on-canvas
 *    labels — a hand that isn't used in a sign is simply not drawn.
 *
 * Mirror is display-only (an SVG transform); stored coordinates are
 * never changed and this component feeds nothing into recognition.
 */

export interface SigningAvatar2DProps {
  frames: GlossReferenceFrame[]
  signName: string
  autoplay?: boolean
  loop?: boolean
  playbackRate?: number
  mirrored?: boolean
}

const SPEED_OPTIONS = [0.5, 0.75, 1] as const
const VB_HEIGHT = 360

// Indices into the 49-landmark frame (landmark_names.json order).
const NOSE = 0
const L_SH = 1
const R_SH = 2
const BODY_BONES: ReadonlyArray<readonly [number, number]> = [
  [L_SH, R_SH],
  [L_SH, 3],
  [3, 5],
  [R_SH, 4],
  [4, 6],
]

// Within one 21-point MediaPipe hand: 0 = wrist.
const HAND_BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [0, 9], [9, 10], [10, 11], [11, 12], // middle
  [0, 13], [13, 14], [14, 15], [15, 16], // ring
  [0, 17], [17, 18], [18, 19], [19, 20], // pinky
]
const KNUCKLE_ARC: ReadonlyArray<readonly [number, number]> = [
  [5, 9], [9, 13], [13, 17],
]
const FINGERTIPS = new Set([4, 8, 12, 16, 20])

const COLORS = {
  panel: '#f1f5f9',
  body: '#64748b',
  bodyJoint: '#475569',
  torso: '#e2e8f0',
  left: { bone: '#2563eb', node: '#1d4ed8' },
  right: { bone: '#0d9488', node: '#0f766e' },
}

function isFinitePoint(lm: GlossLandmark | undefined): lm is GlossLandmark {
  return !!lm && Number.isFinite(lm.x) && Number.isFinite(lm.y)
}

// A hand that a sign doesn't use comes through as 21 points collapsed
// near the origin (undetected -> interpolated to ~0). Don't draw it.
function handIsPresent(hand: GlossLandmark[]): boolean {
  let spanX = 0
  let spanY = 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let anyAwayFromOrigin = false
  for (const lm of hand) {
    if (!isFinitePoint(lm)) continue
    if (Math.abs(lm.x) > 0.06 || Math.abs(lm.y) > 0.06) anyAwayFromOrigin = true
    minX = Math.min(minX, lm.x)
    maxX = Math.max(maxX, lm.x)
    minY = Math.min(minY, lm.y)
    maxY = Math.max(maxY, lm.y)
  }
  if (Number.isFinite(minX)) {
    spanX = maxX - minX
    spanY = maxY - minY
  }
  return anyAwayFromOrigin && Math.max(spanX, spanY) > 0.04
}

interface Projector {
  vbWidth: number
  x: (lm: GlossLandmark) => number
  y: (lm: GlossLandmark) => number
}

function buildProjector(frames: GlossReferenceFrame[]): Projector {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const frame of frames) {
    for (const lm of frame.landmarks) {
      if (!isFinitePoint(lm)) continue
      const px = lm.x
      const py = -lm.y
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || maxX <= minX || maxY <= minY) {
    minX = -1
    maxX = 1
    minY = -1
    maxY = 1
  }

  const pad = 0.12 * Math.max(maxX - minX, maxY - minY)
  minX -= pad
  maxX += pad
  minY -= pad
  maxY += pad

  const scale = VB_HEIGHT / (maxY - minY)
  return {
    vbWidth: (maxX - minX) * scale,
    x: (lm) => (lm.x - minX) * scale,
    y: (lm) => (-lm.y - minY) * scale,
  }
}

function boneLine(
  a: GlossLandmark | undefined,
  b: GlossLandmark | undefined,
  proj: Projector,
  key: string,
  props: React.SVGProps<SVGLineElement>,
) {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null
  return (
    <line
      key={key}
      x1={proj.x(a)}
      y1={proj.y(a)}
      x2={proj.x(b)}
      y2={proj.y(b)}
      strokeLinecap="round"
      {...props}
    />
  )
}

function Hand({
  hand,
  proj,
  colors,
  opacity,
  dx,
  label,
}: {
  hand: GlossLandmark[]
  proj: Projector
  colors: { bone: string; node: string }
  opacity: number
  dx: number
  label: string
}) {
  return (
    <g opacity={opacity} transform={dx ? `translate(${dx} 0)` : undefined}>
      {KNUCKLE_ARC.map(([i, j], k) =>
        boneLine(hand[i], hand[j], proj, `arc-${label}-${k}`, {
          stroke: colors.bone,
          strokeWidth: 2,
          strokeOpacity: 0.4,
        }),
      )}
      {/* white halo under the finger bones for separation from the other hand */}
      {HAND_BONES.map(([i, j], k) =>
        boneLine(hand[i], hand[j], proj, `halo-${label}-${k}`, {
          stroke: '#ffffff',
          strokeWidth: 6,
          strokeOpacity: 0.9,
        }),
      )}
      {HAND_BONES.map(([i, j], k) =>
        boneLine(hand[i], hand[j], proj, `bone-${label}-${k}`, {
          stroke: colors.bone,
          strokeWidth: 3.5,
        }),
      )}
      {hand.map((lm, i) => {
        if (i === 0 || !isFinitePoint(lm)) return null
        const r = FINGERTIPS.has(i) ? 4.5 : 3
        return (
          <circle
            key={`node-${label}-${i}`}
            cx={proj.x(lm)}
            cy={proj.y(lm)}
            r={r}
            fill="#ffffff"
            stroke={colors.node}
            strokeWidth={2}
          />
        )
      })}
      {isFinitePoint(hand[0]) && (
        <circle
          cx={proj.x(hand[0])}
          cy={proj.y(hand[0])}
          r={5.5}
          fill={colors.node}
          stroke="#ffffff"
          strokeWidth={2}
        />
      )}
    </g>
  )
}

export default function SigningAvatar2D({
  frames,
  signName,
  autoplay = true,
  loop = true,
  playbackRate: initialPlaybackRate = 1,
  mirrored: initialMirrored = false,
}: SigningAvatar2DProps) {
  const [playing, setPlaying] = useState(autoplay)
  const [playbackRate, setPlaybackRate] = useState<number>(initialPlaybackRate)
  const [mirrored, setMirrored] = useState(initialMirrored)
  const [resetToken, setResetToken] = useState(0)
  const [displayFrame, setDisplayFrame] = useState<GlossReferenceFrame>(() => frames[0])

  const proj = useMemo(() => buildProjector(frames), [frames])

  const elapsedRef = useRef(0)
  const lastTsRef = useRef<number | null>(null)

  useEffect(() => {
    elapsedRef.current = 0
    lastTsRef.current = null
  }, [resetToken])

  useEffect(() => {
    if (frames.length < 2) return
    let raf = 0
    const stepFn = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts
      const delta = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      if (playing) {
        elapsedRef.current += delta
        const pos = computePlaybackPosition(elapsedRef.current, frames.length, playbackRate, loop)
        setDisplayFrame(interpolateFrame(frames[pos.frameIndexA]!, frames[pos.frameIndexB]!, pos.t))
        if (pos.finished) setPlaying(false)
      }
      raf = requestAnimationFrame(stepFn)
    }
    raf = requestAnimationFrame(stepFn)
    return () => cancelAnimationFrame(raf)
  }, [frames, playing, playbackRate, loop])

  if (frames.length < 2) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
        Not enough reference frames to animate this sign.
      </div>
    )
  }

  const lm = displayFrame.landmarks
  const leftHand = lm.slice(7, 28)
  const rightHand = lm.slice(28, 49)
  const leftPresent = handIsPresent(leftHand)
  const rightPresent = handIsPresent(rightHand)

  const noseLm = lm[NOSE]
  const lShoulder = lm[L_SH]
  const rShoulder = lm[R_SH]

  // Body centre: mid-shoulder + a synthesized torso point straight
  // below it (no hip landmarks exist — this is a fixed readable stub,
  // ~1.1x the shoulder span down).
  let midSh: { x: number; y: number } | null = null
  let torso: { x: number; y: number } | null = null
  if (isFinitePoint(lShoulder) && isFinitePoint(rShoulder)) {
    const lx = proj.x(lShoulder)
    const ly = proj.y(lShoulder)
    const rx = proj.x(rShoulder)
    const ry = proj.y(rShoulder)
    midSh = { x: (lx + rx) / 2, y: (ly + ry) / 2 }
    const spanScreen = Math.hypot(rx - lx, ry - ly) || VB_HEIGHT * 0.22
    torso = { x: midSh.x, y: midSh.y + spanScreen * 1.1 }
  }

  // Reduce clutter when both hands sit on top of each other: nudge
  // them slightly apart and fade the one drawn first.
  let leftDx = 0
  let rightDx = 0
  let leftOpacity = 1
  let rightOpacity = 1
  let leftFirst = true
  if (leftPresent && rightPresent && isFinitePoint(leftHand[0]) && isFinitePoint(rightHand[0])) {
    const lw = { x: proj.x(leftHand[0]), y: proj.y(leftHand[0]) }
    const rw = { x: proj.x(rightHand[0]), y: proj.y(rightHand[0]) }
    const dist = Math.hypot(lw.x - rw.x, lw.y - rw.y)
    // Whichever wrist is higher on screen (smaller y) sits "behind".
    leftFirst = lw.y <= rw.y
    if (dist < VB_HEIGHT * 0.12) {
      const nudge = VB_HEIGHT * 0.055
      leftDx = lw.x <= rw.x ? -nudge : nudge
      rightDx = -leftDx
      if (leftFirst) leftOpacity = 0.8
      else rightOpacity = 0.8
    }
  }

  const leftHandNode = leftPresent ? (
    <Hand hand={leftHand} proj={proj} colors={COLORS.left} opacity={leftOpacity} dx={leftDx} label="L" />
  ) : null
  const rightHandNode = rightPresent ? (
    <Hand hand={rightHand} proj={proj} colors={COLORS.right} opacity={rightOpacity} dx={rightDx} label="R" />
  ) : null

  const handleReplay = () => {
    setResetToken((n) => n + 1)
    setPlaying(true)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative w-full overflow-hidden rounded-[var(--radius-md)] p-2"
        style={{ background: COLORS.panel, minHeight: 220 }}
      >
        {mirrored && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Mirrored view
          </span>
        )}
        <svg
          role="img"
          aria-label={`${signName} — 2D sign guide`}
          viewBox={`0 0 ${proj.vbWidth} ${VB_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="mx-auto block h-auto w-full"
          style={{ maxHeight: 420 }}
        >
          <title>{`${signName} — animated 2D sign guide`}</title>
          <g transform={mirrored ? `translate(${proj.vbWidth} 0) scale(-1 1)` : undefined}>
            {/* ---- body (behind) ---- */}
            {torso && isFinitePoint(lShoulder) && isFinitePoint(rShoulder) && (
              <path
                d={`M ${proj.x(lShoulder)} ${proj.y(lShoulder)}
                    L ${proj.x(rShoulder)} ${proj.y(rShoulder)}
                    L ${proj.x(rShoulder)} ${torso.y}
                    L ${proj.x(lShoulder)} ${torso.y} Z`}
                fill={COLORS.torso}
                fillOpacity={0.7}
              />
            )}
            {midSh && isFinitePoint(noseLm) && (
              <line
                x1={proj.x(noseLm)}
                y1={proj.y(noseLm)}
                x2={midSh.x}
                y2={midSh.y}
                stroke={COLORS.body}
                strokeWidth={3}
                strokeOpacity={0.55}
                strokeLinecap="round"
              />
            )}
            {midSh && torso && (
              <line
                x1={midSh.x}
                y1={midSh.y}
                x2={torso.x}
                y2={torso.y}
                stroke={COLORS.body}
                strokeWidth={3}
                strokeOpacity={0.55}
                strokeLinecap="round"
              />
            )}
            {BODY_BONES.map(([i, j], k) =>
              boneLine(lm[i], lm[j], proj, `body-${k}`, {
                stroke: COLORS.body,
                strokeWidth: 3.5,
              }),
            )}
            {isFinitePoint(noseLm) && (
              <circle
                cx={proj.x(noseLm)}
                cy={proj.y(noseLm)}
                r={13}
                fill="#ffffff"
                stroke={COLORS.body}
                strokeWidth={3}
              />
            )}
            {[L_SH, R_SH, 3, 4].map((i) =>
              isFinitePoint(lm[i]) ? (
                <circle key={`bj-${i}`} cx={proj.x(lm[i]!)} cy={proj.y(lm[i]!)} r={3.5} fill={COLORS.bodyJoint} />
              ) : null,
            )}
            {midSh && <circle cx={midSh.x} cy={midSh.y} r={4} fill={COLORS.bodyJoint} />}
            {torso && <circle cx={torso.x} cy={torso.y} r={4} fill={COLORS.bodyJoint} />}

            {/* ---- hands (in front); further-back hand drawn first ---- */}
            {leftFirst ? (
              <>
                {leftHandNode}
                {rightHandNode}
              </>
            ) : (
              <>
                {rightHandNode}
                {leftHandNode}
              </>
            )}
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS.left.node }} />
          Left hand
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS.right.node }} />
          Right hand
        </span>
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
          aria-pressed={mirrored}
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
              aria-pressed={playbackRate === speed}
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