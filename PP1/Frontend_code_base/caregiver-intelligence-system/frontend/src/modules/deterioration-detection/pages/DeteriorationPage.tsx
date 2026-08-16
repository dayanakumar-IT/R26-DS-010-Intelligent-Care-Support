import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Calendar,
  LineChart,
  Share2,
  TrendingUp,
  UserCircle,
  Users,
} from 'lucide-react'
import { ALERTS, CAREGIVERS, WARD_TREND } from '../data/caregiverData'
import { AlertPanel } from '../components/AlertPanel'
import { CaregiverCard } from '../components/CaregiverCard'
import { StatCard } from '../components/StatCard'
import { WardTrendChart } from '../components/WardTrendChart'

export function DeteriorationPage() {
  const navigate = useNavigate()
  const userRaw = localStorage.getItem('caresense_user')
  const user = userRaw ? (JSON.parse(userRaw) as { role?: string; ward?: string | null }) : null
  const isAdmin = user?.role === 'admin'

  const [activeWard, setActiveWard] = useState<string>('All')
  const wards = ['All', 'ICU Ward 3', 'General Ward 7', 'Rehabilitation'] as const

  const visibleCaregivers = useMemo(() => {
    let list = isAdmin ? CAREGIVERS : CAREGIVERS.filter((c) => c.ward === user?.ward)
    if (activeWard !== 'All') {
      list = list.filter((c) => c.ward === activeWard)
    }
    return list
  }, [activeWard, isAdmin, user?.ward])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Deterioration Detection</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-assisted caregiver workforce risk monitoring · Hosseini Nurse Dataset
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          Hosseini Nurse Dataset
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Caregivers Monitored"
          value={15}
          subtitle="Hosseini Nurse Dataset"
          icon={<Users size={18} />}
          iconColor="#1E3A8A"
        />
        <StatCard
          title="Critical / High Risk"
          value={6}
          subtitle="require attention"
          icon={<AlertTriangle size={18} />}
          iconColor="#DC2626"
          accentColor="#DC2626"
          pulse
        />
        <StatCard
          title="Signal Windows Analyzed"
          value="13,287"
          subtitle="5-min EDA/HRV/temp windows · Hosseini dataset"
          icon={<Calendar size={18} />}
          iconColor="#7C3AED"
        />
        <StatCard
          title="Avg Team Risk Score"
          value={76.2}
          subtitle="out of 100"
          icon={<Activity size={18} />}
          iconColor="#14B8A6"
          showProgress
          progressValue={76.2}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/deterioration/graph')}
              className="flex items-center gap-2 rounded-xl border border-[#7C3AED] px-4 py-2 text-sm text-[#7C3AED] transition-colors hover:bg-purple-50"
            >
              <Share2 size={14} aria-hidden />
              View Team Graph
            </button>
            <button
              type="button"
              onClick={() => navigate('/deterioration/analytics')}
              className="flex items-center gap-2 rounded-xl border border-[#14B8A6] px-4 py-2 text-sm text-[#14B8A6] transition-colors hover:bg-teal-50"
            >
              <TrendingUp size={14} aria-hidden />
              Analytics &amp; Trends
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#1F2937]">Team Risk Overview</h2>
              <p className="mt-0.5 text-xs text-gray-400">Click any caregiver to view detailed profile</p>
            </div>
            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                {wards.map((ward) => (
                  <button
                    key={ward}
                    type="button"
                    onClick={() => setActiveWard(ward)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                      activeWard === ward
                        ? 'bg-[#1E3A8A] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {ward}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 rounded-2xl border border-purple-100 bg-purple-50 p-4">
            <LineChart size={18} className="mt-0.5 shrink-0 text-[#7C3AED]" aria-hidden />
            <div>
              <p className="text-sm font-medium text-[#7C3AED]">
                Research Objective 1 — Multimodal Stress Detection
              </p>
              <p className="mt-0.5 text-xs italic leading-relaxed text-purple-800">
                XGBoost physiological classifier trained on EDA, HRV, and temperature features. Binary F1 = 0.861
                across 15 nurses · 13,287 signal windows · LOSO cross-validation · eda_peaks_count identified as top
                stress biomarker (SHAP 0.4427)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleCaregivers.map((cg, index) => (
              <div
                key={cg.id}
                style={{ animationDelay: `${index * 80}ms` }}
                className="animate-fadeInUp"
              >
                <CaregiverCard
                  caregiver={cg}
                  onClick={() => navigate(`/deterioration/caregiver/${cg.id}`)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-1">
          <div className="flex gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <UserCircle size={18} className="mt-0.5 shrink-0 text-[#14B8A6]" aria-hidden />
            <div>
              <p className="text-sm font-medium text-[#0F766E]">
                Research Objective 2 — Personalized Baseline Detection
              </p>
              <p className="mt-0.5 text-xs italic leading-relaxed text-teal-800">
                Isolation Forest fitted per nurse on first 7 days of longitudinal data. Detects deviation from
                individual baseline rather than population threshold — reducing false positives for nurses with
                naturally elevated physiological profiles.
              </p>
            </div>
          </div>
          <AlertPanel
            alerts={isAdmin ? ALERTS : ALERTS.filter((a) => a.ward === user?.ward)}
            onRedistribute={() => navigate('/deterioration/redistribute')}
          />
        </div>
      </div>

      <WardTrendChart data={WARD_TREND} />
    </div>
  )
}
