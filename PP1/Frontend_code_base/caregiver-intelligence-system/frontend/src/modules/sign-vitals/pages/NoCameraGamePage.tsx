import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GameQuiz } from '../components/caresense/GameQuiz'
import { useSignVitalsStore } from '../store/signVitalsStore'

const ROUNDS = [
  {
    correctId: 'help',
    tutorWord: 'HELP',
    options: [
      { id: 'thanks', label: 'Thank You' },
      { id: 'help', label: 'Help' },
      { id: 'eat', label: 'Eat' },
      { id: 'drink', label: 'Drink' },
    ],
  },
  {
    correctId: 'eat',
    tutorWord: 'EAT',
    options: [
      { id: 'help', label: 'Help' },
      { id: 'eat', label: 'Eat' },
      { id: 'thanks', label: 'Thank You' },
      { id: 'drink', label: 'Drink' },
    ],
  },
]

export function NoCameraGamePage() {
  const navigate = useNavigate()
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [tutorReplay, setTutorReplay] = useState(0)

  const rewardPoints = useSignVitalsStore((s) => s.rewardPoints)
  const completeGameQuestion = useSignVitalsStore((s) => s.completeGameQuestion)

  const cfg = ROUNDS[Math.min(round, ROUNDS.length - 1)]!

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/sign-vitals" className="text-sm font-semibold text-violet-700 underline-offset-4 hover:underline">
          ← Back to dashboard
        </Link>
        <button
          type="button"
          className="text-xs font-semibold uppercase tracking-wide text-violet-500 hover:text-violet-700"
          onClick={() => navigate('/sign-vitals/sign-live', { state: { useCamera: true } })}
        >
          Switch to live camera tutoring
        </button>
      </div>

      <GameQuiz
        key={round}
        questionIndex={round + 1}
        totalQuestions={ROUNDS.length}
        score={score}
        streak={streak}
        rewardPoints={rewardPoints}
        correctId={cfg.correctId}
        options={cfg.options}
        tutorWord={cfg.tutorWord}
        tutorReplayKey={tutorReplay}
        onReplaySign={() => setTutorReplay((r) => r + 1)}
        onAnswer={(correct) => {
          completeGameQuestion(correct)
          setScore((s) => s + (correct ? 160 : 0))
          setStreak((st) => (correct ? st + 1 : 0))
        }}
        onAdvance={() => {
          if (round < ROUNDS.length - 1) {
            setRound((r) => r + 1)
          } else {
            navigate('/sign-vitals/rewards')
          }
        }}
      />
    </div>
  )
}
