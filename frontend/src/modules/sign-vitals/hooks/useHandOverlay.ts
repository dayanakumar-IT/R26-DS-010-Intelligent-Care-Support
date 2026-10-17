import { useEffect, useState, type RefObject } from 'react'
import type { HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'
// MediaPipe tasks-vision 0.10.14 (same version as the backend's MediaPipe),
// kept in the module so the app works without a CDN.
import wasmLoaderPath from '../assets/mediapipe/vision_wasm_internal.js?url'
import wasmBinaryPath from '../assets/mediapipe/vision_wasm_internal.wasm?url'
import handModelPath from '../assets/mediapipe/hand_landmarker.task?url'

/**
 * Live hand landmarks drawn on the camera preview — DISPLAY ONLY.
 *
 * Runs MediaPipe's hand landmarker in the browser on the preview <video> and
 * draws the hands on a canvas over it. Nothing from here is recorded, sent
 * to the server or used for grading: the recording is the raw camera track
 * (WebcamCapture) and the backend extracts its own landmarks.
 *
 * status: 'loading' until the model is ready; 'visible' / 'not-visible'
 * while running; 'off' if it could not load or runs too slowly on this
 * device (the caller then shows only the simple face guide).
 */
export type HandOverlayStatus = 'loading' | 'visible' | 'not-visible' | 'off'

const FRAME_INTERVAL_MS = 100 // 10 checks a second is plenty for a guide
const TOO_SLOW_MS = 60 // average detection time above this -> not smooth, turn off
const SETTLE_MS = 400 // a status must hold this long before the chip changes
const WARMUP_CHECKS = 10
const EDGE = 0.02 // a hand touching the frame edge counts as "not in view"

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
]

function inView(hand: NormalizedLandmark[]): boolean {
  return hand.every((p) => p.x > EDGE && p.x < 1 - EDGE && p.y > EDGE && p.y < 1 - EDGE)
}

function draw(canvas: HTMLCanvasElement, hands: NormalizedLandmark[][]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  const scale = Math.max(1, w / 640)
  for (const hand of hands) {
    const ok = inView(hand)
    ctx.strokeStyle = ok ? 'rgba(74, 222, 128, 0.95)' : 'rgba(251, 191, 36, 0.95)'
    ctx.lineWidth = 3 * scale
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(hand[a].x * w, hand[a].y * h)
      ctx.lineTo(hand[b].x * w, hand[b].y * h)
    }
    ctx.stroke()
    ctx.fillStyle = 'white'
    for (const p of hand) {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, 3.5 * scale, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

async function createLandmarker(): Promise<HandLandmarker> {
  const { HandLandmarker } = await import('@mediapipe/tasks-vision')
  const fileset = { wasmLoaderPath, wasmBinaryPath }
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: handModelPath, delegate },
    runningMode: 'VIDEO' as const,
    numHands: 2,
  })
  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'))
  } catch {
    return HandLandmarker.createFromOptions(fileset, options('CPU'))
  }
}

export function useHandOverlay(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
): HandOverlayStatus {
  const [status, setStatus] = useState<HandOverlayStatus>('loading')

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let landmarker: HandLandmarker | null = null
    let raf = 0
    let last = 0
    let lastVideoTime = -1
    const durations: number[] = []
    let checks = 0
    let shown: HandOverlayStatus = 'loading'
    let candidate: HandOverlayStatus = 'loading'
    let candidateSince = 0

    const turnOff = (reason: string) => {
      console.info(`[GLOSS] hand guide off (face guide only): ${reason}`)
      stopped = true
      cancelAnimationFrame(raf)
      const canvas = canvasRef.current
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      setStatus('off')
    }

    const tick = (now: number) => {
      if (stopped) return
      raf = requestAnimationFrame(tick)
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!landmarker || !video || !canvas || video.readyState < 2 || now - last < FRAME_INTERVAL_MS) return
      if (video.currentTime === lastVideoTime) return
      last = now
      lastVideoTime = video.currentTime
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const t0 = performance.now()
      let hands: NormalizedLandmark[][]
      try {
        hands = landmarker.detectForVideo(video, now).landmarks
      } catch (e) {
        turnOff(`detection failed: ${e instanceof Error ? e.message : e}`)
        return
      }
      checks += 1
      // The first checks compile GPU shaders and are slow: judge after them.
      if (checks > WARMUP_CHECKS) durations.push(performance.now() - t0)
      if (durations.length > 30) durations.shift()
      // Judge smoothness after a short warm-up (the first calls are slow).
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length
      if (durations.length === 30 && checks === WARMUP_CHECKS + 30) console.debug(`[GLOSS] hand guide: ${Math.round(avg)} ms per check`)
      if (durations.length === 30 && avg > TOO_SLOW_MS) {
        turnOff(`too slow on this device (${Math.round(avg)} ms per check)`)
        return
      }
      draw(canvas, hands)
      const next: HandOverlayStatus = hands.length > 0 && hands.every(inView) ? 'visible' : 'not-visible'
      if (next !== candidate) {
        candidate = next
        candidateSince = now
      }
      if (candidate !== shown && (shown === 'loading' || now - candidateSince >= SETTLE_MS)) {
        shown = candidate
        setStatus(candidate)
      }
    }

    createLandmarker()
      .then((lm) => {
        if (stopped) {
          lm.close()
          return
        }
        landmarker = lm
        raf = requestAnimationFrame(tick)
      })
      .catch((e) => {
        if (!stopped) turnOff(`could not load: ${e instanceof Error ? e.message : e}`)
      })

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      landmarker?.close()
    }
  }, [enabled, videoRef, canvasRef])

  return enabled ? status : 'off'
}
