import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Icon from '../../../shared/components/Icon'
import CollapsibleSection from './CollapsibleSection'
import { translateShapFactor } from '../constants'
import { useDeteriorationData } from '../context/useDeteriorationData'
import type { TeamTrendsResponse } from '../services/api'
import styles from './Trends.module.css'

// A single global resource (see contextDefinition.ts) — one fixed cache
// key rather than a real id, since there's only ever one team-trends
// payload per session.
const TEAM_TRENDS_KEY = 'global'

// Real research findings, hardcoded — not fetched from any endpoint. See
// the section's own caption below for the full context.
const CENTRALITY_COMPARISON = [
  { model: 'Random Forest', without: 0.4576, with: 0.4548 },
  { model: 'XGBoost', without: 0.4604, with: 0.446 },
  { model: 'LightGBM', without: 0.4434, with: 0.4345 },
]

function WeeklyRiskLineChart({ weekly }: { weekly: TeamTrendsResponse['weekly'] }) {
  if (weekly.length === 0) {
    return <p className={styles.status}>Not enough scored history yet to show a trend.</p>
  }

  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={weekly} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
          <XAxis dataKey="week_start" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            width={44}
          />
          <Tooltip
            formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Avg risk']}
            labelFormatter={(label) => `Week of ${String(label)}`}
            contentStyle={{ borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="avg_risk_probability"
            name="Avg risk"
            stroke="var(--brand-blue)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--brand-blue)' }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RiskDistributionChart({ weekly }: { weekly: TeamTrendsResponse['weekly'] }) {
  if (weekly.length === 0) {
    return <p className={styles.status}>Not enough scored history yet to show a distribution.</p>
  }

  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={weekly} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
          <XAxis dataKey="week_start" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={32} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="high_count" name="High" stackId="risk" fill="var(--risk-high)" isAnimationActive={false} />
          <Bar
            dataKey="moderate_count"
            name="Moderate"
            stackId="risk"
            fill="var(--risk-moderate)"
            isAnimationActive={false}
          />
          <Bar dataKey="low_count" name="Low" stackId="risk" fill="var(--risk-low)" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function FactorCountsChart({ factorCounts }: { factorCounts: TeamTrendsResponse['factor_counts'] }) {
  if (factorCounts.length === 0) {
    return <p className={styles.status}>Not enough scored history yet to show contributing factors.</p>
  }

  const height = Math.max(120, factorCounts.length * 36)

  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={factorCounts}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
        >
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

// Change 12: replaces the removed Caregiver Risk Map. Sorted by
// avg_risk_probability descending by default (no interactive re-sort was
// asked for). Clicking a row reuses the exact same pending-navigation
// mechanism as Overview's KPI cards (Change 1) — setPendingWardFilter +
// setActiveTab — not a new one.
function WardRiskTable({
  byWard,
  onSelectWard,
}: {
  byWard: TeamTrendsResponse['by_ward']
  onSelectWard: (ward: string) => void
}) {
  if (byWard.length === 0) {
    return <p className={styles.status}>No scored caregivers with a ward assigned yet.</p>
  }

  const sorted = [...byWard].sort((a, b) => b.avg_risk_probability - a.avg_risk_probability)

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Ward</th>
            <th className={styles.th}>Caregivers</th>
            <th className={styles.th}>High</th>
            <th className={styles.th}>Moderate</th>
            <th className={styles.th}>Low</th>
            <th className={styles.th}>Avg Risk</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.ward}
              className={styles.tableRow}
              tabIndex={0}
              onClick={() => onSelectWard(row.ward)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectWard(row.ward)
                }
              }}
              aria-label={`Filter Caregiver Profiles to ${row.ward}`}
            >
              <td className={styles.td}>{row.ward}</td>
              <td className={styles.td}>{row.caregiver_count}</td>
              <td className={styles.td}>{row.high_count}</td>
              <td className={styles.td}>{row.moderate_count}</td>
              <td className={styles.td}>{row.low_count}</td>
              <td className={styles.td}>{(row.avg_risk_probability * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Change 13: distinct chart colors (not the risk-tier palette — a
// different semantic axis here, mixing them would read as risk level).
// 'Other' always gets a fixed neutral gray, appended last, so it visually
// reads as an aggregate/catch-all rather than a "real" factor.
const FACTOR_TREND_COLORS = [
  'var(--brand-blue)',
  'var(--brand-purple)',
  'var(--brand-accent)',
  'var(--risk-moderate)',
  'var(--risk-low)',
]
const OTHER_FACTOR_COLOR = 'var(--text-secondary)'
const MAX_FACTOR_SERIES = 5

interface FactorTrendRow {
  week_start: string
  [factorKey: string]: string | number
}

// Pivots factor_trends_by_week (one factor-count list per week) into one
// row per week with one numeric column per factor, which is what Recharts
// needs for a multi-series bar chart. If more than MAX_FACTOR_SERIES
// distinct factors appear across the whole range, only the top ones by
// total count keep their own series — everything else is summed into
// "Other" so the chart/legend doesn't get cluttered with long-tail
// factors that show up once or twice.
function buildFactorTrendData(
  factorTrendsByWeek: TeamTrendsResponse['factor_trends_by_week'],
): { rows: FactorTrendRow[]; seriesKeys: string[] } {
  const totalsByFactor = new Map<string, number>()
  for (const week of factorTrendsByWeek) {
    for (const f of week.factors) {
      totalsByFactor.set(f.factor, (totalsByFactor.get(f.factor) ?? 0) + f.count)
    }
  }

  const allFactorsSorted = [...totalsByFactor.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([factor]) => factor)
  const grouped = allFactorsSorted.length > MAX_FACTOR_SERIES
  const keptFactors = grouped ? allFactorsSorted.slice(0, MAX_FACTOR_SERIES) : allFactorsSorted
  const keptSet = new Set(keptFactors)

  const rows: FactorTrendRow[] = factorTrendsByWeek.map((week) => {
    const row: FactorTrendRow = { week_start: week.week_start }
    for (const factor of keptFactors) row[factor] = 0
    if (grouped) row.Other = 0
    for (const f of week.factors) {
      if (keptSet.has(f.factor)) {
        row[f.factor] = (row[f.factor] as number) + f.count
      } else if (grouped) {
        row.Other = (row.Other as number) + f.count
      }
    }
    return row
  })

  const seriesKeys = grouped ? [...keptFactors, 'Other'] : keptFactors
  return { rows, seriesKeys }
}

function FactorTrendsChart({
  factorTrendsByWeek,
}: {
  factorTrendsByWeek: TeamTrendsResponse['factor_trends_by_week']
}) {
  if (factorTrendsByWeek.length === 0) {
    return <p className={styles.status}>Not enough scored history yet to show driver trends.</p>
  }

  const { rows, seriesKeys } = buildFactorTrendData(factorTrendsByWeek)

  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
          <XAxis dataKey="week_start" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={32} allowDecimals={false} />
          <Tooltip
            formatter={(value, name) => [value, name === 'Other' ? 'Other' : translateShapFactor(String(name))]}
            labelFormatter={(label) => `Week of ${String(label)}`}
            contentStyle={{ borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: 12 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => (value === 'Other' ? 'Other' : translateShapFactor(value))}
          />
          {seriesKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId="factors"
              fill={key === 'Other' ? OTHER_FACTOR_COLOR : FACTOR_TREND_COLORS[index % FACTOR_TREND_COLORS.length]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CentralityComparisonChart() {
  return (
    <div className={styles.centralityPanel}>
      <div className={styles.centralityHeader}>
        <Icon name="bar-chart-3" size={16} className={styles.centralityIcon} />
        <p className={styles.centralityTitle}>Network Centrality — Tested, Not Used</p>
      </div>

      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={CENTRALITY_COMPARISON} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
            <XAxis dataKey="model" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
            <YAxis
              domain={[0.4, 0.47]}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              tickFormatter={(value: number) => value.toFixed(2)}
              width={44}
            />
            <Tooltip
              formatter={(value) => [Number(value).toFixed(4), '']}
              contentStyle={{ borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="without" name="Without centrality" fill="var(--text-secondary)" isAnimationActive={false} />
            <Bar dataKey="with" name="With centrality" fill="var(--brand-purple)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className={styles.centralityCaption}>
        Caregiver proximity/relational centrality was tested across three independent models and found
        not to meaningfully improve risk prediction (p=0.129, not statistically significant). This
        factor is not used in the active risk model.
      </p>
    </div>
  )
}

export default function Trends() {
  const { me, setActiveTab, setPendingWardFilter, getCachedTeamTrends, fetchAndCacheTeamTrends } =
    useDeteriorationData()

  const cached = getCachedTeamTrends(TEAM_TRENDS_KEY)
  const [trends, setTrends] = useState<TeamTrendsResponse | null>(cached ?? null)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    if (!cached) {
      fetchAndCacheTeamTrends(TEAM_TRENDS_KEY)
        .then((result) => {
          if (isMounted) setTrends(result)
        })
        .catch((err: unknown) => {
          if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load team trends.')
        })
        .finally(() => {
          if (isMounted) setLoading(false)
        })
    }

    return () => {
      isMounted = false
    }
    // Fetched once, on this tab's first mount — no per-selection identity
    // to key a remount off of, unlike the rest of this module.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goToWard = (ward: string) => {
    setPendingWardFilter(ward)
    setActiveTab('caregiver-profiles')
  }

  if (loading) {
    return <p className={styles.status}>Loading team trends…</p>
  }
  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        <Icon name="warning" size={18} className={styles.errorIcon} />
        <p className={styles.errorText}>{error}</p>
      </div>
    )
  }
  if (!trends) {
    return null
  }

  return (
    <div>
      <CollapsibleSection title="Team Average Risk Over Time">
        <WeeklyRiskLineChart weekly={trends.weekly} />
      </CollapsibleSection>

      <CollapsibleSection title="Risk Distribution Over Time">
        <RiskDistributionChart weekly={trends.weekly} />
      </CollapsibleSection>

      <CollapsibleSection title="Most Common Contributing Factors">
        <FactorCountsChart factorCounts={trends.factor_counts} />
      </CollapsibleSection>

      <CollapsibleSection title="Ward Risk Comparison">
        <WardRiskTable byWard={trends.by_ward} onSelectWard={goToWard} />
      </CollapsibleSection>

      <CollapsibleSection title="Common Risk Drivers Over Time">
        <FactorTrendsChart factorTrendsByWeek={trends.factor_trends_by_week} />
      </CollapsibleSection>

      {me?.role === 'admin' && <CentralityComparisonChart />}
    </div>
  )
}
