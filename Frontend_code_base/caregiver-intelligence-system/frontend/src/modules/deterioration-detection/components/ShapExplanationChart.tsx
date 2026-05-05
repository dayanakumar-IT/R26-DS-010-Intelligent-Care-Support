import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ShapContribution } from '../types/deterioration.types'

function barColor(v: number): string {
  if (v > 0) return '#DC2626'
  if (v < 0) return '#16A34A'
  return '#94A3B8'
}

export function ShapExplanationChart({ contributions }: { contributions: ShapContribution[] }) {
  const data = [...contributions].reverse()

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[#1F2937]">Global SHAP attribution (risk model)</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            Approximate marginal contributions toward the latest risk score (prototype XGBoost
            explainer)
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Research view
        </span>
      </div>

      <div className="mt-4 h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            barCategoryGap={10}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis
              type="category"
              dataKey="feature"
              width={168}
              tick={{ fontSize: 11, fill: '#4B5563' }}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: '#F9FAFB' }}
              formatter={(value) => {
                const n = Number(value ?? 0)
                return [`${n > 0 ? '+' : ''}${n.toFixed(2)}`, 'SHAP']
              }}
              labelStyle={{ fontSize: 12, fontWeight: 600, color: '#111827' }}
              contentStyle={{
                borderRadius: '0.75rem',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              }}
            />
            <Bar dataKey="shapValue" radius={[0, 6, 6, 0]} maxBarSize={18}>
              {data.map((entry) => (
                <Cell key={entry.feature} fill={barColor(entry.shapValue)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Positive SHAP values push the risk index upward relative to the model&apos;s reference cohort;
        negative values indicate protective or stabilizing factors in this snapshot.
      </p>
    </div>
  )
}
