import type { ShiftHeatmapRow } from '../data/analyticsData'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function getHeatColor(value: number): string {
  if (value >= 70) return '#DC2626'
  if (value >= 60) return '#EA580C'
  if (value >= 50) return '#D97706'
  if (value >= 42) return '#CA8A04'
  return '#16A34A'
}

function getHeatOpacity(value: number): number {
  return 0.2 + (value / 100) * 0.8
}

const legendScale = [
  { label: 'Low', color: '#16A34A' },
  { label: '', color: '#CA8A04' },
  { label: '', color: '#D97706' },
  { label: '', color: '#EA580C' },
  { label: 'High', color: '#DC2626' },
]

export function RiskHeatmapChart({ data }: { data: ShiftHeatmapRow[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-[#1F2937]">Risk Heatmap — Shift Type × Day of Week</h3>
      <p className="mt-0.5 text-xs text-gray-400">
        Average team risk score by shift and day · darker = higher risk
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="min-w-[72px]" aria-hidden />
              {days.map((d) => (
                <th
                  key={d}
                  className="min-w-[48px] px-2 py-2 text-center text-xs font-semibold text-gray-500"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.shift}>
                <td className="pr-3 text-right text-sm font-medium text-[#1F2937]">{row.shift}</td>
                {days.map((day) => {
                  const value = row[day]
                  const bg = getHeatColor(value)
                  const opacity = getHeatOpacity(value)
                  const textCls = value >= 60 ? 'text-white' : 'text-[#1F2937]'
                  return (
                    <td key={day} className="p-0.5 align-middle">
                      <div className="relative flex min-h-[52px] min-w-[48px] items-center justify-center overflow-hidden rounded-lg px-2 py-3 text-xs font-medium">
                        <span
                          className="pointer-events-none absolute inset-0 rounded-lg"
                          style={{
                            backgroundColor: bg,
                            opacity,
                          }}
                          aria-hidden
                        />
                        <span className={`relative z-[1] ${textCls}`}>{value}</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Scale:</span>
        {legendScale.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="h-4 w-8 rounded" style={{ backgroundColor: item.color }} />
            {item.label ? <span className="text-xs text-gray-600">{item.label}</span> : null}
          </div>
        ))}
        <span className="text-xs text-gray-400">↑ Low → High</span>
      </div>
    </div>
  )
}
