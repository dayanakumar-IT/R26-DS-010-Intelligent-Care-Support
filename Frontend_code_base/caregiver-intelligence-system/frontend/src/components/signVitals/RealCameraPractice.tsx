import type { ReactNode } from 'react'
import { useCallback, useRef, useState, type RefObject } from 'react'

type RealCameraPracticeProps = {
  /** Same ref used by MediaPipe trackers. */
  videoRef: RefObject<HTMLVideoElement | null>
  /** When true, preview is mirrored like a practice mirror. */
  mirrored?: boolean
  className?: string
  /** Rendered above the video (e.g. MediaPipe canvas overlay). */
  overlay?: ReactNode
}

export function RealCameraPractice({ videoRef, mirrored = true, className, overlay }: RealCameraPracticeProps) {
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setActive(false)
  }, [videoRef])

  const startCamera = useCallback(async () => {
    setDenied(false)
    setError(null)
    stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
    } catch (e) {
      const err = e as DOMException
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setDenied(true)
      } else {
        setError(err.message || 'Could not access the webcam.')
      }
      setActive(false)
    }
  }, [stopCamera, videoRef])

  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner">
        <video
          ref={videoRef}
          className={`relative z-0 h-full w-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
          playsInline
          muted
          autoPlay
          aria-label="Live webcam preview for sign practice"
        />
        {overlay ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex h-full w-full items-stretch">{overlay}</div>
        ) : null}
        {!active && !denied ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 px-4 text-center text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Camera not started</span>
            <span>Press “Start camera” to enable live tutoring feedback.</span>
          </div>
        ) : null}
        {denied ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-rose-50/95 px-4 text-center text-sm text-rose-900">
            <span className="font-semibold">Camera permission is required for real-time sign feedback.</span>
            <span>Allow camera access in your browser settings and try again.</span>
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 px-4 text-center text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void startCamera()}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
        >
          Start camera
        </button>
        <button
          type="button"
          onClick={stopCamera}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Stop camera
        </button>
      </div>
    </div>
  )
}
