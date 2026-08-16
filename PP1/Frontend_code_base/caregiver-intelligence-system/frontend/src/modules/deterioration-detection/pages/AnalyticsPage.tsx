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
  MODALITY_ABLATION_CAPTION,
  MODALITY_PERFORMANCE,
  MODALITY_PERFORMANCE_BAR_LEGEND_LABEL,
  SHIFT_HEATMAP,
  WARD_TREND,
  WEEKLY_DISTRIBUTION,
} from '../data/analyticsData'

const RESEARCH_OBJ3_BANNER_BODY =
  '14-day rolling risk trajectory computed from daily aggregation of XGBoost physiological model outputs ' +
  'on the Hosseini Nurse Stress Dataset. Slope-based alert system flags nurses with upward trajectory ' +
  'exceeding the burnout threshold (85/100). Future risk projection uses linear extrapolation from the ' +
  'observed slope — not a standalone sequence forecast layer. Identifies nurses trending toward critical risk ' +
  'before threshold breach occurs.'

const WARD_TRAJECTORY_SECTION_BODY =
  '14-day rolling risk trajectory computed from daily aggregation of XGBoost physiological model outputs ' +
  'on the Hosseini Nurse Stress Dataset. Slope-based alert system flags nurses with upward trajectory ' +
  'exceeding the burnout threshold (85/100). Future risk projection uses linear extrapolation from the ' +
  'observed slope — not a separate Bi-LSTM model. Identifies nurses trending toward critical risk before ' +
  'threshold breach occurs.'

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
              Hosseini Nurse Dataset
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
          <p className="mt-0.5 text-xs text-teal-800 leading-relaxed">{RESEARCH_OBJ3_BANNER_BODY}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Observation Period</p>
          <p className="mt-1 text-2xl font-bold text-[#1F2937]">Up to 35 days</p>
          <p className="text-xs text-gray-400">Hosseini Nurse Dataset</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" style={{ borderLeft: '4px solid #DC2626' }}>
          <p className="text-xs text-gray-400">Peak Risk Nurses</p>
          <p className="mt-1 text-lg font-bold leading-snug text-[#DC2626]">94 (93.1) · DF (95.5) · E4 (90.6)</p>
          <p className="text-xs text-gray-400">{'\u200b'}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Highest Risk Score</p>
          <p className="mt-1 text-2xl font-bold text-[#EA580C]">95.5/100</p>
          <p className="text-xs text-gray-400">Nurse DF</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" style={{ borderLeft: '4px solid #1E3A8A' }}>
          <p className="text-xs text-gray-400">Physiological F1 · Audio F1</p>
          <p className="mt-1 text-2xl font-bold text-[#1E3A8A]">86.1% · 80.4%</p>
          <p className="text-xs text-gray-400 leading-snug">
            Physiological F1: 86.1% · Audio F1: 80.4% · Fusion outperforms single modality by 6 points
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#1F2937]">Ward Risk Trajectory (10 Weeks)</h2>
          <p className="mb-4 mt-0.5 text-xs text-gray-400 leading-relaxed">{WARD_TRAJECTORY_SECTION_BODY}</p>
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
              <BarChart data={MODALITY_PERFORMANCE} margin={{ left: 36, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F9FAFB" />
                <XAxis
                  dataKey="modality"
                  tick={{ fontSize: 9, fill: '#9CA3AF' }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  domain={[55, 95]}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  label={{
                    value: MODALITY_PERFORMANCE_BAR_LEGEND_LABEL,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: '#9CA3AF', fontSize: 11 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E5E7EB',
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${Number(value ?? 0)}%`, MODALITY_PERFORMANCE_BAR_LEGEND_LABEL]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="accuracy" name={MODALITY_PERFORMANCE_BAR_LEGEND_LABEL} radius={[4, 4, 0, 0]}>
                  {MODALITY_PERFORMANCE.map((entry) => (
                    <Cell key={entry.modality} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs italic text-gray-400">{MODALITY_ABLATION_CAPTION}</p>
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
