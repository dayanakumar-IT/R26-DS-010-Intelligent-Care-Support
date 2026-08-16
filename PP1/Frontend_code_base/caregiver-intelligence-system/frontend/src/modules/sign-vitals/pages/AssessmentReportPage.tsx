import { Link } from 'react-router-dom'
import { downloadCareSensePerformanceReport } from '../../../utils/reportGenerator'
import { AssessmentDashboard } from '../components/caresense/AssessmentDashboard'
import { useSignVitalsStore } from '../store/signVitalsStore'

export function AssessmentReportPage() {
  const competencyScore = useSignVitalsStore((s) => s.competencyScore)
  const lastRec = useSignVitalsStore((s) => s.lastRecommendedLesson)
  const difficulty = useSignVitalsStore((s) => s.difficulty)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/sign-vitals" className="text-sm font-semibold text-violet-700 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Assessment Report</h1>
        <p className="mt-2 text-slate-600">Caregiver competency snapshot with tutoring analytics (demo data).</p>
      </div>
      <AssessmentDashboard
        competencyScore={competencyScore}
        recommendedLesson={lastRec}
        difficulty={difficulty}
        onDownloadReport={() => downloadCareSensePerformanceReport()}
      />
    </div>
  )
}
