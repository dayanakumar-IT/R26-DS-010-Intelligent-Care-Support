import { ArrowLeft, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ForecastChart } from '../components/ForecastChart'
import { RiskHeatmapChart } from '../components/RiskHeatmapChart'
import {
  FORECAST_DATA,
  MODALITY_PERFORMANCE,
  SHIFT_HEATMAP,
  WARD_TREND,
  WEEKLY_DISTRIBUTION,
} from '../data/analyticsData'

export function AnalyticsPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/deterioration')}
        className="flex items-center gap-2 text-sm text-[#2563EB] hover:underline"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to Deterioration Detection
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1F2937]">Analytics &amp; Trends</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Simulation Mode
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Longitudinal workforce analytics · TILES-2018 Dataset · 10-week observation period
          </p>
        </div>
      </div>

      <div className="flex gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4">
        <TrendingUp size={18} className="mt-0.5 shrink-0 text-[#14B8A6]" aria-hidden />
        <div>
          <p className="text-sm font-medium text-[#0F766E]">Research Objective 3 — Temporal Pattern Detection</p>
          <p className="mt-0.5 text-xs text-teal-800">
            Longitudinal analytics address the fundamental limitation of snapshot-based systems. The 10-week
            TILES-2018 dataset enables meaningful trend analysis showing how risk accumulates across shifts and
            weeks. The 48-hour forecast demonstrates predictive temporal modeling beyond what existing systems
            provide.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Observation Period</p>
          <p className="mt-1 text-2xl font-bold text-[#1F2937]">10</p>
          <p className="text-xs text-gray-400">weeks · TILES-2018</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" style={{ borderLeft: '4px solid #DC2626' }}>
          <p className="text-xs text-gray-400">Peak Risk Week</p>
          <p className="mt-1 text-2xl font-bold text-[#DC2626]">Week 10</p>
          <p className="text-xs text-gray-400">ICU avg 80/100</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Highest Risk Shift</p>
          <p className="mt-1 text-2xl font-bold text-[#EA580C]">Night</p>
          <p className="text-xs text-gray-400">avg 74/100 Fridays</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" style={{ borderLeft: '4px solid #1E3A8A' }}>
          <p className="text-xs text-gray-400">Fusion Model F1</p>
          <p className="mt-1 text-2xl font-bold text-[#1E3A8A]">82%</p>
          <p className="text-xs text-gray-400">vs 68% single modality</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#1F2937]">Ward Risk Trajectory (10 Weeks)</h2>
          <p className="mb-4 mt-0.5 text-xs text-gray-400">
            ICU Ward 3 shows consistent upward trend requiring intervention
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={WARD_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F9FAFB" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis domain={[20, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E5E7EB',
                    fontSize: 12,
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="ICU Ward 3" stroke="#DC2626" strokeWidth={2.5} type="monotone" dot={false} />
                <Line dataKey="General Ward 7" stroke="#2563EB" strokeWidth={2.5} type="monotone" dot={false} />
                <Line dataKey="Rehabilitation" stroke="#14B8A6" strokeWidth={2.5} type="monotone" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs italic text-gray-400">
            Indexed ward risk summarizes prototype model outputs pooled across caregivers assigned to each site.
          </p>
        </div>

        <ForecastChart data={FORECAST_DATA} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-[#1F2937]">Risk Level Distribution Over Time</h2>
        <p className="mb-4 mt-0.5 text-xs text-gray-400">
          Stacked count of caregivers per risk level per week · critical cases increasing from Week 3
        </p>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WEEKLY_DISTRIBUTION}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F9FAFB" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  fontSize: 12,
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="critical" name="Critical" stackId="a" fill="#DC2626" />
              <Bar dataKey="high" name="High" stackId="a" fill="#EA580C" />
              <Bar dataKey="moderate" name="Moderate" stackId="a" fill="#D97706" />
              <Bar dataKey="low" name="Low" stackId="a" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-[#1F2937]">Modality Performance Comparison</h2>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#2563EB]">
              Ablation Study
            </span>
          </div>
          <p className="mb-4 mt-0.5 text-xs text-gray-400">
            Single modality vs late fusion model · fusion outperforms all individual streams
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MODALITY_PERFORMANCE} margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F9FAFB" />
                <XAxis
                  dataKey="modality"
                  tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={56}
                />
                <YAxis domain={[55, 95]} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E5E7EB',
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${Number(value ?? 0)}%`, 'Accuracy']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="accuracy" name="Accuracy %" radius={[4, 4, 0, 0]}>
                  {MODALITY_PERFORMANCE.map((entry) => (
                    <Cell key={entry.modality} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs italic text-gray-400">
            Late Fusion model (84% accuracy) outperforms best single modality (Schedule 76%) by 8 points. This
            empirically validates the multimodal approach.
          </p>
        </div>

        <RiskHeatmapChart data={SHIFT_HEATMAP} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-xs leading-relaxed text-gray-400">
          <span className="font-medium text-gray-500">Research Note:</span> All analytics derived from TILES-2018
          longitudinal dataset (212 hospital staff, 10-week observation). Modality performance metrics computed from
          XGBoost classifier trained on held-out test subjects (80/20 train-test split, StratifiedKFold
          cross-validation). Forecast generated by Bi-LSTM temporal model. Heatmap derived from shift schedule feature
          analysis. · Dataset: TILES-2018 © USC Institute for Creative Technologies — used under academic research
          license.
        </p>
      </div>
    </div>
  )
}
