import { useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Brain,
  CheckCircle,
  Edit,
  X,
  XCircle,
} from 'lucide-react'
import type { RedistributionSuggestion } from '../types/deterioration.types'
import { getLoadColor, getPriorityConfig } from '../data/redistributionData'
import { RiskBadge } from './RiskBadge'

export interface RedistributionCardProps {
  suggestion: RedistributionSuggestion
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onModify: (id: string) => void
  onUndoReject: (id: string) => void
}

function SmallLoadBar({ value }: { value: number }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, value)}%`, backgroundColor: getLoadColor(value) }}
      />
    </div>
  )
}

export function RedistributionCard({
  suggestion,
  onApprove,
  onReject,
  onModify,
  onUndoReject,
}: RedistributionCardProps) {
  const [rationaleOpen, setRationaleOpen] = useState(false)
  const { status, priority, impactScore } = suggestion
  const pri = getPriorityConfig(priority)

  const shellClass =
    status === 'approved'
      ? 'border-green-200 bg-green-50/30'
      : status === 'rejected'
        ? 'border-gray-200 opacity-60'
        : 'border-gray-100'

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 ${shellClass}`}>
      <div className="flex items-start justify-between gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: pri.bg,
            color: pri.text,
            border: `1px solid ${pri.border}`,
          }}
        >
          {pri.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-[#2563EB]">
          <ArrowDown size={12} aria-hidden />
          −{impactScore} risk points
        </span>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-400">FROM</p>
          <p className="text-sm font-semibold text-[#1F2937]">{suggestion.fromCaregiverName}</p>
          <p className="text-xs text-gray-400">{suggestion.fromWard}</p>
          <div className="mt-1">
            <RiskBadge level={suggestion.fromRiskLevel} size="sm" />
          </div>
          <p className="mt-2 text-xs text-gray-400">Load: {suggestion.fromCurrentLoad}%</p>
          <SmallLoadBar value={suggestion.fromCurrentLoad} />
          <p className="mt-1 text-xs font-medium text-green-600">
            → {suggestion.fromProjectedRisk}/100 after
          </p>
        </div>

        <div className="flex w-[120px] shrink-0 flex-col items-center justify-center px-2">
          <ArrowRight size={20} className="text-gray-300" aria-hidden />
          <p className="mt-2 line-clamp-2 text-center text-xs text-gray-500">{suggestion.taskDescription}</p>
        </div>

        <div className="min-w-0 flex-1 text-right">
          <p className="text-xs font-medium text-gray-400">TO</p>
          <p className="text-sm font-semibold text-[#1F2937]">{suggestion.toCaregiverName}</p>
          <p className="text-xs text-gray-400">{suggestion.toWard}</p>
          <div className="mt-1 flex justify-end">
            <RiskBadge level={suggestion.toRiskLevel} size="sm" />
          </div>
          <p className="mt-2 text-xs text-gray-400">Load: {suggestion.toCurrentLoad}%</p>
          <SmallLoadBar value={suggestion.toCurrentLoad} />
          <p className="mt-1 text-xs font-medium text-orange-600">
            → {suggestion.toProjectedLoad}% after
          </p>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setRationaleOpen((o) => !o)}
          className="cursor-pointer text-xs text-[#2563EB] hover:underline"
        >
          {rationaleOpen ? 'Hide rationale ↑' : 'Show AI rationale ↓'}
        </button>
        {rationaleOpen ? (
          <div className="mt-2 rounded-xl bg-blue-50/50 p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Brain size={14} className="text-[#7C3AED]" aria-hidden />
              <span className="text-xs font-medium text-[#7C3AED]">AI Rationale</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-600">{suggestion.rationale}</p>
            <p className="mt-1 text-xs italic text-gray-400">
              Generated from risk score differential, baseline deviation, and capacity analysis ·
              TILES-2018 simulation
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {status === 'pending' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onApprove(suggestion.id)}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] text-sm font-medium text-white transition hover:opacity-90"
            >
              <CheckCircle size={14} aria-hidden />
              Approve
            </button>
            <button
              type="button"
              onClick={() => onModify(suggestion.id)}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-[#7C3AED] bg-white text-sm font-medium text-[#7C3AED] transition hover:bg-purple-50"
            >
              <Edit size={14} aria-hidden />
              Modify
            </button>
            <button
              type="button"
              onClick={() => onReject(suggestion.id)}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
            >
              <X size={14} aria-hidden />
              Reject
            </button>
          </div>
        ) : null}

        {status === 'approved' ? (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 p-3">
            <CheckCircle size={16} className="shrink-0 text-[#16A34A]" aria-hidden />
            <span className="text-sm font-medium text-green-700">
              Redistribution approved and logged
            </span>
            <span className="ml-auto text-xs text-green-500">Just now</span>
          </div>
        ) : null}

        {status === 'rejected' ? (
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3">
            <XCircle size={16} className="shrink-0 text-[#9CA3AF]" aria-hidden />
            <span className="text-sm text-gray-500">Suggestion rejected</span>
            <button
              type="button"
              onClick={() => onUndoReject(suggestion.id)}
              className="ml-auto text-xs text-[#2563EB] hover:underline"
            >
              Undo
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
