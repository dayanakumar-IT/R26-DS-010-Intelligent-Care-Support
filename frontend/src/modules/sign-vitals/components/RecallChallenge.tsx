import { useCallback, useEffect, useState } from 'react'
import { Brain, CameraOff } from 'lucide-react'
import Button from '../../../shared/components/Button'
import AttemptFeedbackCard from './AttemptFeedbackCard'
import McqFallbackCard from './McqFallbackCard'
import SignDemoPanel from './SignDemoPanel'
import WebcamCapture from './WebcamCapture'
import { getRecallSign, submitMultipleChoiceAttempt, submitWebcamAttempt } from '../services/glossApi'
import { lowHandTip } from '../utils/captureTips'
import type { GlossAttemptResult, GlossSign } from '../types/gloss'

/**
 * RecallChallenge.tsx
 * GLOSS component — "Recall": only the word is shown (no avatar, no
 * video); the learner signs it from memory. Graded exactly like practice
 * and stored with mode='recall' (a strong recall 7+ days after
 * Demonstrated makes a sign Retained). After the result the demonstration
 * appears for comparison. Words come from signs already practised, never
 * the not-recommended ones (GET /gloss/recall/next). Without a camera the
 * existing multiple-choice quiz is used, unchanged.
 */

type Stage = 'loading' | 'none' | 'word' | 'checking' | 'retake' | 'result' | 'quiz' | 'error'

interface RecallChallengeProps {
  allSigns: GlossSign[]
  sessionId?: string
  onSession: (id: string) => void
  onAttempt: (result: GlossAttemptResult) => void
  onPractise: (signId: string) => void
}

export default function RecallChallenge({ allSigns, sessionId, onSession, onAttempt, onPractise }: RecallChallengeProps) {
  const [stage, setStage] = useState<Stage>('loading')
  const [sign, setSign] = useState<string | null>(null)
  const [result, setResult] = useState<GlossAttemptResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const next = useCallback(() => {
    setStage('loading')
    setResult(null)
    getRecallSign()
      .then((r) => {
        setSign(r.sign_id)
        setStage('word')
      })
      .catch((e: unknown) => {
        const text = e instanceof Error ? e.message : ''
        setMessage(text)
        setStage(/practised|practise a few/i.test(text) ? 'none' : 'error')
      })
  }, [])

  useEffect(() => {
    // Initial word on opening the tab (async fetch; not derived state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    next()
  }, [next])

  const submit = async (blob: Blob) => {
    if (!sign) return
    setStage('checking')
    try {
      const r = await submitWebcamAttempt(sign, blob, sessionId, 'recall')
      onSession(r.session_id)
      if (r.outcome === 'capture_rejected') {
        setMessage(lowHandTip(r.capture_check.hand_presence) ?? r.message)
        setStage('retake')
        return
      }
      setResult(r)
      onAttempt(r)
      setStage('result')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not submit your attempt.')
      setStage('error')
    }
  }

  const answerQuiz = async (selected: string) => {
    if (!sign) return
    setStage('checking')
    try {
      const r = await submitMultipleChoiceAttempt(sign, selected, sessionId)
      onSession(r.session_id)
      setResult(r)
      onAttempt(r)
      setStage('result')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not submit your answer.')
      setStage('error')
    }
  }

  const word = sign ? sign.replace(/_/g, ' ') : ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-[var(--brand-blue)]">
          <Brain size={22} aria-hidden="true" /> Recall challenge
        </h2>
        <p className="text-sm text-slate-600">See the word, sign it from memory. Graded like practice.</p>
      </div>

      {stage === 'loading' && <p className="text-sm text-slate-500">Choosing a word…</p>}
      {stage === 'none' && (
        <p className="rounded-[var(--radius-md)] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {message || 'Practise a few signs first; the Recall challenge uses signs you have practised.'}
        </p>
      )}
      {stage === 'error' && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p>{message}</p>
          <Button variant="secondary" onClick={next} className="self-start">Try again</Button>
        </div>
      )}

      {(stage === 'word' || stage === 'retake') && sign && (
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1fr]">
          <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[#c7d2fe] bg-[#eef2ff] p-8 text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-[#4338ca]">Sign this word</span>
            <span className="text-5xl font-bold capitalize text-slate-900">{word}</span>
            {stage === 'retake' && (
              <p className="mt-2 flex items-start gap-2 text-left text-sm text-amber-900">
                <CameraOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {message} This try wasn&apos;t counted.
              </p>
            )}
          </div>
          <WebcamCapture key={stage} onRecorded={submit} onCameraError={() => setStage('quiz')} countdownSeconds={3} maxSeconds={5} />
        </div>
      )}

      {stage === 'checking' && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--brand-blue)]" />
          Analysing your attempt…
        </div>
      )}

      {stage === 'quiz' && sign && (
        <div className="flex flex-col gap-3">
          <p className="rounded-[var(--radius-md)] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            We couldn&apos;t access your camera, so here is the usual quiz for &ldquo;{word}&rdquo;.
          </p>
          <McqFallbackCard targetSignId={sign} allSigns={allSigns} onSelect={answerQuiz} disabled={false} />
        </div>
      )}

      {stage === 'result' && result && sign && (
        <div className="flex flex-col gap-4">
          <AttemptFeedbackCard result={result} targetSignId={sign} onPracticeAgain={() => onPractise(sign)} onNextSign={next} nextLabel="Next word" />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">Compare with the demonstration of &ldquo;{word}&rdquo;</span>
            <SignDemoPanel key={sign} signId={sign} signDisplayName={word} />
          </div>
        </div>
      )}
    </div>
  )
}
