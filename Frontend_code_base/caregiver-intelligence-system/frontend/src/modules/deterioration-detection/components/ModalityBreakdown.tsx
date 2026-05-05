import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ModalitySlice } from '../types/deterioration.types'

export function ModalityBreakdown({ slices }: { slices: ModalitySlice[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-[#1F2937]">Modality contribution</h3>
      <p className="mt-0.5 text-xs text-gray-400">
        Normalized share of the composite risk signal by data stream (illustrative split for this
        prototype)
      </p>

      <div className="mt-2 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
            >
              {slices.map((entry) => (
                <Cell key={entry.name} fill={entry.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${Number(value ?? 0)}%`, String(name)]}
              contentStyle={{
                borderRadius: '0.75rem',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              }}
            />
            <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2 space-y-2 border-t border-gray-50 pt-3">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-gray-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
            <span className="font-semibold text-[#1F2937]">{s.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
