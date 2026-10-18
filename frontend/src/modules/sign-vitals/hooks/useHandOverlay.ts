import { useEffect, useRef, useState, type RefObject } from 'react'
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
 * while running; 'off' if it could not load, is unusably slow on this device
 * before recording starts, or the viewer switched it off (localStorage
 * 'gloss-hand-guide' = 'off'). The caller then shows a faint face guide.
 *
 * Speed: detection runs on about every 3rd camera frame (~10 a second) and
 * backs off further when it is slow, so the recording keeps its frame rate.
 * It never switches itself off during a recording (that made the landmarks
 * disappear in Check my sign as soon as recording started).
 */
export type HandOverlayStatus = 'loading' | 'visible' | 'not-visible' | 'off'

const BASE_INTERVAL_MS = 100 // ~every 3rd frame at 30 fps
const MAX_INTERVAL_MS = 400 // slowest back-off (2-3 checks a second)
const UNUSABLE_MS = 250 // before recording: slower than this per check -> face guide only
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

/** The viewer switched the hand guide off on this browser (or storage is unavailable: on). */
export function handGuideSwitchedOff(): boolean {
  try {
    return localStorage.getItem('gloss-hand-guide') === 'off'
  } catch {
    return false
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
  recording = false,
): HandOverlayStatus {
  const [status, setStatus] = useState<HandOverlayStatus>('loading')
  const switchedOff = handGuideSwitchedOff()
  // Read inside the loop without restarting it.
  const recordingRef = useRef(recording)
  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  useEffect(() => {
    if (!enabled || switchedOff) return
    let stopped = false
    let landmarker: HandLandmarker | null = null
    let raf = 0
    let last = 0
    let lastVideoTime = -1
    const durations: number[] = []
    let checks = 0
    let interval = BASE_INTERVAL_MS
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
      if (!landmarker || !video || !canvas || video.readyState < 2 || now - last < interval) return
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
      const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
      if (checks === WARMUP_CHECKS + 30) console.debug(`[GLOSS] hand guide: ${Math.round(avg)} ms per check`)
      // Back off when detection is slow (keeps the page and the recording smooth).
      interval = Math.min(MAX_INTERVAL_MS, Math.max(BASE_INTERVAL_MS, avg * 2.5))
      if (durations.length >= 20 && avg > UNUSABLE_MS && !recordingRef.current) {
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
  }, [enabled, switchedOff, videoRef, canvasRef])

  return enabled && !switchedOff ? status : 'off'
}
