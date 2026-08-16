import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Label,
} from 'recharts'
import type { WardTrendPoint } from '../types/deterioration.types'

export function WardTrendChart({ data }: { data: WardTrendPoint[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-[#1F2937]">Ward Risk Trajectory — 10-Week Overview</h3>
      <p className="mt-0.5 text-xs text-gray-400">
        Simulated from TILES-2018 longitudinal dataset
      </p>

      <div className="mt-4 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }}>
              <Label value="Risk Score" angle={-90} position="insideLeft" style={{ fill: '#9CA3AF', fontSize: 11 }} />
            </YAxis>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                borderRadius: '0.75rem',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="ICU Ward 3"
              stroke="#DC2626"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: '#DC2626' }}
            />
            <Line
              type="monotone"
              dataKey="General Ward 7"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: '#2563EB' }}
            />
            <Line
              type="monotone"
              dataKey="Rehabilitation"
              stroke="#14B8A6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: '#14B8A6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs italic text-gray-400">
        Risk scores computed using XGBoost classifier trained on TILES-2018 features (HRV, acoustic,
        survey, schedule). Personal baselines computed from first 14 days of each subject&apos;s
        longitudinal data. · TILES-2018 © USC Institute for Creative Technologies — used under
        academic research license.
      </p>
    </div>
  )
}
