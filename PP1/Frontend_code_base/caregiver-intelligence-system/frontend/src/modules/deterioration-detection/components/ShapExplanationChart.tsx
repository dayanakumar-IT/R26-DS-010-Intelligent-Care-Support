import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ShapContribution } from '../types/deterioration.types'

const BAR_RED = '#DC2626'

export function ShapExplanationChart({
  contributions,
  nurseId,
  nWindows,
}: {
  contributions: ShapContribution[]
  nurseId: string
  nWindows: number
}) {
  /** Largest-first for horizontal bars (category order preserved). */
  const data = [...contributions]

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[#1F2937]">
            XGBoost Feature SHAP Values (Nurse {nurseId})
          </h3>
          <p className="mt-0.5 text-xs text-gray-400 leading-relaxed">
            Top 5 physiological features by SHAP importance · {nWindows} signal windows · Hosseini Nurse Stress
            Dataset
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
            <XAxis type="number" domain={[0, 0.9]} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis
              type="category"
              dataKey="feature"
              width={168}
              tick={{ fontSize: 11, fill: '#4B5563' }}
              interval={0}
              reversed
            />
            <Tooltip
              cursor={{ fill: '#F9FAFB' }}
              formatter={(value) => {
                const n = Number(value ?? 0)
                return [`+${n.toFixed(4)}`, 'SHAP']
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
                <Cell key={entry.feature} fill={BAR_RED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-gray-400">
        SHAP values computed using TreeExplainer on XGBoost physiological classifier. All top features are EDA and
        skin temperature signals. Positive values indicate features pushing this nurse&apos;s risk score above the
        cohort mean. Source: shap_by_nurse.json — real model outputs.
      </p>
    </div>
  )
}
