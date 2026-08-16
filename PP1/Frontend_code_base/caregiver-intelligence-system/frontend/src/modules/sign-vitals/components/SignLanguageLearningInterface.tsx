import '@mediapipe/camera_utils'
import '@mediapipe/drawing_utils'
import '@mediapipe/hands'
import type { NormalizedLandmarkList, Results } from '@mediapipe/hands'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RotateCcw,
  RotateCw,
  Star,
  Volume2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Same edges as MediaPipe `HAND_CONNECTIONS` (bundles attach to `window`, not ESM exports). */
const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
]

type HandsController = {
  setOptions: (options: {
    maxNumHands?: number
    modelComplexity?: 0 | 1
    minDetectionConfidence?: number
    minTrackingConfidence?: number
  }) => void
  onResults: (cb: (results: Results) => void) => void
  send: (input: { image: HTMLVideoElement }) => Promise<void>
  close: () => Promise<void>
  reset: () => void
}

type MediaPipeGlobals = Window & {
  Hands?: new (config?: { locateFile?: (file: string) => string }) => HandsController
  Camera?: new (
    video: HTMLVideoElement,
    options: {
      onFrame: () => Promise<void>
      width?: number
      height?: number
      facingMode?: 'user' | 'environment'
    },
  ) => { start: () => Promise<void>; stop: () => Promise<void> }
}

type DrawGlobals = Window & {
  drawConnectors?: (
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number }> | undefined,
    connections: Array<[number, number]>,
    options?: { color?: string; lineWidth?: number },
  ) => void
  drawLandmarks?: (
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number }> | undefined,
    options?: { color?: string; lineWidth?: number; radius?: number },
  ) => void
}

type FeedbackMetrics = {
  handShape: boolean
  movement: boolean
  speed: string
}

const LESSON_CURRENT = 3
const LESSON_TOTAL = 10

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function computeFeedbackFromResults(
  results: Results,
  wristHistory: { x: number; y: number }[],
): FeedbackMetrics {
  const landmarks = results.multiHandLandmarks[0]
  const handedness = results.multiHandedness[0]
  if (!landmarks?.length) {
    return { handShape: false, movement: false, speed: '—' }
  }

  const wrist = landmarks[0]
  wristHistory.push({ x: wrist.x, y: wrist.y })
  if (wristHistory.length > 12) wristHistory.shift()

  let pathLength = 0
  for (let i = 1; i < wristHistory.length; i += 1) {
    const a = wristHistory[i - 1]
    const b = wristHistory[i]
    pathLength += Math.hypot(b.x - a.x, b.y - a.y)
  }

  const handShape = Boolean(handedness && handedness.score >= 0.65 && landmarks.length >= 21)
  const movement = pathLength > 0.035

  let speed = 'Good pace'
  if (wristHistory.length >= 8) {
    const recent = wristHistory.slice(-4)
    let burst = 0
    for (let i = 1; i < recent.length; i += 1) {
      burst += Math.hypot(recent[i].x - recent[i - 1].x, recent[i].y - recent[i - 1].y)
    }
    if (burst > 0.08) speed = 'Slightly fast'
    else if (burst < 0.012) speed = 'Slightly slow'
  }

  return { handShape, movement, speed }
}

function overallPercent(metrics: FeedbackMetrics): number {
  let score = 45
  if (metrics.handShape) score += 28
  if (metrics.movement) score += 18
  if (metrics.speed === 'Good pace') score += 9
  else if (metrics.speed === '—') score -= 5
  return clamp(Math.round(score), 0, 100)
}

