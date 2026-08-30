import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import ParkinsonsIntroCard from '../components/ParkinsonsIntroCard'
import SymptomQuestionCard from '../components/SymptomQuestionCard'
import AnswerFeedbackCard from '../components/AnswerFeedbackCard'
import MasteryProgressCard from '../components/MasteryProgressCard'
import { getNextPdeduQuestion, submitPdeduResponse } from '../services/pdeduApi'
import type { PdeduNextQuestion, PdeduResponseResult } from '../types/pdedu'

type Stage = 'intro' | 'loading' | 'question' | 'submitting' | 'feedback' | 'error'

export default function ParkinsonsEducation() {
  const [stage, setStage] = useState<Stage>('intro')
  const [question, setQuestion] = useState<PdeduNextQuestion | null>(null)
  const [result, setResult] = useState<PdeduResponseResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [questionsAnswered, setQuestionsAnswered] = useState(0)

  const loadNextQuestion = useCallback(async (questionIdHint?: string) => {
    setStage('loading')
    setErrorMessage(null)
    try {
      // The backend already told us the next question id after a response —
      // fetching it fresh here keeps this one code path for both "first
      // question" and "next question" without trusting stale local state.
      void questionIdHint
      const nextQuestion = await getNextPdeduQuestion()
      setQuestion(nextQuestion)
      setResult(null)
      setStage('question')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load a question.')
      setStage('error')
    }
  }, [])

  const handleAnswer = async (selectedSymptomId: string) => {
    if (!question) return
    setStage('submitting')
    setErrorMessage(null)
    try {
      const responseResult = await submitPdeduResponse(question.question_id, selectedSymptomId)
      setResult(responseResult)
      setQuestionsAnswered((count) => count + 1)
      setStage('feedback')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not submit your answer.')
      setStage('error')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/sign-vitals"
        className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft size={16} />
        Back to Sign & Vitals
      </Link>

      {questionsAnswered > 0 && (
        <p className="text-xs text-slate-400">Questions answered this session: {questionsAnswered}</p>
      )}

      {stage === 'intro' && <ParkinsonsIntroCard onStart={() => loadNextQuestion()} />}

      {(stage === 'loading' || stage === 'submitting') && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          {stage === 'loading' ? 'Loading your next question…' : 'Checking your answer…'}
        </div>
      )}

      {stage === 'error' && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => loadNextQuestion()}
            className="self-start text-sm font-medium underline"
          >
            Try again
          </button>
        </div>
      )}

      {stage === 'question' && question && (
        <SymptomQuestionCard question={question} onAnswer={handleAnswer} disabled={false} />
      )}

      {stage === 'feedback' && result && question && (
        <div className="flex flex-col gap-4">
          <AnswerFeedbackCard
            result={result}
            correctSymptomDisplayName={question.symptom_display_name}
            onContinue={() => loadNextQuestion(result.next_question_id)}
          />
          <MasteryProgressCard mastery={result.mastery} symptomDisplayName={question.symptom_display_name} />
        </div>
      )}
    </div>
  )
}
