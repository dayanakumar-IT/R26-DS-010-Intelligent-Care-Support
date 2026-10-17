import { useState } from 'react'
import { Info, RotateCcw, Video } from 'lucide-react'
import Button from '../../../shared/components/Button'
import SignDemoPanel from './SignDemoPanel'
import WebcamCapture from './WebcamCapture'
import { submitFreeAttempt } from '../services/glossApi'
import { lowHandTip } from '../utils/captureTips'
import type { GlossCaptureRejection, GlossFreeResult } from '../types/gloss'

/**
 * CheckMySign.tsx
 * GLOSS component — "Check my sign": record one sign and the camera names
 * it (POST /gloss/attempts, mode='free'). Same framing guide and hand /
 * movement checks as practice. Stored, but never counted toward Strong in
 * a row, Demonstrated, levels or badges.
 *   >= 0.6      "This looks like WATER" + its demonstration + Practise this sign
 *   0.35 - 0.6  "Maybe WATER or DRINK" (second only from 0.2), each with Show me
 *   below 0.35 or a failed check: "I couldn't match that to the 59 signs I know"
 *               (+ the framing tip when the hands were mostly out of view)
 */

type Result = GlossFreeResult | GlossCaptureRejection
const upper = (s: string) => s.replace(/_/g, ' ').toUpperCase()

interface CheckMySignProps {
  sessionId?: string
  onSession: (id: string) => void
  onPractise: (signId: string) => void
}

export default function CheckMySign({ sessionId, onSession, onPractise }: CheckMySignProps) {
  const [state, setState] = useState<'record' | 'checking' | 'result' | 'error' | 'camera-denied'>('record')
  const [result, setResult] = useState<Result | null>(null)
  const [shown, setShown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const check = async (blob: Blob) => {
    setState('checking')
    try {
      const r = await submitFreeAttempt(blob, sessionId)
      onSession(r.session_id)
      setResult(r)
      setShown(r.outcome === 'free_match' ? r.suggestions[0].sign_id : null)
      setState('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check the sign.')
      setState('error')
    }
  }
  const again = () => {
    setResult(null)
    setShown(null)
    setState('record')
  }

  const tip = result ? lowHandTip(result.capture_check.hand_presence) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-[var(--brand-blue)]">Check my sign</h2>
        <p className="flex items-center gap-2 rounded-[var(--radius-md)] bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <Info size={16} aria-hidden="true" className="shrink-0" />
          Knows 59 care signs only. Not a translator.
        </p>
      </div>

      {state === 'record' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <WebcamCapture onRecorded={check} onCameraError={() => setState('camera-denied')} countdownSeconds={3} maxSeconds={5} />
          <div className="flex flex-col gap-2 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">How it works</p>
            <p>Press Start: after 3, 2, 1 the camera records for up to 5 seconds. Sign one of the care signs you know, then stop.</p>
            <p>This is just a check: it is not saved to your progress.</p>
          </div>
        </div>
      )}

      {state === 'camera-denied' && (
        <p className="rounded-[var(--radius-md)] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Check my sign needs the camera. Allow camera access in your browser and open this tab again.
        </p>
      )}

      {state === 'checking' && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--brand-blue)]" />
          Checking your sign…
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p>{error}</p>
          <Button variant="secondary" onClick={again} className="self-start">Try again</Button>
        </div>
      )}

      {state === 'result' && result && (
        <div className="flex flex-col gap-4">
          {result.outcome === 'free_match' && (
            <p className="text-2xl font-bold text-slate-900">This looks like {upper(result.suggestions[0].sign_id)}</p>
          )}
          {result.outcome === 'free_maybe' && (
            <div className="flex flex-col gap-2">
              <p className="text-2xl font-bold text-slate-900">
                Maybe {result.suggestions.map((s) => upper(s.sign_id)).join(' or ')}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.suggestions.map((s) => (
                  <Button key={s.sign_id} variant={shown === s.sign_id ? 'primary' : 'secondary'} onClick={() => setShown(s.sign_id)}>
                    Show me {s.sign_id.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {(result.outcome === 'free_no_match' || result.outcome === 'capture_rejected') && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-slate-200 bg-slate-50 p-4">
              <p className="text-lg font-semibold text-slate-900">I couldn&apos;t match that to the 59 signs I know</p>
              {tip && <p className="text-sm text-amber-900">{tip}</p>}
              {!tip && result.outcome === 'capture_rejected' && <p className="text-sm text-slate-600">{result.message}</p>}
            </div>
          )}

          {shown && (
            <div className="flex flex-col gap-3">
              <SignDemoPanel key={shown} signId={shown} signDisplayName={shown.replace(/_/g, ' ')} />
              <Button onClick={() => onPractise(shown)} className="self-start">
                <Video size={16} />
                Practise this sign
              </Button>
            </div>
          )}

          <Button variant="secondary" onClick={again} className="self-start">
            <RotateCcw size={16} />
            Check another sign
          </Button>
        </div>
      )}
    </div>
  )
}
