import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart2 } from 'lucide-react'
import type { RedistributionSuggestion } from '../types/deterioration.types'

export interface ImpactPreviewChartProps {
  suggestions: RedistributionSuggestion[]
  approvedIds: string[]
}

function ImpactTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: Record<string, string | number> }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[#1F2937]">{String(d.name)}</p>
      <p className="text-gray-600">Before: {d.before}</p>
      <p className="text-gray-600">After: {d.after}</p>
      <p className="mt-1 text-[#2563EB]">Reduction: −{d.reduction} pts</p>
    </div>
  )
}

export function ImpactPreviewChart({ suggestions, approvedIds }: ImpactPreviewChartProps) {
  const approved = suggestions.filter((s) => approvedIds.includes(s.id))
  const chartData = approved.map((s) => ({
    name: s.fromCaregiverName,
    before: s.fromCurrentRisk,
    after: s.fromProjectedRisk,
    reduction: s.fromCurrentRisk - s.fromProjectedRisk,
  }))

  const avgReduction =
    approved.length > 0
      ? Math.round(approved.reduce((sum, s) => sum + s.impactScore, 0) / approved.length)
      : 0
  const totalImpact = approved.reduce((sum, s) => sum + s.impactScore, 0)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-[#1F2937]">Projected Impact Preview</h3>
      <p className="mt-0.5 text-xs text-gray-400">
        Risk score projection after approved redistributions · updates in real time as you approve
        suggestions
      </p>

      {chartData.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <BarChart2 size={32} className="mx-auto text-gray-300" aria-hidden />
          <p className="mt-2 text-sm text-gray-400">No redistributions approved yet</p>
          <p className="text-xs text-gray-300">Approve suggestions above to see projected impact</p>
        </div>
      ) : (
        <>
          <div className="mt-4 h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F9FAFB" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#1F2937' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip content={<ImpactTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="before" name="Current Risk" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="after" name="Projected Risk" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {approvedIds.length > 0 ? (
            <div className="mt-4 flex flex-wrap justify-between gap-4 border-t border-gray-50 pt-4">
              <div className="min-w-0 flex-1 text-center">
                <p className="text-xl font-bold text-[#1E3A8A]">{approvedIds.length}</p>
                <p className="text-xs text-gray-400">Caregivers helped</p>
              </div>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-xl font-bold text-[#1E3A8A]">{avgReduction} pts</p>
                <p className="text-xs text-gray-400">Avg risk reduction</p>
              </div>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-xl font-bold text-[#1E3A8A]">{totalImpact}</p>
                <p className="text-xs text-gray-400">Total impact score</p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
