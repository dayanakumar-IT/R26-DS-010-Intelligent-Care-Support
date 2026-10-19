import { ShieldAlert } from 'lucide-react'
import Button from '../../../shared/components/Button'

interface ParkinsonsIntroCardProps {
  onStart: () => void
}

export default function ParkinsonsIntroCard({ onStart }: ParkinsonsIntroCardProps) {
  return (
    <div className="flex flex-col items-start gap-5 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-8 shadow-[var(--shadow-sm)]">
      <h1 className="text-xl font-semibold text-slate-900">Parkinson's Symptom Education</h1>
      <p className="max-w-xl text-sm leading-relaxed text-slate-600">
        Learn to recognise common Parkinson's movement symptoms through short scenarios and
        adaptive quizzes.
      </p>

      <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>
          This learning activity supports symptom awareness and does not provide a medical
          diagnosis.
        </span>
      </div>

      <Button onClick={onStart}>Start Learning</Button>
    </div>
  )
}
