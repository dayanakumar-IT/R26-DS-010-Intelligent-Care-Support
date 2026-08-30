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
      // Use the mimeType actually recorded with (not a hardcoded webm) so the
      // blob's declared type — and the filename/extension glossApi.ts derives
      // from it — matches its real content.
      const blob = new Blob(chunksRef.current, { type: mimeType })
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
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        {isRecording && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-1 text-xs font-medium text-white">
            <Circle size={8} className="fill-current" />
            Recording
          </span>
        )}
      </div>

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
