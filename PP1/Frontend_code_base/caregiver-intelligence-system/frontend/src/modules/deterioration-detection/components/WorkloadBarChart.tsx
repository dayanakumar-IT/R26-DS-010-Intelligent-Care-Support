import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WorkloadEntry } from '../types/deterioration.types'
import { getLoadColor } from '../data/redistributionData'

function WorkloadTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: WorkloadEntry }>
}) {
  if (!active || !payload?.length) return null
  const e = payload[0].payload
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[#1F2937]">{e.caregiverName}</p>
      <p className="text-gray-500">{e.ward}</p>
      <p className="mt-1 text-gray-600">
        Load: <span className="font-medium text-[#1F2937]">{e.currentLoad}%</span>
      </p>
      <p className="text-gray-600">
        Risk score: <span className="font-medium text-[#1F2937]">{e.riskScore}/100</span>
      </p>
    </div>
  )
}

export function WorkloadBarChart({ entries }: { entries: WorkloadEntry[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-[#1F2937]">Current Workload Distribution</h3>
      <p className="mb-4 mt-0.5 text-xs text-gray-400">
        Workload index per caregiver vs recommended maximum · bars exceeding 80% flagged for
        redistribution
      </p>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={entries}
            margin={{ top: 0, right: 60, left: 90, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F9FAFB" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis
              type="category"
              dataKey="caregiverName"
              tick={{ fontSize: 11, fill: '#1F2937' }}
              width={85}
            />
            <Tooltip content={<WorkloadTooltip />} />
            <ReferenceLine
              x={80}
              stroke="#DC2626"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'Max recommended',
                position: 'right',
                fontSize: 10,
                fill: '#DC2626',
              }}
            />
            <Bar dataKey="currentLoad" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {entries.map((entry) => (
                <Cell key={entry.caregiverId} fill={getLoadColor(entry.currentLoad)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs italic text-gray-400">
        Workload index derived from TILES-2018 schedule density, shift overlap, and task frequency
        features. Red dashed line indicates 80% recommended maximum threshold.
      </p>
    </div>
  )
}
