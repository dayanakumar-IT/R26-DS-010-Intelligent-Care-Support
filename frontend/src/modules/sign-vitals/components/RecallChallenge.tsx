import { useCallback, useEffect, useState } from 'react'
import CheckingSign from './gloss/CheckingSign'
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
          <div className="flex flex-wrap gap-3">
            {sign && <Button onClick={() => setStage('word')}>Try this word again</Button>}
            <Button variant="secondary" onClick={next}>New word</Button>
          </div>
        </div>
      )}

      {(stage === 'word' || stage === 'retake') && sign && (
        // Equal columns: the word box is 4:3 under a header row of the same
        // height as the camera's status row, so both boxes line up top and bottom.
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex min-h-10 items-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-[#4338ca]">Sign this word</span>
            </div>
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-[#c7d2fe] bg-[#eef2ff] p-6 text-center">
              <span className="break-words text-4xl font-bold capitalize text-slate-900">{word}</span>
              <span className="text-base text-slate-600">From memory — press Start Recording when ready.</span>
            </div>
            {stage === 'retake' && (
              <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">
                <CameraOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {message} This try wasn&apos;t counted.
              </p>
            )}
          </div>
          <WebcamCapture key={stage} onRecorded={submit} onCameraError={() => setStage('quiz')} countdownSeconds={3} maxSeconds={5} />
        </div>
      )}

      {stage === 'checking' && (
        <CheckingSign />
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
        // Feedback on the left, the demonstration (at most 460 px wide, like
        // the practice screen's box) on the right.
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
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
