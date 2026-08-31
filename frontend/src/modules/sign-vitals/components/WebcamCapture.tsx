import { useEffect, useRef, useState } from 'react'
import { Circle, Square } from 'lucide-react'
import Button from '../../../shared/components/Button'

interface WebcamCaptureProps {
  onRecorded: (blob: Blob) => void
  onCameraError: () => void
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

// Manual Start/Stop recording only, per the first frontend version's scope —
// automatic attempt detection may be added later.
export default function WebcamCapture({ onRecorded, onCameraError }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [hasRecording, setHasRecording] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
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
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setIsRecording(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-md)] bg-slate-900">
        {/* Preview is mirrored for a natural selfie view only. The
            recorded stream is the raw camera track and is NOT mirrored —
            the backend receives the true (un-flipped) video, so
            left/right handedness reaches recognition correctly. */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        {isRecording && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-1 text-xs font-medium text-white">
            <Circle size={8} className="fill-current" />
            Recording
          </span>
        )}
      </div>
      <p className="text-center text-xs text-slate-400">
        Keep your whole upper body and both hands in frame, with even lighting. Preview is mirrored;
        your recording is not.
      </p>

      <div className="flex justify-center gap-3">
        {!isRecording ? (
          <Button onClick={startRecording} disabled={!cameraReady} variant="primary">
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
