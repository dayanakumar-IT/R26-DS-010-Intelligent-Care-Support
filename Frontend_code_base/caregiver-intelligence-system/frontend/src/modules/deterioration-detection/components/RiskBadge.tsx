import type { RiskLevel } from '../types/deterioration.types'
import { getRiskBg, getRiskBorder, getRiskColor } from '../data/caregiverData'

const label: Record<RiskLevel, string> = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
}

export function RiskBadge({ level, size = 'md' }: { level: RiskLevel; size?: 'sm' | 'md' }) {
  const sizeCls =
    size === 'sm' ? 'text-xs px-2 py-0.5 rounded-full' : 'text-sm px-3 py-1 rounded-full font-medium'

  return (
    <span
      className={`inline-block ${sizeCls}`}
      style={{
        backgroundColor: getRiskBg(level),
        color: getRiskColor(level),
        border: `1px solid ${getRiskBorder(level)}`,
      }}
    >
      {label[level]}
    </span>
  )
}
