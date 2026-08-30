import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Icon from '../../../shared/components/Icon'
import { useDeteriorationData } from '../context/useDeteriorationData'
import type { CaregiverHistoryResponse, RiskHistoryResponse } from '../services/api'
import styles from './RiskHistorySection.module.css'

const PERIOD_OPTIONS: { value: PeriodValue; label: string }[] = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
  { value: 'all', label: 'All' },
]
type PeriodValue = '7' | '14' | '30' | 'all'

// A risk-history point, optionally carrying a merged-in hr_mean value when
// the "Avg HR overlay" toggle is on — hr_mean is undefined (not just null)
// when the overlay is off, so the chart never draws a phantom second line.
type ChartPoint = RiskHistoryResponse['history'][number] & { hr_mean?: number | null }

function RiskChart({ history, showHrMean }: { history: ChartPoint[]; showHrMean: boolean }) {
  const nonNullCount = history.filter((point) => point.risk_probability !== null).length

  if (nonNullCount < 3) {
    return <p className={styles.status}>Not enough history yet to show a trend</p>
  }

  // Roughly 6 evenly-spaced date labels regardless of history length,
  // rather than rendering one per point (unreadable for 60+ point histories).
  const tickInterval = Math.max(0, Math.ceil(history.length / 6) - 1)

  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={history} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
          <XAxis
            dataKey="feature_date"
            interval={tickInterval}
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          />
          <YAxis
            yAxisId="risk"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            width={44}
          />
          {showHrMean && (
            <YAxis
              yAxisId="hr"
              orientation="right"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              width={44}
              domain={['auto', 'auto']}
            />
          )}
          <Tooltip
            formatter={(value, name) => {
              if (name === 'Avg HR') {
                return typeof value === 'number'
                  ? ([`${Math.round(value)} bpm`, 'Avg HR'] as [string, string])
                  : (['No data', 'Avg HR'] as [string, string])
              }
              return typeof value === 'number'
                ? ([`${(value * 100).toFixed(1)}%`, 'Risk'] as [string, string])
                : (['No data', 'Risk'] as [string, string])
            }}
            labelFormatter={(label) => `Date: ${String(label)}`}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid rgba(15, 23, 42, 0.1)',
              fontSize: 12,
            }}
          />
          {/* connectNulls={false} (the default) keeps null risk_probability
              rows as real gaps in the line rather than zero values. */}
          <Line
            yAxisId="risk"
            type="monotone"
            dataKey="risk_probability"
            name="Risk"
            stroke="var(--brand-blue)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--brand-blue)' }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          {showHrMean && (
            <Line
              yAxisId="hr"
              type="monotone"
              dataKey="hr_mean"
              name="Avg HR"
              stroke="var(--brand-accent)"
              strokeWidth={2}
              dot={{ r: 2, fill: 'var(--brand-accent)' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Extracted out of RiskAnalysis so Caregiver Profiles' "Risk History"
// section uses the exact same chart, period filter, and HR overlay toggle
// instead of a second copy. Owns:
// - a 7d/14d/30d/all period filter, purely client-side (the full history is
//   already fetched and cached — this just slices the already-fetched
//   array, no new request);
// - an "Avg HR overlay" toggle that lazy-fetches getCaregiverHistory (via
//   the module's shared cache) only the first time it's switched on, then
//   merges hr_mean into the chart data by matching feature_date.
export default function RiskHistorySection({
  history,
  caregiverId,
}: {
  history: RiskHistoryResponse
  caregiverId: string
}) {
  const { getCachedCaregiverHistory, fetchAndCacheCaregiverHistory } = useDeteriorationData()

  const [period, setPeriod] = useState<PeriodValue>('all')
  const [showHrMean, setShowHrMean] = useState(false)
  const [overlayData, setOverlayData] = useState<CaregiverHistoryResponse | null>(
    () => getCachedCaregiverHistory(caregiverId) ?? null,
  )
  const [overlayLoading, setOverlayLoading] = useState(false)
  const [overlayError, setOverlayError] = useState<string | null>(null)

  const periodFiltered = useMemo(() => {
    if (period === 'all') return history.history
    return history.history.slice(-Number(period))
  }, [history, period])

  // Event-handler-driven fetch (not inside a useEffect), so this isn't
  // subject to react-hooks/set-state-in-effect — that rule only applies to
  // synchronous setState calls in an effect body, not to a click handler.
  // fetchAndCacheCaregiverHistory itself is cache-first, so toggling off
  // and back on never re-fetches over the network.
  const handleToggleOverlay = () => {
    const next = !showHrMean
    setShowHrMean(next)
    if (next && !overlayData) {
      setOverlayLoading(true)
      setOverlayError(null)
      fetchAndCacheCaregiverHistory(caregiverId)
        .then((result) => setOverlayData(result))
        .catch((err: unknown) => {
          setOverlayError(err instanceof Error ? err.message : 'Failed to load physiological data.')
        })
        .finally(() => setOverlayLoading(false))
    }
  }

  const chartData: ChartPoint[] = useMemo(() => {
    if (!showHrMean || !overlayData) return periodFiltered
    const hrByDate = new Map(overlayData.daily_features.map((row) => [row.feature_date, row.hr_mean]))
    return periodFiltered.map((point) => ({
      ...point,
      hr_mean: hrByDate.get(point.feature_date) ?? null,
    }))
  }, [periodFiltered, showHrMean, overlayData])

  return (
    <>
      <div className={styles.historyControls}>
        <div className={styles.rangeToggle} role="group" aria-label="Risk history period">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              className={`${styles.rangeButton} ${period === option.value ? styles.rangeButtonActive : ''}`}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-pressed={showHrMean}
          className={`${styles.overlayToggle} ${showHrMean ? styles.overlayToggleActive : ''}`}
          onClick={handleToggleOverlay}
        >
          <Icon name={showHrMean ? 'eye' : 'eye-off'} size={14} />
          Avg HR overlay
        </button>
      </div>

      {overlayLoading && <p className={styles.status}>Loading heart-rate data…</p>}
      {overlayError && <p className={styles.status}>HR overlay unavailable: {overlayError}</p>}

      <RiskChart history={chartData} showHrMean={showHrMean && overlayData !== null} />
    </>
  )
}
