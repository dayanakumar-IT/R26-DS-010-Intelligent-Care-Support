import {
  Activity,
  ArrowLeft,
  Calendar,
  ClipboardList,
  Clock,
  Heart,
  Mic,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BaselineTrajectoryChart } from '../components/BaselineTrajectoryChart'
import { ModalityBreakdown } from '../components/ModalityBreakdown'
import { RiskBadge } from '../components/RiskBadge'
import { ShapExplanationChart } from '../components/ShapExplanationChart'
import { StatCard } from '../components/StatCard'
import { VoiceLogHistory } from '../components/VoiceLogHistory'
import { CAREGIVERS } from '../data/caregiverData'
import {
  buildBaselineSeries,
  getModalitySlices,
  getPhysiologicalShapBundle,
  getVoiceLogs,
} from '../data/caregiverDetailData'
import { getRiskColor } from '../data/caregiverData'

type StoredUser = { role?: string; ward?: string | null }

export function CaregiverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const caregiver = CAREGIVERS.find((c) => c.id === id)

  const user = useMemo((): StoredUser | null => {
    const raw = localStorage.getItem('caresense_user')
    if (!raw) return null
    try {
      return JSON.parse(raw) as StoredUser
    } catch {
      return null
    }
  }, [])

  const isAdmin = user?.role === 'admin'
  const wardRestricted =
    !!user?.ward &&
    user?.role === 'supervisor' &&
    !!caregiver &&
    caregiver.ward !== user.ward

  const baselineData = caregiver ? buildBaselineSeries(caregiver) : []
  const shapBundle = caregiver ? getPhysiologicalShapBundle(caregiver) : null
  const modalitySlices = caregiver ? getModalitySlices(caregiver) : []
  const voiceLogs = caregiver ? getVoiceLogs(caregiver) : []

  if (!caregiver) {
    return (
      <div className="py-20 text-center text-gray-400">
        <p>Caregiver not found.</p>
        <button
          type="button"
          onClick={() => navigate('/deterioration')}
          className="mt-4 text-sm text-[#2563EB] hover:underline"
        >
          Back to Deterioration Detection
        </button>
      </div>
    )
  }

  if (wardRestricted) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-gray-600">You do not have access to caregivers outside your assigned ward.</p>
        <button
          type="button"
          onClick={() => navigate('/deterioration')}
          className="text-sm text-[#2563EB] hover:underline"
        >
          Return to team overview
        </button>
      </div>
    )
  }

  const trendDisplay =
    caregiver.trend === 'rising' ? (
      <span className="flex items-center gap-1 text-xs" style={{ color: '#DC2626' }}>
        <TrendingUp size={14} aria-hidden />
        Rising trajectory
      </span>
    ) : caregiver.trend === 'stable' ? (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <Minus size={14} aria-hidden />
        Stable trajectory
      </span>
    ) : (
      <span className="flex items-center gap-1 text-xs" style={{ color: '#16A34A' }}>
        <TrendingDown size={14} aria-hidden />
        Improving trajectory
      </span>
    )

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/deterioration')}
        className="flex items-center gap-2 text-sm text-[#2563EB] hover:underline"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to Deterioration Detection
      </button>

      <div
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        style={{ borderLeftWidth: 5, borderLeftColor: getRiskColor(caregiver.riskLevel) }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-[#1F2937]">{caregiver.name}</h1>
              <RiskBadge level={caregiver.riskLevel} size="sm" />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {caregiver.ward} · {caregiver.role} · {caregiver.shift}
            </p>
            <p className="mt-3 text-xs text-gray-400">
              Dataset provenance · <span className="font-medium text-gray-600">{caregiver.dataSource}</span>
              {!isAdmin ? (
                <>
                  {' '}
                  · <span className="text-gray-400">Showing ward-scoped view</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold" style={{ color: getRiskColor(caregiver.riskLevel) }}>
                {caregiver.riskScore}
              </span>
              <span className="text-lg text-gray-400">/100</span>
            </div>
            {trendDisplay}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Hosseini Nurse Dataset
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Personal baseline"
          value={caregiver.baselineScore}
          subtitle="14-day reference index"
          icon={<Activity size={18} />}
          iconColor="#1E3A8A"
        />
        <StatCard
          title="Δ vs. baseline"
          value={`${caregiver.deviationFromBaseline > 0 ? '+' : ''}${caregiver.deviationFromBaseline}`}
          subtitle="points from personal mean"
          icon={
            caregiver.deviationFromBaseline > 0 ? (
              <TrendingUp size={18} />
            ) : caregiver.deviationFromBaseline < 0 ? (
              <TrendingDown size={18} />
            ) : (
              <Minus size={18} />
            )
          }
          iconColor={
            caregiver.deviationFromBaseline > 0
              ? '#DC2626'
              : caregiver.deviationFromBaseline < 0
                ? '#16A34A'
                : '#64748B'
          }
          accentColor={
            caregiver.deviationFromBaseline > 0
              ? '#DC2626'
              : caregiver.deviationFromBaseline < 0
                ? '#16A34A'
                : undefined
          }
        />
        <StatCard
          title="Wearable HRV"
          value={`${caregiver.wearableHRV} ms`}
          subtitle="latest window"
          icon={<Heart size={18} />}
          iconColor="#DC2626"
        />
        <StatCard
          title="Voice stress model"
          value={`${(caregiver.voiceStressProbability * 100).toFixed(0)}%`}
          subtitle="acoustic classifier"
          icon={<Mic size={18} />}
          iconColor="#7C3AED"
          showProgress
          progressValue={Math.round(caregiver.voiceStressProbability * 100)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Survey load"
          value={`${caregiver.surveyScore}/100`}
          subtitle="weekly instrument"
          icon={<ClipboardList size={18} />}
          iconColor="#2563EB"
        />
        <StatCard
          title="Shifts this week"
          value={caregiver.shiftsThisWeek}
          subtitle="recorded schedule density"
          icon={<Calendar size={18} />}
          iconColor="#14B8A6"
        />
        <StatCard
          title="High-risk streak"
          value={caregiver.consecutiveHighRiskShifts}
          subtitle="consecutive elevated shifts"
          icon={<Activity size={18} />}
          iconColor="#EA580C"
          accentColor={caregiver.consecutiveHighRiskShifts >= 3 ? '#DC2626' : undefined}
          pulse={caregiver.consecutiveHighRiskShifts >= 3}
        />
        <StatCard
          title="Last check-in"
          value={caregiver.lastCheckIn}
          subtitle="self-reported touchpoint"
          icon={<Clock size={18} />}
          iconColor="#64748B"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <BaselineTrajectoryChart data={baselineData} subjectLabel={caregiver.dataSource} />
          <ShapExplanationChart
            contributions={shapBundle?.contributions ?? []}
            nurseId={shapBundle?.nurseId ?? ''}
            nWindows={shapBundle?.nWindows ?? 0}
          />
        </div>
        <div className="space-y-6 lg:col-span-1">
          <ModalityBreakdown slices={modalitySlices} />
          <VoiceLogHistory entries={voiceLogs} />
        </div>
      </div>

      <p className="text-xs italic text-gray-400">
        Interpretations are for research demonstration only. SHAP values are computed with a surrogate
        explainer on the prototype XGBoost risk model; voice excerpts are synthetic stand-ins for
        de-identified transcripts. Not for clinical decision-making.
      </p>
    </div>
  )
}
