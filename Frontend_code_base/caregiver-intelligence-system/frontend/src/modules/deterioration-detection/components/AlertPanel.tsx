import { ArrowRightLeft } from 'lucide-react'
import type { AlertItem } from '../types/deterioration.types'
import { getRiskColor } from '../data/caregiverData'

export function AlertPanel({ alerts, onRedistribute }: { alerts: AlertItem[]; onRedistribute: () => void }) {
  return (
    <div className="h-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[#1F2937]">Recent Alerts</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Last 24h</span>
      </div>

      <ul className="mt-3 max-h-96 overflow-y-auto">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="border-b border-gray-50 px-2 py-3 transition-colors last:border-0 hover:rounded-lg hover:bg-gray-50"
          >
            <div className="flex gap-3">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: getRiskColor(alert.severity) }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-1">
                  <span className="text-sm font-medium text-[#1F2937]">{alert.caregiverName}</span>
                  <span className="text-xs text-gray-400">{alert.ward}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{alert.message}</p>
                <p className="mt-1 text-xs text-gray-400">{alert.timestamp}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onRedistribute}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#1E3A8A] bg-white text-[#1E3A8A] transition-colors duration-200 hover:bg-[#1E3A8A] hover:text-white"
      >
        <ArrowRightLeft size={14} aria-hidden />
        Redistribute Workload
      </button>
    </div>
  )
}
