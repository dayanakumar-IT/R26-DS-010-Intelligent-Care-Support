import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { PkQuizStart, PkQuizSummary } from '../types/parkinsons'
import { startParkinsonsQuiz } from '../services/parkinsonsApi'
import ParkinsonsTrainerHome from '../components/parkinsons/ParkinsonsTrainerHome'
import ParkinsonsQuiz from '../components/parkinsons/ParkinsonsQuiz'
import ParkinsonsQuizSummary from '../components/parkinsons/ParkinsonsQuizSummary'
import ParkinsonsReviewMistakes from '../components/parkinsons/ParkinsonsReviewMistakes'
import ParkinsonsSymptomExplorer from '../components/parkinsons/ParkinsonsSymptomExplorer'
import ParkinsonsProgress from '../components/parkinsons/ParkinsonsProgress'

type View = 'home' | 'quiz' | 'summary' | 'review' | 'explore' | 'progress'

// Parkinson's Symptom Trainer — a gamified caregiver tutoring flow.
// EDUCATION ONLY: symptom-recognition training, not a diagnostic tool.
// This page is Parkinson's-specific and shares nothing with the GLOSS
// sign-language feature beyond the sign-vitals API client and auth.
export default function ParkinsonsEducation() {
  const [view, setView] = useState<View>('home')
  const [quizStart, setQuizStart] = useState<PkQuizStart | null>(null)
  const [summary, setSummary] = useState<PkQuizSummary | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const beginQuiz = async () => {
    setStarting(true)
    setStartError(null)
    try {
      const start = await startParkinsonsQuiz()
      if (!start.questions.length) {
        setStartError('No quiz questions are available yet. Please try again later.')
        return
      }
      setQuizStart(start)
      setSummary(null)
      setView('quiz')
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Could not start the quiz.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/sign-vitals"
        className="flex w-fit items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <ChevronLeft size={16} />
        Back to Sign & Vitals
      </Link>

      {view === 'home' && (
        <ParkinsonsTrainerHome
          starting={starting}
          startError={startError}
          onStartQuiz={() => void beginQuiz()}
          onExplore={() => setView('explore')}
          onOpenProgress={() => setView('progress')}
        />
      )}

      {view === 'quiz' && quizStart && (
        <ParkinsonsQuiz
          start={quizStart}
          onComplete={(result) => {
            setSummary(result)
            setView('summary')
          }}
          onExit={() => setView('home')}
        />
      )}

      {view === 'summary' && summary && (
        <ParkinsonsQuizSummary
          summary={summary}
          onReviewMistakes={() => setView('review')}
          onRetry={() => void beginQuiz()}
          onExplore={() => setView('explore')}
        />
      )}

      {view === 'review' && summary && (
        <ParkinsonsReviewMistakes review={summary.review} onBack={() => setView('summary')} />
      )}

      {view === 'explore' && (
        <ParkinsonsSymptomExplorer onBack={() => setView(summary ? 'summary' : 'home')} />
      )}

      {view === 'progress' && (
        <ParkinsonsProgress onBack={() => setView('home')} onStartQuiz={() => void beginQuiz()} />
      )}
    </div>
  )
}
