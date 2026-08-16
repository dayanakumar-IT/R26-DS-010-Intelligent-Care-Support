import {
  AlertTriangle,
  ClipboardList,
  Clock,
  Heart,
  Mic,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { CaregiverProfile } from '../types/deterioration.types'
import { getRiskColor } from '../data/caregiverData'
import { RiskBadge } from './RiskBadge'

export function CaregiverCard({
  caregiver,
  onClick,
}: {
  caregiver: CaregiverProfile
  onClick: () => void
}) {
  const { riskLevel, riskScore, trend, deviationFromBaseline, consecutiveHighRiskShifts } = caregiver

  const trendBlock =
    trend === 'rising' ? (
      <span className="flex items-center gap-1 text-xs" style={{ color: '#DC2626' }}>
        <TrendingUp size={14} aria-hidden />
        Rising
      </span>
    ) : trend === 'stable' ? (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <Minus size={14} aria-hidden />
        Stable
      </span>
    ) : (
      <span className="flex items-center gap-1 text-xs" style={{ color: '#16A34A' }}>
        <TrendingDown size={14} aria-hidden />
        Improving
      </span>
    )

  const deviationBadge =
    deviationFromBaseline > 0 ? (
      <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
        +{deviationFromBaseline} above personal baseline
      </span>
    ) : deviationFromBaseline < 0 ? (
      <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">
        {deviationFromBaseline} below personal baseline
      </span>
    ) : (
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
        At personal baseline
      </span>
    )

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
      style={{ borderLeftWidth: 5, borderLeftColor: getRiskColor(riskLevel) }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#1F2937]">{caregiver.name}</div>
          <div className="text-xs text-gray-400">
            {caregiver.role} · {caregiver.shift}
          </div>
          <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {caregiver.ward}
          </span>
        </div>
        <RiskBadge level={riskLevel} size="sm" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{ color: getRiskColor(riskLevel) }}>
            {riskScore}
          </span>
          <span className="text-sm text-gray-400">/100</span>
        </div>
        {trendBlock}
      </div>

      <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${riskScore}%`, backgroundColor: getRiskColor(riskLevel) }}
        />
      </div>

      <div className="mt-2">{deviationBadge}</div>

      <div className="mt-3 flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1 text-xs text-[#7C3AED]">
            <Mic size={14} aria-hidden />
            <span className="font-medium text-[#1F2937]">
              {(caregiver.voiceStressProbability * 100).toFixed(0)}%
            </span>
          </span>
          <span className="text-xs text-gray-400">Voice Stress</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1 text-xs text-[#DC2626]">
            <Heart size={14} aria-hidden />
            <span className="font-medium text-[#1F2937]">{caregiver.wearableHRV} ms</span>
          </span>
          <span className="text-xs text-gray-400">HRV</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1 text-xs text-[#2563EB]">
            <ClipboardList size={14} aria-hidden />
            <span className="font-medium text-[#1F2937]">{caregiver.surveyScore}/100</span>
          </span>
          <span className="text-xs text-gray-400">Survey</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Clock size={12} aria-hidden />
          Last check-in: {caregiver.lastCheckIn}
        </span>
        <span className="text-xs font-medium text-[#2563EB] hover:underline">View Profile →</span>
      </div>

      {consecutiveHighRiskShifts >= 3 ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 p-2">
          <AlertTriangle size={12} className="shrink-0 text-[#DC2626]" aria-hidden />
          <span className="text-xs text-red-600">
            {consecutiveHighRiskShifts} consecutive high-risk shifts
          </span>
        </div>
      ) : null}
    </button>
  )
}
