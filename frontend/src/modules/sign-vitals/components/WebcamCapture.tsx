import { useEffect, useRef, useState } from 'react'
import { Circle, Square } from 'lucide-react'
import Button from '../../../shared/components/Button'

interface WebcamCaptureProps {
  onRecorded: (blob: Blob) => void
  onCameraError: () => void
  /** Check my sign / Recall: count down this many seconds before recording starts. */
  countdownSeconds?: number
  /** Stop automatically after this many seconds (the learner can still stop earlier). */
  maxSeconds?: number
}

// Investigated (Task 2, see report): a synthetic VP8/VP9-in-webm sample
// built from a known-good test clip processed through the real recognition
// endpoint identically to the original .mp4 (same predicted sign, confidence
// within ~1pp) — so webm itself was NOT found to be the cause of reported
// misrecognitions. This preference list is a reasonable hardening anyway:
// prefer mp4 where the browser actually supports recording it (some Chrome
// versions do), otherwise fall back through webm codec variants, since all
// of this project's prior testing used .mp4 files specifically.
function pickSupportedMimeType(): string {
  const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(candidate)) {
      return candidate
    }
  }
  return 'video/webm' // last-resort default; browsers without isTypeSupported are effectively all webm-capable
}

// Start/Stop recording. Practice uses it as is; Check my sign and Recall add a
// countdown before recording and an automatic stop (countdownSeconds / maxSeconds).
export default function WebcamCapture({ onRecorded, onCameraError, countdownSeconds = 0, maxSeconds }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [hasRecording, setHasRecording] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const timersRef = useRef<number[]>([])
  useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), [])

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      // 640x480 at 30 fps: the reference videos' size and rate. 'ideal' so a
      // camera that can't do it still works (some slow down in poor light).
      .getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setCameraReady(true)
      })
      .catch(() => {
        onCameraError()
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
    // onCameraError is a stable callback from the parent's useCallback — intentionally not re-running this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = pickSupportedMimeType()
    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      // Use recorder.mimeType (the UA's ACTUAL negotiated type, e.g.
      // "video/mp4;codecs=vp9") rather than the bare `mimeType` we
      // requested — the browser can and does choose a specific codec
      // even when asked for the bare container type, and the blob's
      // declared type should reflect what was really recorded.
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType })
      onRecorded(blob)
      setHasRecording(true)
    }
    recorder.start()
    recorderRef.current = recorder
    setIsRecording(true)
    setHasRecording(false)
    if (maxSeconds) timersRef.current.push(window.setTimeout(stopRecording, maxSeconds * 1000))
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    setIsRecording(false)
  }

  // 3, 2, 1 … then record.
  const beginWithCountdown = () => {
    if (!countdownSeconds) return startRecording()
    setHasRecording(false)
    for (let i = 0; i <= countdownSeconds; i++) {
      timersRef.current.push(
        window.setTimeout(() => {
          const left = countdownSeconds - i
          setCountdown(left > 0 ? left : null)
          if (left === 0) startRecording()
        }, i * 1000),
      )
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 4:3 and object-contain: the preview shows exactly what is recorded. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-md)] bg-slate-900">
        {/* Preview is mirrored for a natural selfie view only. The
            recorded stream is the raw camera track and is NOT mirrored —
            the backend receives the true (un-flipped) video, so
            left/right handedness reaches recognition correctly. */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-contain"
          style={{ transform: 'scaleX(-1)' }}
        />
        {/* Framing guide (preview only, never recorded): head in the oval,
            hands inside the box from the chest down to the waist. */}
        <svg
          viewBox="0 0 640 480"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <ellipse cx="320" cy="120" rx="62" ry="80" fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="3" strokeDasharray="10 8" />
          <rect x="110" y="215" width="420" height="255" rx="24" fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="3" strokeDasharray="10 8" />
        </svg>
        <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white">
          Head in the oval, hands inside the box
        </span>
        {countdown !== null && (
          <span
            aria-live="assertive"
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
          >
            {countdown}
          </span>
        )}
        {isRecording && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-1 text-xs font-medium text-white">
            <Circle size={8} className="fill-current" />
            Recording
          </span>
        )}
      </div>
      <p className="text-center text-xs text-slate-400">
        Sit back so your head and your hands down to your waist fit the guide, and face the light
        (a bright window behind you makes the camera slow and blurry). Preview is mirrored; your
        recording is not.
      </p>

      <div className="flex justify-center gap-3">
        {!isRecording ? (
          <Button onClick={beginWithCountdown} disabled={!cameraReady || countdown !== null} variant="primary">
            <Circle size={16} />
            {hasRecording ? 'Record Again' : 'Start Recording'}
          </Button>
        ) : (
          <Button onClick={stopRecording} variant="danger">
            <Square size={16} />
            Stop Recording
          </Button>
        )}
      </div>
    </div>
  )
}
