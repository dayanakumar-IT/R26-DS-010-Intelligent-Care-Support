import { Link, useNavigate } from 'react-router-dom'
import { RewardsPanel } from '../components/caresense/RewardsPanel'
import { useSignVitalsStore } from '../store/signVitalsStore'

export function RewardsPage() {
  const navigate = useNavigate()
  const rewardPoints = useSignVitalsStore((s) => s.rewardPoints)
  const achievements = useSignVitalsStore((s) => s.achievements)

  return (
    <div className="space-y-6">
      <Link to="/sign-vitals" className="text-sm font-semibold text-violet-700 hover:underline">
        ← Back to dashboard
      </Link>
      <RewardsPanel
        points={rewardPoints}
        unlocked={achievements as Record<string, boolean>}
        onContinue={() => navigate('/sign-vitals/sign-live')}
      />
    </div>
  )
}
