import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { Card } from '../../../shared/components/Card'
import { createFrameBufferService } from '../services/frameBufferService'
import { toNormalizedFrame } from '../services/landmarkExportService'
import { buildPracticeResult, scoreLiveLandmarks } from '../services/landmarkScoringService'
import { createMediaPipeService } from '../services/mediaPipeService'
import type {
  EngagementState,
  HolisticResultsLike,
  LandmarkFlags,
  LiveScores,
  PracticeRealtimeState,
  PracticeResult,
} from '../types/mediaPipe.types'
import { LandmarkFeedbackLegend } from './LandmarkFeedbackLegend'
import { LandmarkMiniPreview } from './LandmarkMiniPreview'
import { LiveAccuracyPanel } from './LiveAccuracyPanel'
import { MediaPipeOverlayCanvas } from './MediaPipeOverlayCanvas'
import cls from './signVitals.module.css'

const initialScores: LiveScores = {
  handShape: 0,
  handPosition: 0,
  movementPath: 0,
  facialExpression: 0,
  timing: 0,
  overall: 0,
}

const initialFlags: LandmarkFlags = {
  leftHandDetected: false,
  rightHandDetected: false,
  poseDetected: false,
}

export function ASLPracticeCamera({
  onAnalysisDone,
  onRealtimeUpdate,
}: {
  onAnalysisDone: (result: PracticeResult) => void
  onRealtimeUpdate?: (state: PracticeRealtimeState) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState('Camera is off')
  const [cameraStarted, setCameraStarted] = useState(false)
  const [results, setResults] = useState<HolisticResultsLike | null>(null)
  const [scores, setScores] = useState<LiveScores>(initialScores)
  const [flags, setFlags] = useState<LandmarkFlags>(initialFlags)
  const [coloredPoints, setColoredPoints] = useState<ReturnType<typeof scoreLiveLandmarks>['colorizedLandmarks']>([])
  const [frameCount, setFrameCount] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [facingModeText, setFacingModeText] = useState<'user' | 'environment'>('user')
  const [movementDelta, setMovementDelta] = useState(0)
  const [showDebug, setShowDebug] = useState(false)
  const previousWrist = useRef<{ x: number; y: number } | null>(null)
  const frameIndexRef = useRef(0)
  const sessionStartRef = useRef<number | null>(null)

  const mediaPipe = useMemo(() => createMediaPipeService(), [])
  const buffer = useMemo(() => createFrameBufferService(30), [])

  useEffect(() => {
    return () => {
      void mediaPipe.dispose()
    }
  }, [mediaPipe])

  const onResults = (nextResults: HolisticResultsLike) => {
    setResults(nextResults)
    const leftWrist = nextResults.leftHandLandmarks?.[0] ?? nextResults.poseLandmarks?.[15]
    if (leftWrist && previousWrist.current) {
      const dx = leftWrist.x - previousWrist.current.x
      const dy = leftWrist.y - previousWrist.current.y
      setMovementDelta(Math.sqrt(dx * dx + dy * dy))
    }
    if (leftWrist) {
      previousWrist.current = { x: leftWrist.x, y: leftWrist.y }
    }

    const live = scoreLiveLandmarks(
      nextResults.poseLandmarks ?? [],
      nextResults.leftHandLandmarks ?? [],
      nextResults.rightHandLandmarks ?? [],
      nextResults.faceLandmarks ?? [],
      movementDelta,
    )
    setScores(live.scores)
    setFlags(live.flags)
    setColoredPoints(live.colorizedLandmarks)

    const sessionSeconds = Math.floor((Date.now() - (sessionStartRef.current ?? Date.now())) / 1000)
    const engagementValue = Math.max(
      42,
      Math.min(95, 92 - (sessionSeconds > 150 ? 14 : 0) - (nextResults.faceLandmarks?.length ? 0 : 12)),
    )
    const engagementState: EngagementState = {
      emotion: engagementValue < 60 ? 'fatigued' : engagementValue < 75 ? 'bored' : 'focused',
      engagement: engagementValue,
      isBored: engagementValue < 75,
      isFatigued: engagementValue < 60,
      sessionSeconds,
    }

    const realtimeState: PracticeRealtimeState = {
      scores: live.scores,
      flags: live.flags,
      frameCount: buffer.progress().current,
      engagement: engagementState,
    }
    onRealtimeUpdate?.(realtimeState)

    if (buffer.isRecording()) {
      frameIndexRef.current += 1
      const frame = toNormalizedFrame(frameIndexRef.current, Date.now(), nextResults, live.scores)
      const full = buffer.append(frame)
      setFrameCount(buffer.progress().current)
      if (full) {
        setStatus('Analyzing sign...')
        setAnalyzing(true)
        const frames = buffer.getFrames()
        window.setTimeout(() => {
          const result = buildPracticeResult(live.scores, frames)
          setAnalyzing(false)
          onAnalysisDone(result)
        }, 1000)
      }
    }
  }

  const startCamera = async () => {
    if (!videoRef.current) return
    try {
      await mediaPipe.start(videoRef.current, onResults)
      sessionStartRef.current = Date.now()
      setCameraStarted(true)
      setStatus('Camera started. Live tracking active.')
    } catch {
      setStatus('Unable to start camera. Please allow permission and retry.')
    }
  }

  const startRecording = () => {
    if (!cameraStarted) {
      setStatus('Please start camera first.')
      return
    }
    frameIndexRef.current = 0
    buffer.start()
    setFrameCount(0)
    setStatus('Recording...')
  }

  const stopPractice = async () => {
    buffer.stop()
    await mediaPipe.stop()
    setCameraStarted(false)
    setStatus('Camera stopped')
  }

  const tryAgain = () => {
    buffer.reset()
    setScores(initialScores)
    setFrameCount(0)
    setStatus(cameraStarted ? 'Ready for next attempt.' : 'Camera is off')
  }

  const flipCamera = async () => {
    const mode = mediaPipe.toggleFacingMode()
    setFacingModeText(mode)
    if (cameraStarted && videoRef.current) {
      await mediaPipe.stop()
      await mediaPipe.start(videoRef.current, onResults)
    }
  }

  const captureFrame = () => {
    setStatus('Frame captured for debug reference.')
  }

  return (
    <Card title="Your Practice">
      <p>Show the sign using your webcam.</p>
      <div className={cls.pillLive}>Live</div>
      <div className={cls.practiceVideoWrap}>
        <video ref={videoRef} autoPlay playsInline muted />
        <div className={cls.overlay}>
          <MediaPipeOverlayCanvas results={results} scoredLandmarks={coloredPoints} width={640} height={480} />
        </div>
      </div>
      <LandmarkMiniPreview results={results} flags={flags} />
      <LandmarkFeedbackLegend />
      <p style={{ marginTop: 8 }}>{status}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
        Camera is used only for live practice feedback. Video is not stored.
      </p>
      <div className={cls.debugPanel}>
        <div>Frames collected: {frameCount}/30</div>
        <div>Pose detected: {String(flags.poseDetected)}</div>
        <div>Left hand detected: {String(flags.leftHandDetected)}</div>
        <div>Right hand detected: {String(flags.rightHandDetected)}</div>
        <div>Camera mode: {facingModeText}</div>
      </div>
      <div className={cls.buttonRow}>
        <Button onClick={startCamera}>Start Camera</Button>
        <Button variant="secondary" onClick={startRecording} disabled={analyzing}>
          Start Recording
        </Button>
        <Button variant="ghost" onClick={stopPractice}>Stop</Button>
        <Button variant="secondary" onClick={tryAgain}>Try Again</Button>
        <Button variant="secondary" onClick={flipCamera}>Flip Camera</Button>
        <Button variant="ghost" onClick={captureFrame}>Capture Frame</Button>
        <Button variant="ghost" onClick={() => setShowDebug((v) => !v)}>
          {showDebug ? 'Hide Debug Grid' : 'Show Landmarks Grid'}
        </Button>
      </div>
      <LiveAccuracyPanel scores={scores} />
    </Card>
  )
}
