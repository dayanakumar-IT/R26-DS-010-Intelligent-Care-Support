import { Camera } from 'lucide-react'
import Button from '../../../shared/components/Button'

interface CameraPermissionPromptProps {
  signLabel: string
  // Fires when the caregiver chooses to use their camera. The parent
  // then mounts WebcamCapture, which is what actually calls
  // navigator.mediaDevices.getUserMedia — this component never does.
  onAllowCamera: () => void
  // Fires when the caregiver chooses the quiz. No camera access is
  // requested at all in this path.
  onUseQuiz: () => void
}

// Task 3 — visual redesign only. The choice screen shown after
// "Practice This Sign" and BEFORE the browser's getUserMedia dialog.
// Permission behaviour is unchanged: the buttons only call the parent
// callbacks; getUserMedia still happens later, inside WebcamCapture.
export default function CameraPermissionPrompt({
  signLabel,
  onAllowCamera,
  onUseQuiz,
}: CameraPermissionPromptProps) {
  return (
    <div className="flex justify-center py-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-[var(--radius-lg)] border border-slate-200 bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-md)]">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[var(--brand-blue)]">
          <Camera size={28} />
        </span>

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            This lesson works best with your camera. Would you like to turn it on?
          </h2>
          <p className="text-sm leading-relaxed text-slate-500">
            Your camera recording is used to analyse your sign attempt.
          </p>
        </div>

        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Practising <span className="capitalize text-slate-500">{signLabel}</span>
        </p>

        <div className="flex w-full flex-col gap-2.5">
          <Button onClick={onAllowCamera} className="w-full">
            <Camera size={16} />
            Allow Camera
          </Button>
          <Button variant="secondary" onClick={onUseQuiz} className="w-full">
            Use Quiz Instead
          </Button>
        </div>

        <p className="text-xs text-slate-400">You can switch to quiz mode at any time.</p>
      </div>
    </div>
  )
}