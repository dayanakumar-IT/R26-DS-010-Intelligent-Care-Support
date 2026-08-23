import { Link, useNavigate } from 'react-router-dom'
import { ReviewTimeline } from '../components/caresense/ReviewTimeline'
import type { TimelineMarker } from '../components/caresense/ReviewTimeline'

const MARKERS: TimelineMarker[] = [
  { id: 'shape', label: 'Hand shape', offsetPct: 12, status: 'good' },
  { id: 'move', label: 'Movement', offsetPct: 38, status: 'warn' },
  { id: 'pos', label: 'Position', offsetPct: 62, status: 'bad' },
  { id: 'hold', label: 'Hold time', offsetPct: 86, status: 'warn' },
]

export function SignReviewPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      <div>
        <Link to="/sign-vitals/sign-live" className="text-sm font-semibold text-violet-700 hover:underline">
          ← Back to live lesson
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Sign review &amp; explainable timeline</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Side-by-side playback with tutoring markers — highlights are for learning feedback only.
        </p>
      </div>

      <ReviewTimeline
        attemptLabel="Your attempt"
        referenceLabel="Reference avatar"
        markers={MARKERS}
        feedback={[
          'Move your hand slightly higher.',
          'Hold the final position longer.',
          'Movement path is good.',
        ]}
        onTryAgain={() => navigate('/sign-vitals/sign-live')}
        onNext={() => navigate('/sign-vitals/sign-live')}
      />
    </div>
  )
}
