import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { PkAnswerResult, PkQuizStart, PkQuizSummary } from '../../types/parkinsons'
import { answerParkinsonsQuestion, completeParkinsonsQuiz } from '../../services/parkinsonsApi'
import ParkinsonsQuizHeader from './ParkinsonsQuizHeader'
import ParkinsonsQuizCard from './ParkinsonsQuizCard'
import ParkinsonsAnswerFeedback from './ParkinsonsAnswerFeedback'

interface ParkinsonsQuizProps {
  start: PkQuizStart
  onComplete: (summary: PkQuizSummary) => void
  onExit: () => void
}

export default function ParkinsonsQuiz({ start, onComplete, onExit }: ParkinsonsQuizProps) {
  const { session_id: sessionId, questions } = start

  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<PkAnswerResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Running totals — seeded from the last answer's server-computed values.
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [xp, setXp] = useState(0)
  const [streak, setStreak] = useState(0)

  const question = questions[index]
  const isLast = index === questions.length - 1

  const submit = async () => {
    if (!selected || !question) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await answerParkinsonsQuestion(sessionId, question.question_id, selected)
      setResult(res)
      setScore(res.correct_answers)
      setAnswered(res.answered)
      setXp(res.xp_earned)
      setStreak(res.current_streak)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your answer.')
    } finally {
      setSubmitting(false)
    }
  }

  const next = async () => {
    if (isLast) {
      setFinishing(true)
      setError(null)
      try {
        const summary = await completeParkinsonsQuiz(sessionId)
        onComplete(summary)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not finish the quiz.')
        setFinishing(false)
      }
      return
    }
    setIndex((i) => i + 1)
    setSelected(null)
    setResult(null)
  }

  if (!question) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-8 text-sm text-slate-500">
        This quiz has no questions available yet.
        <button type="button" onClick={onExit} className="ml-2 font-medium text-violet-600 underline">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onExit}
        className="flex w-fit items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <ChevronLeft size={16} />
        End quiz
      </button>

      <ParkinsonsQuizHeader
        questionNumber={index + 1}
        totalQuestions={questions.length}
        score={score}
        answered={answered}
        xp={xp}
        streak={streak}
      />

      <ParkinsonsQuizCard
        question={question}
        selected={selected}
        onSelect={(id) => !result && setSelected(id)}
        submitted={result !== null}
        correctSymptomId={result?.correct_symptom_id ?? null}
        submitting={submitting}
        onSubmit={() => void submit()}
      />

      {result && (
        <ParkinsonsAnswerFeedback
          result={result}
          isLastQuestion={isLast}
          onNext={() => void next()}
        />
      )}

      {finishing && <p className="text-sm text-slate-500">Preparing your results…</p>}
      {error && (
        <p className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}
