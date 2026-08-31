import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
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
import Icon from '../../../shared/components/Icon'
import CaregiverSearchSelect from './CaregiverSearchSelect'
import CollapsibleSection from './CollapsibleSection'
import RiskHistorySection from './RiskHistorySection'
import ShapFactorsList from './ShapFactorsList'
import WardChip from './WardChip'
import { useDeteriorationData } from '../context/useDeteriorationData'
import type {
  BaselineHistoryPoint,
  CaregiverHistoryResponse,
  CaregiverListItem,
  RiskHistoryResponse,
  RiskSummaryCaregiver,
  SimulateResponse,
} from '../services/api'
import type { RiskTier } from './CaregiverAvatar3D'
import styles from './CaregiverProfiles.module.css'

// Code-split: the three.js bundle (and this component) is only ever
// downloaded once a caregiver's detail view is actually opened, not on
// every render of the caregiver list/tab shell. Also never mounted while
// this tab is inactive — see CaregiverDetail below, which is itself only
// rendered when a caregiver is selected.
const CaregiverAvatar3D = lazy(() => import('./CaregiverAvatar3D'))

// Same thresholds used everywhere else in this module (Overview KPI cards,
// Risk Analysis badges, Team Risk Heatmap): >0.5 high, 0.35-0.5 moderate,
// otherwise low. A null latest_risk_probability (never scored yet) is its
// own neutral tier — never defaulted into a risk color.
function riskTierOf(probability: number | null): RiskTier {
  if (probability === null) return 'neutral'
  if (probability > 0.5) return 'high'
  if (probability >= 0.35) return 'moderate'
  return 'low'
}

function riskTierLabel(tier: RiskTier): string {
  if (tier === 'high') return 'High risk'
  if (tier === 'moderate') return 'Moderate risk'
  if (tier === 'low') return 'Low risk'
  return 'No data yet'
}

function riskPillClass(tier: RiskTier): string {
  if (tier === 'high') return styles.riskPillHigh
  if (tier === 'moderate') return styles.riskPillModerate
  if (tier === 'low') return styles.riskPillLow
  return styles.riskPillNeutral
}

type RiskFilter = 'all' | RiskTier
const RISK_FILTER_VALUES: RiskFilter[] = ['all', 'high', 'moderate', 'low', 'neutral']
function isRiskFilter(value: string): value is RiskFilter {
  return (RISK_FILTER_VALUES as string[]).includes(value)
}
const RISK_FILTER_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'low', label: 'Low' },
  { value: 'neutral', label: 'No data yet' },
]

const ALL_WARDS = '__all__'
const NO_WARD = '__none__'

// A caregiver needs at least 7 collected daily_features rows before the
// model's rolling-window features (hr_dev_roll3/hr_dev_roll7) have enough
// trailing data to be meaningful — this mirrors the model's own 7-day
// rolling window, not an arbitrary UI choice.
const COLD_START_THRESHOLD_DAYS = 7

// Under this many bpm of difference between expected and actual, the
// caption reads as "within normal range" rather than naming a direction —
// the user's own suggested example ("under 2 bpm"), used as-is.
const SMALL_DEVIATION_BPM = 2

// data_mode ("historical" | "replay") is the one real, already-fetched
// field that distinguishes what kind of profile this is — shown in the
// header as the "role label" slot. No caregiver job-role/title field
// exists anywhere in this schema, so this is the honest choice rather than
// a fabricated static "Caregiver" label.
function formatDataMode(dataMode: string): string {
  return dataMode.length > 0 ? dataMode[0]!.toUpperCase() + dataMode.slice(1) : dataMode
}

const SUB_TABS: { id: SubTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'personal-baseline', label: 'Personal Baseline' },
  { id: 'risk-history', label: 'Risk History' },
  { id: 'workload', label: 'Workload' },
  { id: 'explanations', label: 'Explanations' },
]
type SubTabId = 'overview' | 'personal-baseline' | 'risk-history' | 'workload' | 'explanations'

