import { useEffect, useRef, useState, type RefObject } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { HAND_LANDMARKER_TASK_URL, VISION_WASM_ROOT } from './mediapipeConstants'
import { matchSignPrototype, type Landmark, type SignMatchResult } from '../../utils/signMatching'

export type HandDetectionStatus = 'idle' | 'no_stream' | 'no_hand' | 'off_frame' | 'tracking'

type MediaPipeHandTrackerProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  targetWord: string
  mirrored?: boolean
  enabled?: boolean
  onMatch?: (result: SignMatchResult & { smoothedScore: number; status: HandDetectionStatus }) => void
}

function landmarkToModel(lm: { x: number; y: number; z: number }): Landmark {
  return { x: lm.x, y: lm.y, z: lm.z }
}

function inFrame(landmarks: Landmark[]) {
  const w = landmarks[0]
  if (!w) return false
  return w.x > 0.04 && w.x < 0.96 && w.y > 0.04 && w.y < 0.96
}

export function MediaPipeHandTracker({
  videoRef,
  targetWord,
  mirrored = true,
  enabled = true,
  onMatch,
}: MediaPipeHandTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wristHistory = useRef<Array<{ x: number; y: number; t: number }>>([])
  const smoothRef = useRef(0)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const connectionsRef = useRef<typeof HandLandmarker.HAND_CONNECTIONS | null>(null)
  const onMatchRef = useRef(onMatch)
  onMatchRef.current = onMatch

  const [status, setStatus] = useState<HandDetectionStatus>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)

  const pushWrist = (x: number, y: number) => {
    const t = performance.now()
    wristHistory.current.push({ x, y, t })
    if (wristHistory.current.length > 50) {
      wristHistory.current.shift()
    }
  }

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let raf = 0

    const boot = async () => {
      try {
        const resolver = await FilesetResolver.forVisionTasks(VISION_WASM_ROOT)
        if (cancelled) return
        const create = async (gpu: boolean) =>
          HandLandmarker.createFromOptions(resolver, {
            baseOptions: {
              modelAssetPath: HAND_LANDMARKER_TASK_URL,
              delegate: gpu ? 'GPU' : 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.45,
            minHandPresenceConfidence: 0.35,
            minTrackingConfidence: 0.35,
          })
        try {
          landmarkerRef.current = await create(true)
        } catch {
          landmarkerRef.current = await create(false)
        }
        connectionsRef.current = HandLandmarker.HAND_CONNECTIONS
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load Hand Landmarker')
      }
    }

    void boot()

    const draw = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      const landmarker = landmarkerRef.current
      const connections = connectionsRef.current
      if (!canvas) {
        raf = requestAnimationFrame(draw)
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        raf = requestAnimationFrame(draw)
        return
      }

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      ctx.clearRect(0, 0, w, h)

      if (!enabled || !video || video.readyState < 2 || !landmarker) {
        onMatchRef.current?.({
          score: 0,
          correct: false,
          feedback: {
            handShape: { ok: false, tip: 'Start the camera to begin tracking.' },
            handPosition: { ok: false, tip: 'Center yourself arm-length from the device.' },
            movementPath: { ok: false, tip: 'Bring your hand into the frame.' },
            holdTime: { ok: false, tip: 'Hold steady once you see landmarks.' },
          },
          smoothedScore: Math.round(smoothRef.current),
          status: 'no_stream',
        })
        raf = requestAnimationFrame(draw)
        return
      }

      let detStatus: HandDetectionStatus = 'tracking'

      const result = landmarker.detectForVideo(video, performance.now())
      const raw = result.landmarks?.[0]
      const modelLm = raw?.map(landmarkToModel) ?? null

      if (!modelLm) {
        detStatus = 'no_hand'
        smoothRef.current *= 0.95
        onMatchRef.current?.({
          score: Math.round(smoothRef.current),
          correct: false,
          feedback: {
            handShape: { ok: false, tip: 'Open your palm wider' },
            handPosition: { ok: false, tip: 'Move hand slightly higher' },
            movementPath: { ok: false, tip: 'Movement direction is correct' },
            holdTime: { ok: false, tip: 'Hold the final position longer' },
          },
          smoothedScore: Math.round(smoothRef.current),
          status: detStatus,
        })
        setStatus(detStatus)
        raf = requestAnimationFrame(draw)
        return
      }

      if (!inFrame(modelLm)) {
        detStatus = 'off_frame'
      }

      pushWrist(modelLm[0]!.x, modelLm[0]!.y)
      const match = matchSignPrototype(targetWord, modelLm, wristHistory.current)
      const alpha = 0.2
      smoothRef.current = smoothRef.current * (1 - alpha) + match.score * alpha

      const lineColor = match.correct ? '#22c55e' : '#ef4444'

      ctx.save()
      if (mirrored) {
        ctx.translate(w, 0)
        ctx.scale(-1, 1)
      }

      const mapX = (x: number) => x * w
      const mapY = (y: number) => y * h

      if (connections) {
        for (const c of connections) {
          const la = modelLm[c.start]!
          const lb = modelLm[c.end]!
          ctx.strokeStyle = lineColor
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(mapX(la.x), mapY(la.y))
          ctx.lineTo(mapX(lb.x), mapY(lb.y))
          ctx.stroke()
        }
      }

      for (let i = 0; i < modelLm.length; i++) {
        const p = modelLm[i]!
        const hue = i === 0 ? '#22c55e' : lineColor
        ctx.fillStyle = hue
        ctx.beginPath()
        ctx.arc(mapX(p.x), mapY(p.y), i === 0 ? 6 : 3.2, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()

      onMatchRef.current?.({
        ...match,
        smoothedScore: Math.round(smoothRef.current),
        status: detStatus,
      })
      setStatus(detStatus)

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [enabled, videoRef, targetWord, mirrored])

  const statusLabel =
    loadError != null
      ? loadError
      : status === 'no_stream'
        ? 'Start camera feed'
        : status === 'no_hand'
          ? 'No hand detected'
          : status === 'off_frame'
            ? 'Move hand into frame'
            : status === 'idle'
              ? 'Initializing…'
              : 'Hand detected'

  return (
    <div className="relative h-full min-h-0 w-full flex-1">
      <canvas ref={canvasRef} className="h-full w-full object-contain" />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-full border border-white/40 bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
        {statusLabel}
      </div>
    </div>
  )
}
