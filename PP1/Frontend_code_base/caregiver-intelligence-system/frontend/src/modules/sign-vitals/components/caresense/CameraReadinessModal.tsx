import { Button } from '../../../../shared/components/Button'

type CameraReadinessModalProps = {
  open: boolean
  onClose: () => void
  onNo: () => void
  onYes: () => void
}

export function CameraReadinessModal({ open, onClose, onNo, onYes }: CameraReadinessModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-readiness-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-white/60 bg-gradient-to-b from-white to-violet-50/90 p-8 shadow-[0_24px_80px_rgba(79,70,229,0.2)]">
        <button
          type="button"
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-white/80 hover:text-slate-600"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl shadow-inner">
          📷
        </div>
        <h2 id="camera-readiness-title" className="text-center text-xl font-bold text-slate-900">
          Ready for camera practice?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-slate-600">
          Are you in a well-lit, quiet place where you can comfortably switch on your camera?
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="secondary" fullWidth className="sm:w-auto" onClick={onNo}>
            No, Not Now
          </Button>
          <Button fullWidth className="sm:w-auto" onClick={onYes}>
            Yes, I&apos;m Ready
          </Button>
        </div>
      </div>
    </div>
  )
}
