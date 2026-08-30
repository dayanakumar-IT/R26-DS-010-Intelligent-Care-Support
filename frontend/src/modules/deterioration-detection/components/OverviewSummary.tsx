import { lazy, Suspense } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { translateShapFactor } from '../constants'
import { useDeteriorationData } from '../context/useDeteriorationData'
import TeamRiskHeatmap from './TeamRiskHeatmap'
import WardChip from './WardChip'
import type {
  CaregiverListItem,
  MeResponse,
  ModelPerformanceResponse,
  RiskSummaryCaregiver,
  RiskSummaryResponse,
} from '../services/api'
import type { RiskTier } from './CaregiverAvatar3D'
import styles from './OverviewSummary.module.css'

// Code-split, deduped by Vite with every other import of this module — see
// the note in TeamRiskHeatmap.tsx about what putting an avatar here means
// for when the three.js chunk actually loads (a deliberate tradeoff this
// redesign asked for, not an oversight).
const CaregiverAvatar3D = lazy(() => import('./CaregiverAvatar3D'))

interface OverviewSummaryProps {
  me: MeResponse
  caregivers: CaregiverListItem[]
  modelPerformance: ModelPerformanceResponse
  riskSummary: RiskSummaryResponse | null
  riskSummaryLoading: boolean
  riskSummaryError: string | null
}

// Confirmed directly against the live model_registry row (component =
// 'stress_risk'): its metrics object has no "roc_auc" key — it has
// val_roc_auc / test_roc_auc / train_roc_auc. test_roc_auc (held-out
// generalization performance) is used as the headline number; the others
// are kept as fallbacks in case a future model omits a test split.
const ROC_AUC_KEY_PRIORITY = ['test_roc_auc', 'roc_auc', 'val_roc_auc', 'train_roc_auc', 'auc']

function findRocAuc(metrics: Record<string, unknown>): number | null {
  for (const key of ROC_AUC_KEY_PRIORITY) {
    const value = metrics[key]
    if (typeof value === 'number') {
      return value
    }
  }
  return null
}

function riskTierOf(probability: number | null): RiskTier {
  if (probability === null) return 'neutral'
  if (probability > 0.5) return 'high'
  if (probability >= 0.35) return 'moderate'
  return 'low'
}

// KPI row (Change 3): the caregiver-count card and the 4 risk-level cards,
// combined into one compact clickable row — each card navigates to
// Caregiver Profiles with its risk filter pre-set to match, via the shared
// pending-navigation context (see contextDefinition.ts).
type KpiFilterValue = 'all' | RiskTier

function KpiCard({
  label,
  value,
  filterValue,
  variantClass,
  onNavigate,
}: {
  label: string
  value: number
  filterValue: KpiFilterValue
  variantClass?: string
  onNavigate: (filterValue: KpiFilterValue) => void
}) {
  return (
    <button
      type="button"
      className={`${styles.kpiCard} ${variantClass ?? ''}`}
      onClick={() => onNavigate(filterValue)}
    >
      <p className={styles.cardLabel}>{label}</p>
      <p className={styles.cardValue}>{value}</p>
    </button>
  )
}

function directionLabel(previous: number | null, latest: number): { text: string; className: string } {
  if (previous === null) {
    return { text: 'First assessment', className: styles.attentionChangeNeutral }
  }
  const pointChange = (latest - previous) * 100
  if (Math.abs(pointChange) < 0.05) {
    return { text: 'No change', className: styles.attentionChangeNeutral }
  }
  const sign = pointChange > 0 ? '+' : ''
  const arrow = pointChange > 0 ? '↑' : '↓'
  return {
    text: `${arrow} ${sign}${pointChange.toFixed(1)} points`,
    className: pointChange > 0 ? styles.attentionChangeUp : styles.attentionChangeDown,
  }
}

// Requires Attention (Change 4): a richer card per caregiver — avatar,
// name, ward, risk level + score, change from the previous assessment
// (using the new previous_risk_probability field), primary driver, and a
// "View Assessment" button that hands off to Risk Analysis with that
// caregiver pre-selected.
function AttentionCard({
  caregiver,
  onViewAssessment,
}: {
  caregiver: RiskSummaryCaregiver
  onViewAssessment: () => void
}) {
  const tier = riskTierOf(caregiver.latest_risk_probability)
  const change = directionLabel(caregiver.previous_risk_probability, caregiver.latest_risk_probability!)

  return (
    <div className={styles.attentionCard}>
      <div className={styles.attentionAvatar}>
        <Suspense fallback={<div className={styles.attentionAvatarFallback} />}>
          <CaregiverAvatar3D riskTier={tier} width={48} height={48} />
        </Suspense>
      </div>

      <div className={styles.attentionInfo}>
        <div className={styles.attentionNameRow}>
          <p className={styles.attentionName}>{caregiver.display_name}</p>
          <WardChip ward={caregiver.ward} />
        </div>
        <p className={styles.attentionScore}>
          {(caregiver.latest_risk_probability! * 100).toFixed(1)}%
          <span className={change.className}> {change.text}</span>
        </p>
        <p className={styles.attentionFactor}>{translateShapFactor(caregiver.top_shap_factor)}</p>
      </div>

      <button type="button" className={styles.attentionButton} onClick={onViewAssessment}>
        View Assessment
      </button>
    </div>
  )
}

