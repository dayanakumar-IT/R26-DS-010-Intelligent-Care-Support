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
import type { BaselineDayPoint } from '../types/deterioration.types'

export function BaselineTrajectoryChart({
  data,
  subjectLabel: _subjectLabel,
}: {
  data: BaselineDayPoint[]
  subjectLabel: string
}) {
  const nDays = data.length

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-[#1F2937]">Personalized Risk Trajectory</h3>
      <p className="mt-0.5 text-xs text-gray-400">
        {nDays}-Day Observed Risk Trajectory · Hosseini Nurse Dataset
      </p>

      <div className="mt-4 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} interval={2} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }}>
              <Label value="Risk index" angle={-90} position="insideLeft" style={{ fill: '#9CA3AF', fontSize: 11 }} />
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
              dataKey="personal"
              name="Personal trajectory"
              stroke="#1E3A8A"
              strokeWidth={2.5}
              dot={{ r: 2, fill: '#1E3A8A' }}
              activeDot={{ r: 5, fill: '#1E3A8A' }}
            />
            <Line
              type="monotone"
              dataKey="population"
              name="Population mean (TILES-2018)"
              stroke="#9CA3AF"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4, fill: '#9CA3AF' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs italic text-gray-400">
        Baseline window uses the first two weeks of each subject&apos;s longitudinal record; daily index is a
        convex combination of HRV z-score, acoustic stress, and survey dimensions used in the prototype
        classifier.
      </p>
    </div>
  )
}