export function SignLanguageLearningInterface() {
  const [currentSign, setCurrentSign] = useState('HELP')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const miniCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [landmarks, setLandmarks] = useState<NormalizedLandmarkList>([])
  const [feedbackMetrics, setFeedbackMetrics] = useState<FeedbackMetrics>({
    handShape: false,
    movement: false,
    speed: '—',
  })
  const [liveAnnouncement, setLiveAnnouncement] = useState(
    'Practice area ready. Start your webcam when you are ready.',
  )
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [cameraError, setCameraError] = useState<string | null>(null)

  const handsRef = useRef<HandsController | null>(null)
  const wristHistoryRef = useRef<{ x: number; y: number }[]>([])
  const rafFitRef = useRef<number>(0)
  const announceRef = useRef({ t: 0, hand: false, bucket: -1 })

  const fitCanvasToContainer = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = containerRef.current
    if (!canvas || !wrap) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const w = Math.max(1, Math.floor(wrap.clientWidth * dpr))
    const h = Math.max(1, Math.floor(wrap.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }, [])

  const drawLandmarksOnCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, landmarksList: NormalizedLandmarkList, width: number, height: number) => {
      const win = window as DrawGlobals
      const { drawConnectors, drawLandmarks } = win
      if (!drawConnectors || !drawLandmarks || !landmarksList.length) return
      ctx.clearRect(0, 0, width, height)
      drawConnectors(ctx, landmarksList, HAND_CONNECTIONS, { color: '#22C55E', lineWidth: 3 })
      drawLandmarks(ctx, landmarksList, { color: '#A855F7', lineWidth: 1, radius: 3 })
    },
    [],
  )

  useEffect(() => {
    const mini = miniCanvasRef.current
    if (!mini) return
    const ctx = mini.getContext('2d')
    if (!ctx) return
    const size = mini.width
    ctx.clearRect(0, 0, size, size)
    if (!landmarks.length) return
    const win = window as DrawGlobals
    const { drawConnectors, drawLandmarks } = win
    if (!drawConnectors || !drawLandmarks) return
    ctx.save()
    ctx.scale(size, size)
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#16A34A', lineWidth: 0.008 })
    drawLandmarks(ctx, landmarks, { color: '#9333EA', lineWidth: 0.004, radius: 0.012 })
    ctx.restore()
  }, [landmarks])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    const g = window as MediaPipeGlobals
    if (!g.Hands || !g.Camera) {
      queueMicrotask(() =>
        setCameraError('Hand tracking could not load. Refresh the page and try again.'),
      )
      return
    }

    const hands = new g.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    })
    handsRef.current = hands

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    hands.onResults((results) => {
      if (cancelled) return
      const first = results.multiHandLandmarks[0] ?? []
      setLandmarks(first)

      const metrics = computeFeedbackFromResults(results, wristHistoryRef.current)
      setFeedbackMetrics(metrics)

      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          drawLandmarksOnCanvas(ctx, first, canvas.width, canvas.height)
        }
      }

      const pct = overallPercent(metrics)
      const hasHand = first.length > 0
      const bucket = Math.floor(pct / 15)
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const ann = announceRef.current
      if (
        hasHand !== ann.hand ||
        bucket !== ann.bucket ||
        now - ann.t > 1400
      ) {
        announceRef.current = { t: now, hand: hasHand, bucket }
        setLiveAnnouncement(
          hasHand
            ? `Hand tracked. Estimated match ${pct} percent. Hand shape ${metrics.handShape ? 'on track' : 'adjust fingers'}.`
            : 'No hand detected. Center your hand in the frame.',
        )
      }
    })

    const camera = new g.Camera(video, {
      onFrame: async () => {
        if (!handsRef.current || cancelled) return
        await handsRef.current.send({ image: video })
      },
      width: 1280,
      height: 720,
      facingMode,
    })
    const onResize = () => {
      cancelAnimationFrame(rafFitRef.current)
      rafFitRef.current = requestAnimationFrame(() => fitCanvasToContainer())
    }

    void camera
      .start()
      .then(() => {
        setCameraError(null)
        onResize()
      })
      .catch(() => {
        setCameraError('Camera could not start. Check permissions and try again.')
      })

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    if (containerRef.current) ro?.observe(containerRef.current)
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      cancelAnimationFrame(rafFitRef.current)
      void camera.stop()
      void hands.close()
      handsRef.current = null
      wristHistoryRef.current = []
    }
  }, [facingMode, drawLandmarksOnCanvas, fitCanvasToContainer])

  const flipCamera = () => {
    setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))
  }

  const playAudioCue = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utter = new SpeechSynthesisUtterance(`Current sign: ${currentSign}`)
    utter.rate = 0.95
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  const score = overallPercent(feedbackMetrics)
  const starCount = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1

  const checklist = [
    { id: 'shape', ok: feedbackMetrics.handShape, label: 'Hand shape matches reference', tone: 'ok' as const },
    { id: 'move', ok: feedbackMetrics.movement, label: 'Movement follows the arc', tone: 'ok' as const },
    {
      id: 'speed',
      ok: feedbackMetrics.speed === 'Good pace',
      label: `Speed: ${feedbackMetrics.speed}`,
      tone:
        feedbackMetrics.speed === 'Good pace'
          ? ('ok' as const)
          : feedbackMetrics.speed === '—'
            ? ('info' as const)
            : ('warn' as const),
    },
  ] as const

  return (
    <div className="grid min-h-screen grid-cols-1 gap-6 bg-purple-50 p-6 lg:grid-cols-5">
      <div className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </div>

      <section className="lg:col-span-5">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-purple-600">{currentSign}</h1>
          <button
            type="button"
            className="rounded-full p-2 text-purple-600 transition hover:bg-purple-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
            aria-label={`Play audio description for the sign ${currentSign}`}
            onClick={playAudioCue}
          >
            <Volume2 className="h-7 w-7" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-purple-600 transition-[width] duration-300"
              style={{ width: `${(LESSON_CURRENT / LESSON_TOTAL) * 100}%` }}
              role="progressbar"
              aria-valuenow={LESSON_CURRENT}
              aria-valuemin={0}
              aria-valuemax={LESSON_TOTAL}
              aria-label={`Lesson progress ${LESSON_CURRENT} of ${LESSON_TOTAL}`}
            />
          </div>
          <p className="text-right text-sm font-medium text-gray-700 sm:min-w-[3.5rem]">
            {LESSON_CURRENT}/{LESSON_TOTAL}
          </p>
        </div>
      </section>

      <div className="lg:col-span-2">
        <div className="rounded-xl bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900">Learn the Sign</h2>
          <p className="mt-4 text-sm text-gray-600">
            Follow the demonstration, then practice on the right. A 3D avatar can plug in here later (Three.js or Ready
            Player Me).
          </p>
          <div className="mt-4 aspect-square rounded-lg bg-gray-50">
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-gray-500"
              role="img"
              aria-label="Placeholder for three dimensional avatar demonstration"
            >
              <span className="text-4xl" aria-hidden>
                ✋
              </span>
              <span className="text-sm">3D avatar placeholder</span>
            </div>
          </div>
          <div className="mt-4 flex flex-row flex-wrap gap-4 text-sm">
            <button
              type="button"
              className="text-purple-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
              aria-label="Rotate avatar view left"
            >
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="h-4 w-4" aria-hidden />
                Rotate left
              </span>
            </button>
            <button
              type="button"
              className="text-purple-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
              aria-label="Reset avatar to default view"
            >
              Reset view
            </button>
            <button
              type="button"
              className="text-purple-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
              aria-label="Rotate avatar view right"
            >
              <span className="inline-flex items-center gap-1">
                Rotate right
                <RotateCw className="h-4 w-4" aria-hidden />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Your Practice</h2>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Live</span>
        </div>

        <div
          ref={containerRef}
          className="relative mt-4 aspect-video overflow-hidden rounded-xl bg-gray-900"
          role="region"
          aria-label="Webcam practice with hand landmark overlay"
        >
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute left-0 top-0 h-full w-full"
            aria-hidden
          />
          <div className="pointer-events-none absolute right-4 top-4 h-32 w-32 rounded-lg bg-white/90 p-2 shadow-sm">
            <canvas ref={miniCanvasRef} width={112} height={112} className="h-full w-full" aria-hidden />
            <span className="sr-only">Miniature landmark preview for detected hand</span>
          </div>
          <button
            type="button"
            className="absolute bottom-4 right-4 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
            aria-label="Switch between front and back camera"
            onClick={flipCamera}
          >
            Flip Camera
          </button>
        </div>
        {cameraError ? <p className="mt-2 text-sm text-orange-600">{cameraError}</p> : null}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-md">
            <div className="relative h-36 w-36" aria-label={`Accuracy score ${score} percent`}>
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth="10"
                  strokeDasharray={`${(score / 100) * (2 * Math.PI * 42)} ${2 * Math.PI * 42}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-green-600">{score}%</span>
              </div>
            </div>
            <div className="mt-3 flex gap-1" aria-label={`Star rating ${starCount} of five`}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`h-6 w-6 ${i < starCount ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                  aria-hidden
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-md">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Checklist</h3>
            <ul className="space-y-1 text-sm text-gray-800">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-1">
                  {item.tone === 'info' ? (
                    <Info className="h-5 w-5 shrink-0 text-blue-500" aria-hidden />
                  ) : item.tone === 'warn' ? (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
                  ) : item.ok ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
                  )}
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-md">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Tips</h3>
            <div className="flex gap-3">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600"
                aria-hidden
              >
                <span className="text-2xl">👋</span>
              </div>
              <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700">
                <li>Keep your palm open and fingers relaxed.</li>
                <li>Match the tutor hand height and angle.</li>
                <li>Use smooth motion; pause at the end pose.</li>
              </ul>
            </div>
          </div>
        </div>

        <nav
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Lesson navigation"
        >
          <button
            type="button"
            className="rounded-lg border border-purple-600 px-6 py-3 text-purple-600 transition hover:bg-purple-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
            aria-label="Go to previous sign in the lesson"
            onClick={() => setCurrentSign('THANK YOU')}
          >
            Previous Sign
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
            aria-label="Reset practice and clear motion history"
            onClick={() => {
              wristHistoryRef.current = []
              handsRef.current?.reset()
              setFeedbackMetrics({ handShape: false, movement: false, speed: '—' })
              setLiveAnnouncement('Practice reset. Show the sign again when you are ready.')
            }}
          >
            Try Again
          </button>
          <button
            type="button"
            className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
            aria-label="Go to next sign in the lesson"
            onClick={() => setCurrentSign('THANK YOU')}
          >
            Next Sign
          </button>
        </nav>
      </div>
    </div>
  )
}
