import type { ReactNode } from 'react'

export interface StatCardProps {
  title: string
  value: number | string
  subtitle: string
  icon: ReactNode
  iconColor: string
  accentColor?: string
  showProgress?: boolean
  progressValue?: number
  pulse?: boolean
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  accentColor,
  showProgress,
  progressValue,
  pulse,
}: StatCardProps) {
  return (
    <div
      className="relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      style={accentColor ? { borderLeft: `4px solid ${accentColor}` } : undefined}
    >
      <div
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${iconColor}1A`, color: iconColor }}
      >
        {icon}
      </div>
      <div className="pr-14">
        <div className="text-sm font-medium text-gray-500">{title}</div>
        <div className={`mt-1 text-3xl font-bold text-[#1F2937] ${pulse ? 'animate-pulse' : ''}`}>
          {value}
        </div>
        <div className="mt-0.5 text-sm text-gray-400">{subtitle}</div>
        {showProgress && progressValue !== undefined ? (
          <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, progressValue))}%`,
                backgroundImage: 'linear-gradient(90deg, #1E3A8A, #7C3AED)',
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