function BaselineComparison({ assessment }: { assessment: SimulateResponse }) {
  const expected = assessment.stage1_predicted_baseline_hr
  const actual = assessment.raw_features.hr_mean

  if (actual === null) {
    return (
      <p className={styles.status}>
        Actual heart rate wasn&apos;t recorded for {assessment.feature_date}, so no comparison is
        available for this day.
      </p>
    )
  }

  const deviation = actual - expected
  const absDeviation = Math.abs(deviation)
  const isSmall = absDeviation < SMALL_DEVIATION_BPM
  const caption = isSmall
    ? `Within their normal range (${absDeviation.toFixed(1)} bpm difference).`
    : `${absDeviation.toFixed(1)} bpm ${deviation > 0 ? 'above' : 'below'} their personal expected pattern.`

  const data = [
    { label: 'Expected', value: expected },
    { label: 'Actual', value: actual },
  ]

  return (
    <div>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
            <XAxis
              type="number"
              domain={['dataMin - 5', 'dataMax + 5']}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              tickFormatter={(value: number) => `${Math.round(value)}`}
            />
            <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 12, fill: '#111827' }} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)} bpm`, '']}
              contentStyle={{ borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <Cell fill="var(--text-secondary)" />
              <Cell fill={isSmall ? 'var(--risk-low)' : 'var(--brand-blue)'} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className={styles.baselineCaption}>{caption}</p>
    </div>
  )
}

function BaselineHistoryChart({ history }: { history: BaselineHistoryPoint[] }) {
  if (history.length === 0) {
    return <p className={styles.status}>No scored days yet to chart.</p>
  }

  const tickInterval = Math.max(0, Math.ceil(history.length / 6) - 1)

  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={history} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
          <XAxis dataKey="feature_date" interval={tickInterval} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            width={40}
            tickFormatter={(value: number) => `${Math.round(value)}`}
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === 'number' ? `${value.toFixed(1)} bpm` : 'No data',
              name,
            ]}
            labelFormatter={(label) => `Date: ${String(label)}`}
            contentStyle={{ borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="actual_hr"
            name="Actual"
            stroke="var(--brand-blue)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="expected_hr"
            name="Expected"
            stroke="var(--text-secondary)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Lazily fetched — only mounted (and so only fetched, via the same
// cache-derived-initial-state + mount-once-effect pattern used everywhere
// else in this module) when the Personal Baseline sub-tab is actually
// opened. The backend endpoint re-runs Stage 1 inference per scored row
// and is explicitly slower than the rest, so this must not fetch eagerly
// alongside history/assessment/riskHistory above.
function PersonalBaselineSubTab({
  caregiverId,
  assessment,
  assessmentLoading,
  assessmentError,
}: {
  caregiverId: string
  assessment: SimulateResponse | null
  assessmentLoading: boolean
  assessmentError: string | null
}) {
  const { getCachedBaselineHistory, fetchAndCacheBaselineHistory } = useDeteriorationData()
  const cached = getCachedBaselineHistory(caregiverId)

  const [history, setHistory] = useState(cached?.history ?? null)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    if (!cached) {
      fetchAndCacheBaselineHistory(caregiverId)
        .then((result) => {
          if (isMounted) setHistory(result.history)
        })
        .catch((err: unknown) => {
          if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load baseline history.')
        })
        .finally(() => {
          if (isMounted) setLoading(false)
        })
    }

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caregiverId])

  return (
    <div className={styles.subTabSections}>
      <div>
        <p className={styles.subSectionHeading}>Most recent day</p>
        {assessmentLoading ? (
          <p className={styles.status}>Running assessment…</p>
        ) : assessmentError ? (
          <p className={styles.status}>Baseline comparison unavailable: {assessmentError}</p>
        ) : assessment ? (
          <BaselineComparison assessment={assessment} />
        ) : null}
      </div>

      <div>
        <p className={styles.subSectionHeading}>Over time</p>
        {loading ? (
          <p className={styles.status}>Loading baseline history… (this can take a few seconds)</p>
        ) : error ? (
          <p className={styles.status}>Baseline history unavailable: {error}</p>
        ) : history ? (
          <BaselineHistoryChart history={history} />
        ) : null}
      </div>
    </div>
  )
}

const WORKLOAD_FIELDS: {
  key: keyof CaregiverHistoryResponse['daily_features'][number]
  label: string
  unit?: string
}[] = [
  { key: 'number_steps', label: 'Step count' },
  { key: 'cardio_minutes', label: 'Cardio minutes', unit: 'min' },
  { key: 'fat_burn_minutes', label: 'Fat-burn minutes', unit: 'min' },
  { key: 'peak_minutes', label: 'Peak minutes', unit: 'min' },
  { key: 'out_of_range_minutes', label: 'Out-of-range minutes', unit: 'min' },
  { key: 'resting_heart_rate', label: 'Resting heart rate', unit: 'bpm' },
]

// Plain factual display only — no interpretation/scoring, per the request.
function WorkloadSubTab({ history }: { history: CaregiverHistoryResponse }) {
  const rows = history.daily_features
  const latest = rows.length > 0 ? rows[rows.length - 1]! : null

  if (!latest) {
    return <p className={styles.status}>No activity data recorded yet.</p>
  }

  return (
    <div>
      <p className={styles.captionText}>Most recent recorded day: {latest.feature_date}</p>
      <div className={styles.workloadGrid}>
        {WORKLOAD_FIELDS.map((field) => {
          const value = latest[field.key]
          return (
            <div key={field.key} className={styles.workloadCard}>
              <p className={styles.workloadLabel}>{field.label}</p>
              <p className={styles.workloadValue}>
                {typeof value === 'number'
                  ? `${Math.round(value).toLocaleString()}${field.unit ? ` ${field.unit}` : ''}`
                  : '—'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Percentage-point threshold below which a 7-day-vs-previous-7-day change
// reads as "Stable" rather than naming a direction — a plain, explicit
// judgment call (not derived from any research), chosen the same way the
// backend's own risk-tier thresholds document their reasoning: small
// enough to catch a genuine shift, large enough not to flag routine
// day-to-day noise as a trend.
const TREND_STABLE_THRESHOLD_POINTS = 3

interface SevenDayTrend {
  // 'not-enough-history': fewer than 7 scored days exist at all.
  // 'not-enough-comparison': 7+ scored days exist, but fewer than 14, so
  // there's no full prior 7-day window to compare against.
  // 'ok': a full comparison was computed.
  status: 'not-enough-history' | 'not-enough-comparison' | 'ok'
  direction?: 'increasing' | 'stable' | 'decreasing'
  pointChange?: number
  elevatedCount?: number
}

function computeSevenDayTrend(history: RiskHistoryResponse['history']): SevenDayTrend {
  const scored = history.filter((point) => point.risk_probability !== null)
  if (scored.length < 7) {
    return { status: 'not-enough-history' }
  }

  const last7 = scored.slice(-7)
  const elevatedCount = last7.filter((point) => point.risk_prediction === 1).length

  if (scored.length < 14) {
    return { status: 'not-enough-comparison', elevatedCount }
  }

  const previous7 = scored.slice(-14, -7)
  const average = (points: typeof last7) =>
    points.reduce((sum, point) => sum + point.risk_probability!, 0) / points.length
  const pointChange = (average(last7) - average(previous7)) * 100

  const direction =
    pointChange > TREND_STABLE_THRESHOLD_POINTS
      ? 'increasing'
      : pointChange < -TREND_STABLE_THRESHOLD_POINTS
        ? 'decreasing'
        : 'stable'

  return { status: 'ok', direction, pointChange, elevatedCount }
}

function trendHeadlineClass(direction: SevenDayTrend['direction']): string {
  if (direction === 'increasing') return styles.trendIncreasing
  if (direction === 'decreasing') return styles.trendDecreasing
  return styles.trendStable
}

function SevenDayTrendCard({ riskHistory }: { riskHistory: RiskHistoryResponse }) {
  const trend = computeSevenDayTrend(riskHistory.history)

  if (trend.status === 'not-enough-history') {
    return <p className={styles.status}>Not enough history yet.</p>
  }

  return (
    <div className={styles.trendCard}>
      {trend.status === 'ok' ? (
        <p className={`${styles.trendHeadline} ${trendHeadlineClass(trend.direction)}`}>
          {trend.direction === 'increasing' ? '↑ Increasing' : trend.direction === 'decreasing' ? '↓ Decreasing' : '→ Stable'}
          {trend.direction !== 'stable' && ` (${Math.abs(trend.pointChange!).toFixed(1)} pts)`}
        </p>
      ) : (
        <p className={styles.trendHeadline}>Not enough prior history to compare trend yet</p>
      )}
      <p className={styles.trendSubline}>Elevated on {trend.elevatedCount} of the last 7 assessed days</p>
    </div>
  )
}

function OverviewSubTab({
  history,
  assessment,
  assessmentLoading,
  assessmentError,
  riskHistory,
  riskHistoryLoading,
  riskHistoryError,
}: {
  history: CaregiverHistoryResponse
  assessment: SimulateResponse | null
  assessmentLoading: boolean
  assessmentError: string | null
  riskHistory: RiskHistoryResponse | null
  riskHistoryLoading: boolean
  riskHistoryError: string | null
}) {
  return (
    <div className={styles.subTabSections}>
      <div>
        <p className={styles.subSectionHeading}>Current assessment</p>
        {assessmentLoading ? (
          <p className={styles.status}>Running assessment…</p>
        ) : assessmentError ? (
          <p className={styles.status}>Assessment unavailable: {assessmentError}</p>
        ) : assessment ? (
          <p className={styles.captionText}>
            {assessment.risk_prediction === 1 ? 'Elevated stress predicted' : 'No elevated stress predicted'}{' '}
            as of {assessment.feature_date}.
          </p>
        ) : null}
        <p className={styles.captionText}>
          Device:{' '}
          {history.caregiver.device_id
            ? `${history.caregiver.device_id} · ${history.caregiver.device_type}`
            : 'No device registered'}
        </p>
      </div>

      <div>
        <p className={styles.subSectionHeading}>7-day trend</p>
        {riskHistoryLoading ? (
          <p className={styles.status}>Loading risk history…</p>
        ) : riskHistoryError ? (
          <p className={styles.status}>Trend unavailable: {riskHistoryError}</p>
        ) : riskHistory ? (
          <SevenDayTrendCard riskHistory={riskHistory} />
        ) : null}
      </div>
    </div>
  )
}

// Rendered with key={caregiverId} by the parent, so switching caregivers
// remounts this fresh — same cache-derived-initial-state pattern used by
// CaregiverRiskPanel in RiskAnalysis.tsx (instant from cache, no
// synchronous reset inside the effect). Fetches the three pieces every
// sub-tab but Personal Baseline needs, in parallel: getCaregiverHistory
// (header + cold-start signal + Workload), simulateCaregiver (Overview +
// Personal Baseline + Explanations), getRiskHistory (Overview's 7-day
// trend + Risk History sub-tab) — each independently loading/erroring, so
// one failing (e.g. the null hr_dev_roll3/roll7 case, or a 404 for an
// unscored caregiver) never blocks the others. getBaselineHistory is
// fetched separately, lazily, only inside PersonalBaselineSubTab above.
function CaregiverDetail({
  caregiverId,
  riskInfo,
}: {
  caregiverId: string
  riskInfo: RiskSummaryCaregiver | undefined
}) {
  const {
    getCachedCaregiverHistory,
    fetchAndCacheCaregiverHistory,
    getCachedAssessment,
    fetchAndCacheAssessment,
    getCachedRiskHistory,
    fetchAndCacheRiskHistory,
  } = useDeteriorationData()

  const cachedHistory = getCachedCaregiverHistory(caregiverId)
  const cachedAssessment = getCachedAssessment(caregiverId)
  const cachedRiskHistory = getCachedRiskHistory(caregiverId)

  const [history, setHistory] = useState<CaregiverHistoryResponse | null>(cachedHistory ?? null)
  const [historyLoading, setHistoryLoading] = useState(!cachedHistory)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [assessment, setAssessment] = useState<SimulateResponse | null>(cachedAssessment ?? null)
  const [assessmentLoading, setAssessmentLoading] = useState(!cachedAssessment)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)

  const [riskHistory, setRiskHistory] = useState<RiskHistoryResponse | null>(cachedRiskHistory ?? null)
  const [riskHistoryLoading, setRiskHistoryLoading] = useState(!cachedRiskHistory)
  const [riskHistoryError, setRiskHistoryError] = useState<string | null>(null)

  const [subTab, setSubTab] = useState<SubTabId>('overview')

  useEffect(() => {
    let isMounted = true

    if (!cachedHistory) {
      fetchAndCacheCaregiverHistory(caregiverId)
        .then((result) => {
          if (isMounted) setHistory(result)
        })
        .catch((err: unknown) => {
          if (isMounted) setHistoryError(err instanceof Error ? err.message : 'Failed to load caregiver profile.')
        })
        .finally(() => {
          if (isMounted) setHistoryLoading(false)
        })
    }

    if (!cachedAssessment) {
      fetchAndCacheAssessment(caregiverId)
        .then((result) => {
          if (isMounted) setAssessment(result)
        })
        .catch((err: unknown) => {
          if (isMounted) setAssessmentError(err instanceof Error ? err.message : 'Failed to run assessment.')
        })
        .finally(() => {
          if (isMounted) setAssessmentLoading(false)
        })
    }

    if (!cachedRiskHistory) {
      fetchAndCacheRiskHistory(caregiverId)
        .then((result) => {
          if (isMounted) setRiskHistory(result)
        })
        .catch((err: unknown) => {
          if (isMounted) setRiskHistoryError(err instanceof Error ? err.message : 'Failed to load risk history.')
        })
        .finally(() => {
          if (isMounted) setRiskHistoryLoading(false)
        })
    }

    return () => {
      isMounted = false
    }
    // Remounted via key={caregiverId} above — mount-once per caregiver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caregiverId])

  if (historyLoading) {
    return <p className={styles.status}>Loading profile…</p>
  }
  if (historyError) {
    return (
      <div className={styles.errorBox} role="alert">
        <Icon name="warning" size={18} className={styles.errorIcon} />
        <p className={styles.errorText}>{historyError}</p>
      </div>
    )
  }
  if (!history) {
    return null
  }

  const riskTier = riskTierOf(riskInfo?.latest_risk_probability ?? null)
  const ward = riskInfo?.ward ?? history.caregiver.ward
  const daysCollected = history.daily_features.length
  const isColdStart = daysCollected < COLD_START_THRESHOLD_DAYS

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerAvatar}>
          <Suspense fallback={<div className={styles.avatarFallback} />}>
            <CaregiverAvatar3D riskTier={riskTier} width={96} height={96} />
          </Suspense>
        </div>

        <div className={styles.headerInfo}>
          <div className={styles.headerNameRow}>
            <p className={styles.headerName}>{history.caregiver.display_name}</p>
            <span className={`${styles.riskPill} ${riskPillClass(riskTier)}`}>{riskTierLabel(riskTier)}</span>
          </div>
          <div className={styles.headerMetaRow}>
            <WardChip ward={ward} />
            <span className={styles.headerDataMode}>{formatDataMode(history.caregiver.data_mode)}</span>
            {riskInfo?.latest_feature_date && (
              <span className={styles.headerDate}>Last assessed {riskInfo.latest_feature_date}</span>
            )}
          </div>
        </div>
      </div>

      {isColdStart && (
        <div className={styles.coldStartBanner} role="status">
          <Icon name="activity" size={16} className={styles.coldStartIcon} />
          <p className={styles.coldStartText}>
            Building baseline — {daysCollected} of {COLD_START_THRESHOLD_DAYS} days collected.
            Predictions begin once monitoring is established.
          </p>
        </div>
      )}

      <div className={styles.subTabRow} role="tablist" aria-label="Caregiver profile sections">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subTab === tab.id}
            className={`${styles.subTab} ${subTab === tab.id ? styles.subTabActive : ''}`}
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.subTabPanel}>
        {subTab === 'overview' ? (
          <OverviewSubTab
            history={history}
            assessment={assessment}
            assessmentLoading={assessmentLoading}
            assessmentError={assessmentError}
            riskHistory={riskHistory}
            riskHistoryLoading={riskHistoryLoading}
            riskHistoryError={riskHistoryError}
          />
        ) : subTab === 'personal-baseline' ? (
          <PersonalBaselineSubTab
            caregiverId={caregiverId}
            assessment={assessment}
            assessmentLoading={assessmentLoading}
            assessmentError={assessmentError}
          />
        ) : subTab === 'risk-history' ? (
          riskHistoryLoading ? (
            <p className={styles.status}>Loading risk history…</p>
          ) : riskHistoryError ? (
            <p className={styles.status}>Risk history unavailable: {riskHistoryError}</p>
          ) : riskHistory ? (
            <RiskHistorySection history={riskHistory} caregiverId={caregiverId} />
          ) : null
        ) : subTab === 'workload' ? (
          <WorkloadSubTab history={history} />
        ) : assessmentLoading ? (
          <p className={styles.status}>Running assessment…</p>
        ) : assessmentError ? (
          <p className={styles.status}>Assessment unavailable: {assessmentError}</p>
        ) : assessment ? (
          <ShapFactorsList factors={assessment.all_factors} />
        ) : null}
      </div>
    </div>
  )
}

function rosterRiskLabel(riskInfo: RiskSummaryCaregiver | undefined): string {
  const tier = riskTierOf(riskInfo?.latest_risk_probability ?? null)
  return riskTierLabel(tier)
}

export default function CaregiverProfiles() {
  // Reused from context — no new /caregivers or /analytics/risk-summary
  // calls, same as Overview and Risk Analysis.
  const {
    caregivers,
    caregiversLoading,
    caregiversError,
    riskSummary,
    pendingCaregiverId,
    setPendingCaregiverId,
    pendingRiskFilter,
    setPendingRiskFilter,
    pendingWardFilter,
    setPendingWardFilter,
  } = useDeteriorationData()

  // Initial state is read directly from any pending cross-tab navigation
  // intent (see contextDefinition.ts) — e.g. a KPI card clicked on
  // Overview, or a "View Profile" button elsewhere. Consumed once, then
  // cleared right below, same "read once at mount" pattern used
  // throughout this module for cache-derived initial state.
  const [selectedId, setSelectedId] = useState(() => pendingCaregiverId ?? '')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>(() =>
    pendingRiskFilter !== null && isRiskFilter(pendingRiskFilter) ? pendingRiskFilter : 'all',
  )
  const [wardFilter, setWardFilter] = useState<string>(() => pendingWardFilter ?? ALL_WARDS)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    // One-shot cleanup: whatever pending navigation intent brought us here
    // has already been read into this component's initial state above —
    // clear it so it doesn't linger and get misapplied by some later,
    // unrelated navigation into this tab.
    if (pendingCaregiverId !== null) setPendingCaregiverId(null)
    if (pendingRiskFilter !== null) setPendingRiskFilter(null)
    if (pendingWardFilter !== null) setPendingWardFilter(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const riskById = useMemo(() => {
    const map = new Map<string, RiskSummaryCaregiver>()
    for (const c of riskSummary?.caregivers ?? []) {
      map.set(c.caregiver_id, c)
    }
    return map
  }, [riskSummary])

  const wardOptions = useMemo(() => {
    const wards = new Set<string>()
    let hasNoWard = false
    for (const c of caregivers) {
      if (c.ward) wards.add(c.ward)
      else hasNoWard = true
    }
    const sorted = Array.from(wards).sort((a, b) => a.localeCompare(b))
    return { sorted, hasNoWard }
  }, [caregivers])

  const filteredCaregivers = useMemo(() => {
    return caregivers.filter((c: CaregiverListItem) => {
      if (riskFilter !== 'all') {
        const tier = riskTierOf(riskById.get(c.id)?.latest_risk_probability ?? null)
        if (tier !== riskFilter) return false
      }
      if (wardFilter === NO_WARD) {
        if (c.ward) return false
      } else if (wardFilter !== ALL_WARDS) {
        if (c.ward !== wardFilter) return false
      }
      return true
    })
  }, [caregivers, riskFilter, wardFilter, riskById])

  // No effect needed to "auto-select the first caregiver once loaded":
  // computed directly at render time instead, so there's no state to sync
  // when caregivers arrives. Deliberately falls back to the first of the
  // *unfiltered* roster, not the filtered one — changing a filter should
  // never silently change which caregiver's detail panel is showing.
  const effectiveSelectedId = selectedId || caregivers[0]?.id || ''
  const riskInfo = riskById.get(effectiveSelectedId)

  if (caregiversLoading) {
    return <p className={styles.status}>Loading caregivers…</p>
  }

  if (caregiversError) {
    return (
      <div className={styles.errorBox} role="alert">
        <Icon name="warning" size={18} className={styles.errorIcon} />
        <p className={styles.errorText}>{caregiversError}</p>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.selectorBar}>
        <button
          type="button"
          className={styles.changeCaregiverButton}
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
        >
          <Icon name="users" size={14} />
          Change caregiver
          <Icon name={searchOpen ? 'chevron-left' : 'chevron-right'} size={14} className={styles.changeCaregiverChevron} />
        </button>
        {searchOpen && (
          <CaregiverSearchSelect
            caregivers={caregivers}
            selectedId={effectiveSelectedId}
            onSelect={(id) => {
              setSelectedId(id)
              setSearchOpen(false)
            }}
          />
        )}
      </div>

      <CollapsibleSection title="Browse all caregivers" defaultOpen={false}>
        <div className={styles.rosterFilters}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Risk level</span>
            <div className={styles.riskFilterToggle} role="group" aria-label="Filter by risk level">
              {RISK_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={riskFilter === option.value}
                  className={`${styles.riskFilterButton} ${
                    riskFilter === option.value ? styles.riskFilterButtonActive : ''
                  }`}
                  onClick={() => setRiskFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.filterGroup}>
            <span className={styles.filterLabel}>Ward</span>
            <select
              className={styles.wardSelect}
              value={wardFilter}
              onChange={(event) => setWardFilter(event.target.value)}
            >
              <option value={ALL_WARDS}>All wards</option>
              {wardOptions.sorted.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
              {wardOptions.hasNoWard && <option value={NO_WARD}>No ward listed</option>}
            </select>
          </label>
        </div>

        {filteredCaregivers.length === 0 ? (
          <p className={styles.status}>No caregivers match the current filters.</p>
        ) : (
          <div className={styles.roster} role="listbox" aria-label="Caregiver roster">
            {filteredCaregivers.map((caregiver) => {
              const info = riskById.get(caregiver.id)
              const tier = riskTierOf(info?.latest_risk_probability ?? null)
              const isSelected = caregiver.id === effectiveSelectedId
              return (
                // A <div role="option"> here, not a <button> — the ward
                // chip below is itself an interactive <button>, and a
                // <button> can never validly contain another <button>
                // (nested interactive controls are invalid HTML and break
                // click handling unpredictably). WardChip's onClick calls
                // stopPropagation() itself so clicking it filters by ward
                // without also selecting this row's caregiver.
                <div
                  key={caregiver.id}
                  role="option"
                  tabIndex={0}
                  aria-selected={isSelected}
                  className={`${styles.rosterRow} ${isSelected ? styles.rosterRowActive : ''}`}
                  onClick={() => setSelectedId(caregiver.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(caregiver.id)
                    }
                  }}
                >
                  <div className={styles.rosterMain}>
                    <span className={styles.rosterName}>{caregiver.display_name}</span>
                    <WardChip
                      ward={caregiver.ward}
                      onClick={() => setWardFilter(caregiver.ward ?? NO_WARD)}
                    />
                  </div>
                  <div className={styles.rosterRight}>
                    {info?.latest_risk_probability !== null && info?.latest_risk_probability !== undefined && (
                      <span className={styles.rosterPercent}>
                        {(info.latest_risk_probability * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className={`${styles.riskPill} ${riskPillClass(tier)}`}>{rosterRiskLabel(info)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CollapsibleSection>

      {effectiveSelectedId && (
        <CaregiverDetail key={effectiveSelectedId} caregiverId={effectiveSelectedId} riskInfo={riskInfo} />
      )}
    </div>
  )
}