function FactorCountsChart({ sortedFactors }: { sortedFactors: [string, number][] }) {
  const data = sortedFactors.map(([factor, count]) => ({ factor, count }))
  const height = Math.max(100, data.length * 34)

  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis
            type="category"
            dataKey="factor"
            width={190}
            tick={{ fontSize: 12, fill: '#111827' }}
            tickFormatter={(value: string) => translateShapFactor(value)}
          />
          <Tooltip
            formatter={(value) => [value, 'Caregivers']}
            labelFormatter={(label) => translateShapFactor(String(label))}
            contentStyle={{ borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: 12 }}
          />
          <Bar dataKey="count" fill="var(--brand-blue)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function OverviewSummary({
  me,
  caregivers,
  modelPerformance,
  riskSummary,
  riskSummaryLoading,
  riskSummaryError,
}: OverviewSummaryProps) {
  const { setActiveTab, setPendingRiskFilter, setPendingCaregiverId } = useDeteriorationData()

  const rocAuc = findRocAuc(modelPerformance.metrics)
  const caregiverLabel = me.role === 'admin' ? 'All caregivers' : 'Your caregivers'

  const notYetMonitored = riskSummary
    ? riskSummary.summary.total -
      (riskSummary.summary.high_risk_count +
        riskSummary.summary.moderate_risk_count +
        riskSummary.summary.low_risk_count)
    : null

  const goToCaregiverProfiles = (filterValue: KpiFilterValue) => {
    setPendingRiskFilter(filterValue)
    setActiveTab('caregiver-profiles')
  }

  const goToAssessment = (caregiverId: string) => {
    setPendingCaregiverId(caregiverId)
    setActiveTab('risk-analysis')
  }

  // Both derived sections below are computed client-side from the same
  // already-fetched risk-summary payload — no extra API calls.
  const scoredCaregivers = riskSummary
    ? riskSummary.caregivers.filter((c) => c.latest_risk_probability !== null)
    : []

  const topAttention = [...scoredCaregivers]
    .sort((a, b) => (b.latest_risk_probability ?? 0) - (a.latest_risk_probability ?? 0))
    .slice(0, 3)

  const factorCounts = new Map<string, number>()
  for (const c of scoredCaregivers) {
    if (c.top_shap_factor) {
      factorCounts.set(c.top_shap_factor, (factorCounts.get(c.top_shap_factor) ?? 0) + 1)
    }
  }
  const sortedFactors = [...factorCounts.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div>
      <div className={styles.kpiRow}>
        <KpiCard
          label={caregiverLabel}
          value={caregivers.length}
          filterValue="all"
          onNavigate={goToCaregiverProfiles}
        />
        {riskSummary && (
          <>
            <KpiCard
              label="High Risk"
              value={riskSummary.summary.high_risk_count}
              filterValue="high"
              variantClass={styles.kpiCardHigh}
              onNavigate={goToCaregiverProfiles}
            />
            <KpiCard
              label="Moderate Risk"
              value={riskSummary.summary.moderate_risk_count}
              filterValue="moderate"
              variantClass={styles.kpiCardModerate}
              onNavigate={goToCaregiverProfiles}
            />
            <KpiCard
              label="Low Risk"
              value={riskSummary.summary.low_risk_count}
              filterValue="low"
              variantClass={styles.kpiCardLow}
              onNavigate={goToCaregiverProfiles}
            />
            <KpiCard
              label="Not yet monitored"
              value={notYetMonitored ?? 0}
              filterValue="neutral"
              onNavigate={goToCaregiverProfiles}
            />
          </>
        )}
      </div>

      {riskSummaryLoading ? (
        <p className={styles.status}>Loading risk summary…</p>
      ) : riskSummaryError ? (
        <p className={styles.riskUnavailable}>Risk summary unavailable: {riskSummaryError}</p>
      ) : null}

      {me.role === 'admin' && (
        <div className={styles.modelCard}>
          <p className={styles.cardLabel}>Active model</p>
          <p className={styles.cardValue}>{rocAuc !== null ? rocAuc.toFixed(3) : '—'}</p>
          <p className={styles.cardSubtext}>{rocAuc !== null ? 'ROC-AUC' : 'ROC-AUC not reported by this model'}</p>
          <p className={styles.cardMeta}>
            {modelPerformance.model_name} v{modelPerformance.version}
          </p>
        </div>
      )}

      {riskSummary && (
        <>
          <p className={styles.sectionLabel}>Requires Attention</p>

          {topAttention.length === 0 ? (
            <p className={styles.status}>No risk data available yet</p>
          ) : (
            <div className={styles.attentionList}>
              {topAttention.map((c) => (
                <AttentionCard
                  key={c.caregiver_id}
                  caregiver={c}
                  onViewAssessment={() => goToAssessment(c.caregiver_id)}
                />
              ))}
            </div>
          )}

          <p className={styles.sectionLabel}>Team Contributing Factors</p>
          <p className={styles.captionText}>Based on each caregiver&apos;s most recent recorded day</p>

          {sortedFactors.length === 0 ? (
            <p className={styles.status}>No risk data available yet</p>
          ) : (
            <FactorCountsChart sortedFactors={sortedFactors} />
          )}
        </>
      )}

      <TeamRiskHeatmap />
    </div>
  )
}
