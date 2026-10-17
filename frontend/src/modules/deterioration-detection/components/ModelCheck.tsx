import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Icon from '../../../shared/components/Icon'
import CollapsibleSection from './CollapsibleSection'
import { useDeteriorationData } from '../context/useDeteriorationData'
import { getModelValidation } from '../services/api'
import type {
  ModelValidationByCaregiver,
  ModelValidationPoint,
  ModelValidationResponse,
} from '../services/api'
import styles from './ModelCheck.module.css'

// Real research findings, hardcoded — not fetched from any endpoint (same
// approach as Trends.tsx's CENTRALITY_COMPARISON). The paper scores one row
// per survey response on 27 held-out caregivers, so these are deliberately
// shown next to — never mixed into — the app's own per-day numbers.
const PAPER_ROC_AUC = 0.7211
const PAPER_CUTOFF = 0.5
const PAPER_PRECISION = 0.667
const PAPER_RECALL = 0.054

// Alert-level slider range. Integer hundredths are used internally so
// every step lands on an exact two-decimal cutoff (no float drift).
const CUTOFF_MIN = 25
const CUTOFF_MAX = 55
const CUTOFF_DEFAULT = 35

// Mirrors the backend's MIN_COMPARED_DAYS / MIN_ELEVATED_DAYS, only for the
// explanatory copy — the enough_data flags themselves come from the API.
const MIN_COMPARED_DAYS = 20
const MIN_ELEVATED_DAYS = 3

const ALL_CAREGIVERS_LABEL = 'All caregivers'

const TOOLTIP_STYLE = { borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: 12 }

function formatPercent(value: number | null, digits = 1): string {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`
}

function formatNumber(value: number | null, digits = 3): string {
  return value === null ? '—' : value.toFixed(digits)
}

function formatGapPoints(gap: number | null): string {
  if (gap === null) return '—'
  const points = gap * 100
  return `${points > 0 ? '+' : ''}${points.toFixed(1)} pts`
}

interface CutoffStats {
  cutoff: number
  flagged: number
  flaggedShare: number | null
  precision: number | null
  recall: number | null
}

// A day is "flagged" when its predicted risk is at or above the cutoff —
// the same >= convention the backend's risk tiers use. Precision/recall are
// null (rendered as a dash) whenever their denominator is zero.
function computeCutoffStats(points: ModelValidationPoint[], cutoff: number): CutoffStats {
  let flagged = 0
  let flaggedElevated = 0
  let totalElevated = 0
  for (const point of points) {
    if (point.elevated === 1) totalElevated += 1
    if (point.p >= cutoff) {
      flagged += 1
      if (point.elevated === 1) flaggedElevated += 1
    }
  }
  return {
    cutoff,
    flagged,
    flaggedShare: points.length > 0 ? flagged / points.length : null,
    precision: flagged > 0 ? flaggedElevated / flagged : null,
    recall: totalElevated > 0 ? flaggedElevated / totalElevated : null,
  }
}

function Caption({ children }: { children: ReactNode }) {
  return <p className={styles.caption}>{children}</p>
}

function OverallNumbers({ validation }: { validation: ModelValidationResponse }) {
  const { headline } = validation

  return (
    <>
      <Caption>
        How the stored risk scores line up with the stress rating the caregiver actually reported that
        day. Only days that have both a risk score and a real rating are counted.
      </Caption>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <tbody>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Days compared (score and real rating)</td>
              <td className={styles.tdValue}>
                {headline.compared_days.toLocaleString()} days · {headline.caregivers} caregiver
                {headline.caregivers === 1 ? '' : 's'}
              </td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Share of days really elevated (rating 3-5)</td>
              <td className={styles.tdValue}>
                {formatPercent(headline.share_elevated)} ({headline.elevated_days.toLocaleString()} days)
              </td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Average predicted risk</td>
              <td className={styles.tdValue}>{formatPercent(headline.avg_predicted_risk)}</td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Daily ROC-AUC in this app</td>
              <td className={styles.tdValue}>{formatNumber(headline.daily_roc_auc)}</td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={styles.td}>
                Research paper ROC-AUC (one row per survey, 27 held-out caregivers)
              </td>
              <td className={styles.tdValue}>{PAPER_ROC_AUC.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={styles.note}>
        The two ROC-AUC values differ because the research paper scores one row per survey response,
        while this app scores one row per day. Both measure how well the score ranks stressful moments
        above calm ones (0.5 = no better than chance, 1.0 = perfect).
      </p>
    </>
  )
}

// X-axis tick for View 1: the rating, plus "no days" underneath for a
// rating nobody reported — those have no bar, so the text takes its place.
function RatingTick({
  x,
  y,
  payload,
  emptyRatings,
}: {
  x?: number
  y?: number
  payload?: { value: string }
  emptyRatings: Set<string>
}) {
  const value = payload?.value ?? ''
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text dy={12} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
        {value}
      </text>
      {emptyRatings.has(value) && (
        <text dy={26} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
          no days
        </text>
      )}
    </g>
  )
}

function ByRatingView({ byRating }: { byRating: ModelValidationResponse['by_rating'] }) {
  const data = byRating.map((row) => ({ ...row, label: String(row.rating) }))
  const emptyRatings = new Set(byRating.filter((row) => row.days === 0).map((row) => String(row.rating)))

  return (
    <>
      <Caption>
        For each stress rating that was reported (1 = no stress at all, 5 = a great deal of stress), the
        average risk score the model gave those days. A useful score should rise as the real rating
        rises.
      </Caption>
      <div className={styles.viewGrid}>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
              <XAxis dataKey="label" height={36} tick={<RatingTick emptyRatings={emptyRatings} />} />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                width={44}
              />
              <Tooltip
                formatter={(value) => [
                  typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'no days',
                  'Avg predicted risk',
                ]}
                labelFormatter={(label) => `Reported rating ${String(label)}`}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="avg_predicted_risk" fill="var(--brand-blue)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Reported rating</th>
                <th className={styles.th}>Days</th>
                <th className={styles.th}>Avg predicted risk</th>
              </tr>
            </thead>
            <tbody>
              {byRating.map((row) => (
                <tr key={row.rating} className={styles.tableRow}>
                  <td className={styles.td}>{row.rating}</td>
                  <td className={styles.td}>{row.days.toLocaleString()}</td>
                  <td className={styles.td}>
                    {row.days === 0 ? 'no days' : formatPercent(row.avg_predicted_risk)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function ByBinaryView({ byBinary }: { byBinary: ModelValidationResponse['by_binary'] }) {
  return (
    <>
      <Caption>
        The same comparison in two groups: calm days (rating 1-2) versus stressful days (rating 3-5).
        The stressful group should have the higher average risk score.
      </Caption>
      <div className={styles.viewGrid}>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byBinary} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                width={44}
              />
              <Tooltip
                formatter={(value) => [
                  typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'no days',
                  'Avg predicted risk',
                ]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="avg_predicted_risk" fill="var(--brand-purple)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Group</th>
                <th className={styles.th}>Days</th>
                <th className={styles.th}>Avg predicted risk</th>
              </tr>
            </thead>
            <tbody>
              {byBinary.map((row) => (
                <tr key={row.label} className={styles.tableRow}>
                  <td className={styles.td}>{row.label}</td>
                  <td className={styles.td}>{row.days.toLocaleString()}</td>
                  <td className={styles.td}>{formatPercent(row.avg_predicted_risk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function ByBandView({ byBand }: { byBand: ModelValidationResponse['by_band'] }) {
  return (
    <>
      <Caption>
        Days grouped by the risk score the model gave them, and how many of those days were really
        reported as stressful (rating 3-5). Higher score bands should contain more truly stressful days.
      </Caption>
      <div className={styles.viewGrid}>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byBand} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
              <XAxis dataKey="band" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                width={44}
              />
              <Tooltip
                formatter={(value) => [
                  typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'no days',
                  'Really elevated',
                ]}
                labelFormatter={(label) => `Predicted risk ${String(label)}`}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="share_actually_elevated" fill="var(--risk-moderate)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Predicted risk</th>
                <th className={styles.th}>Days</th>
                <th className={styles.th}>Really elevated</th>
              </tr>
            </thead>
            <tbody>
              {byBand.map((row) => (
                <tr key={row.band} className={styles.tableRow}>
                  <td className={styles.td}>{row.band}</td>
                  <td className={styles.td}>{row.days.toLocaleString()}</td>
                  <td className={styles.td}>{formatPercent(row.share_actually_elevated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// Rendered with key={whose data it is} by the parent, so the slider resets
// to the default cutoff whenever a different caregiver's data arrives.
function AlertLevelCard({ points }: { points: ModelValidationPoint[] }) {
  const [cutoffHundredths, setCutoffHundredths] = useState(CUTOFF_DEFAULT)
  const cutoff = cutoffHundredths / 100

  const stats = useMemo(() => computeCutoffStats(points, cutoff), [points, cutoff])

  // Precision/recall for every slider position, computed once per payload.
  const curve = useMemo(() => {
    const rows: CutoffStats[] = []
    for (let hundredths = CUTOFF_MIN; hundredths <= CUTOFF_MAX; hundredths += 1) {
      rows.push(computeCutoffStats(points, hundredths / 100))
    }
    return rows
  }, [points])

  const baseRate = points.length > 0 ? points.filter((point) => point.elevated === 1).length / points.length : null

  return (
    <div className={styles.alertCard}>
      <p className={styles.alertTitle}>Choose your alert level</p>
      <Caption>
        A lower cutoff catches more stressful days but also flags more calm days. Pick the level that
        fits how many alerts your team can follow up.
      </Caption>

      <label className={styles.sliderRow}>
        <span className={styles.sliderLabel}>Alert when predicted risk is at least</span>
        <input
          type="range"
          min={CUTOFF_MIN}
          max={CUTOFF_MAX}
          step={1}
          value={cutoffHundredths}
          onChange={(event) => setCutoffHundredths(Number(event.target.value))}
          className={styles.slider}
          aria-label="Alert cutoff"
        />
        <span className={styles.sliderValue}>{cutoff.toFixed(2)}</span>
      </label>

      <div className={styles.tileRow}>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>Days flagged</p>
          <p className={styles.tileValue}>{stats.flagged.toLocaleString()}</p>
          <p className={styles.tileSub}>{formatPercent(stats.flaggedShare)} of all days</p>
        </div>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>Precision</p>
          <p className={styles.tileValue}>{formatPercent(stats.precision)}</p>
          <p className={styles.tileSub}>of flagged days were really elevated</p>
        </div>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>Recall</p>
          <p className={styles.tileValue}>{formatPercent(stats.recall)}</p>
          <p className={styles.tileSub}>of really elevated days were flagged</p>
        </div>
      </div>

      <p className={styles.note}>Without the model, {formatPercent(baseRate)} of all days are elevated.</p>

      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
            <XAxis
              dataKey="cutoff"
              type="number"
              domain={[CUTOFF_MIN / 100, CUTOFF_MAX / 100]}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              tickFormatter={(value: number) => value.toFixed(2)}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
              width={44}
            />
            <Tooltip
              formatter={(value, name) => [
                typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—',
                name,
              ]}
              labelFormatter={(label) => `Cutoff ${Number(label).toFixed(2)}`}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine x={cutoff} stroke="var(--text-secondary)" strokeDasharray="4 3" />
            <Line
              type="monotone"
              dataKey="precision"
              name="Precision"
              stroke="var(--brand-blue)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="recall"
              name="Recall"
              stroke="var(--brand-accent)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Cutoff</th>
              <th className={styles.th}>Days flagged</th>
              <th className={styles.th}>Precision</th>
              <th className={styles.th}>Recall</th>
            </tr>
          </thead>
          <tbody>
            {curve
              .filter((row) => Math.round(row.cutoff * 100) % 5 === 0)
              .map((row) => (
                <tr key={row.cutoff} className={styles.tableRow}>
                  <td className={styles.td}>{row.cutoff.toFixed(2)}</td>
                  <td className={styles.td}>
                    {row.flagged.toLocaleString()} ({formatPercent(row.flaggedShare)})
                  </td>
                  <td className={styles.td}>{formatPercent(row.precision)}</td>
                  <td className={styles.td}>{formatPercent(row.recall)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>
        Research paper result at cutoff {PAPER_CUTOFF.toFixed(2)}: precision{' '}
        {formatPercent(PAPER_PRECISION)}, recall {formatPercent(PAPER_RECALL)} (different data: 1,406
        survey rows).
      </p>
    </div>
  )
}

type GapSort = 'none' | 'desc' | 'asc'

// Sorts by gap with caregivers that have no gap always last, whichever way.
function sortByGap(rows: ModelValidationByCaregiver[], direction: 'desc' | 'asc'): ModelValidationByCaregiver[] {
  return [...rows].sort((a, b) => {
    if (a.gap === null && b.gap === null) return 0
    if (a.gap === null) return 1
    if (b.gap === null) return -1
    return direction === 'desc' ? b.gap - a.gap : a.gap - b.gap
  })
}

function directionCell(row: ModelValidationByCaregiver): { text: string; className: string } {
  if (!row.enough_data) return { text: 'too few days', className: styles.directionFew }
  if (row.gap === null) return { text: '—', className: styles.directionFew }
  return row.gap > 0
    ? { text: '✓', className: styles.directionRight }
    : { text: '✗', className: styles.directionWrong }
}

function ByCaregiverSection({
  validation,
  onSelectCaregiver,
}: {
  validation: ModelValidationResponse
  onSelectCaregiver: (caregiverId: string) => void
}) {
  const [gapSort, setGapSort] = useState<GapSort>('none')
  const { headline, by_caregiver: byCaregiver } = validation

  const chartData = useMemo(
    () => sortByGap(byCaregiver.filter((row) => row.enough_data), 'desc'),
    [byCaregiver],
  )
  const tableRows = gapSort === 'none' ? byCaregiver : sortByGap(byCaregiver, gapSort)

  const cycleGapSort = () => setGapSort((current) => (current === 'desc' ? 'asc' : 'desc'))

  return (
    <>
      <p className={styles.summaryLine}>
        The model scored stressful days higher for {headline.caregivers_positive_gap ?? '—'} of{' '}
        {headline.caregivers_with_enough_data ?? '—'} caregivers (only caregivers with at least{' '}
        {MIN_COMPARED_DAYS} compared days and {MIN_ELEVATED_DAYS} elevated days are counted).
      </p>
      <Caption>
        Some people will show the model the wrong way round; with a model of this strength that is
        expected and is shown on purpose.
      </Caption>

      {chartData.length === 0 ? (
        <p className={styles.status}>No caregiver has enough compared days yet to chart.</p>
      ) : (
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 44)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
              />
              <YAxis
                type="category"
                dataKey="display_name"
                width={170}
                tick={{ fontSize: 12, fill: '#111827' }}
              />
              <Tooltip
                formatter={(value, name) => [
                  typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—',
                  name,
                ]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="avg_pred_calm" name="Calm days (rating 1-2)" fill="var(--text-secondary)" isAnimationActive={false} />
              <Bar dataKey="avg_pred_elevated" name="Elevated days (rating 3-5)" fill="var(--brand-purple)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={`${styles.tableWrapper} ${styles.tableSpacing}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Caregiver</th>
              <th className={styles.th}>Ward</th>
              <th className={styles.th}>Days compared</th>
              <th className={styles.th}>Elevated days</th>
              <th className={styles.th}>Avg risk, calm</th>
              <th className={styles.th}>Avg risk, elevated</th>
              <th
                className={styles.th}
                aria-sort={gapSort === 'desc' ? 'descending' : gapSort === 'asc' ? 'ascending' : 'none'}
              >
                <button type="button" className={styles.sortButton} onClick={cycleGapSort}>
                  Gap {gapSort === 'desc' ? '↓' : gapSort === 'asc' ? '↑' : '↕'}
                </button>
              </th>
              <th className={styles.th}>Direction</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => {
              const direction = directionCell(row)
              return (
                <tr
                  key={row.caregiver_id}
                  className={`${styles.tableRow} ${styles.tableRowClickable}`}
                  tabIndex={0}
                  onClick={() => onSelectCaregiver(row.caregiver_id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectCaregiver(row.caregiver_id)
                    }
                  }}
                  aria-label={`Show model check for ${row.display_name}`}
                >
                  <td className={styles.td}>{row.display_name}</td>
                  <td className={styles.td}>{row.ward ?? 'No ward listed'}</td>
                  <td className={styles.td}>{row.days_compared}</td>
                  <td className={styles.td}>{row.elevated_days}</td>
                  <td className={styles.td}>{formatPercent(row.avg_pred_calm)}</td>
                  <td className={styles.td}>{formatPercent(row.avg_pred_elevated)}</td>
                  <td className={styles.td}>{formatGapPoints(row.gap)}</td>
                  <td className={`${styles.td} ${direction.className}`}>{direction.text}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

interface LoadedValidation {
  // '' = all caregivers; otherwise the caregiver this payload belongs to.
  caregiverId: string
  data: ModelValidationResponse
}

// Not part of the shared DeteriorationDataContext cache — fetched locally
// (same approach as Redistribution.tsx), since this tab is opened rarely
// and nothing else in the module needs this payload.
export default function ModelCheck() {
  const { caregivers, setActiveTab, setPendingCaregiverId } = useDeteriorationData()

  // The model check only covers historical caregivers (the backend rejects
  // replay ones), so only those are offered.
  const historicalCaregivers = useMemo(
    () =>
      caregivers
        .filter((caregiver) => caregiver.data_mode === 'historical')
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [caregivers],
  )

  const [selectedId, setSelectedId] = useState('')
  const [loaded, setLoaded] = useState<LoadedValidation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isCurrent = true
    getModelValidation(selectedId || undefined)
      .then((result) => {
        if (isCurrent) setLoaded({ caregiverId: selectedId, data: result })
      })
      .catch((err: unknown) => {
        if (isCurrent) setError(err instanceof Error ? err.message : 'Failed to load model check.')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })
    return () => {
      // A newer selection supersedes this request — ignore its response.
      isCurrent = false
    }
  }, [selectedId])

  // Event-handler driven (not inside the effect above), so the loading/error
  // resets never run as a synchronous setState in an effect body.
  const selectCaregiver = (caregiverId: string) => {
    if (caregiverId === selectedId) return
    setSelectedId(caregiverId)
    setLoading(true)
    setError(null)
  }

  const selectFromTable = (caregiverId: string) => {
    selectCaregiver(caregiverId)
    // The page scrolls inside the layout's <main>, not the window, so
    // scroll the tab's own top into view rather than window.scrollTo.
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openRiskHistory = () => {
    setPendingCaregiverId(selectedId)
    setActiveTab('risk-analysis')
  }

  const nameFor = (caregiverId: string): string => {
    if (!caregiverId) return ALL_CAREGIVERS_LABEL
    return historicalCaregivers.find((caregiver) => caregiver.id === caregiverId)?.display_name ?? 'Selected caregiver'
  }

  // Headings describe the data actually on screen, which during a refetch
  // is still the previous selection's (shown dimmed).
  const whose = loaded ? nameFor(loaded.caregiverId) : nameFor(selectedId)
  const validation = loaded?.data ?? null
  const isSingleCaregiver = loaded !== null && loaded.caregiverId !== ''

  return (
    <div ref={topRef}>
      <div className={styles.filterBar}>
        <label className={styles.filterGroup}>
          <span className={styles.filterLabel}>Show:</span>
          <select
            className={styles.select}
            value={selectedId}
            onChange={(event) => selectCaregiver(event.target.value)}
          >
            <option value="">{ALL_CAREGIVERS_LABEL}</option>
            {historicalCaregivers.map((caregiver) => (
              <option key={caregiver.id} value={caregiver.id}>
                {caregiver.display_name} ({caregiver.ward ?? 'No ward listed'})
              </option>
            ))}
          </select>
        </label>
        {selectedId && (
          <button type="button" className={styles.linkButton} onClick={openRiskHistory}>
            Open Risk History
          </button>
        )}
        {loading && validation && <span className={styles.status}>Updating…</span>}
      </div>

      {error ? (
        <div className={styles.errorBox} role="alert">
          <Icon name="warning" size={18} className={styles.errorIcon} />
          <p className={styles.errorText}>{error}</p>
        </div>
      ) : !validation ? (
        loading ? <p className={styles.status}>Loading model check…</p> : null
      ) : (
        <div className={loading ? styles.dimmed : undefined} aria-busy={loading}>
          {isSingleCaregiver && !validation.headline.enough_data && (
            <p className={styles.fewDaysNote} role="status">
              Few days for this caregiver, so treat these numbers as indicative only.
            </p>
          )}

          {validation.headline.compared_days === 0 ? (
            <p className={styles.status}>No scored days with a reported stress rating for {whose} yet.</p>
          ) : (
            <>
              <CollapsibleSection title={`Overall Numbers · ${whose}`}>
                <OverallNumbers validation={validation} />
              </CollapsibleSection>

              <CollapsibleSection title={`View 1 · Predicted Risk by Reported Rating · ${whose}`}>
                <ByRatingView byRating={validation.by_rating} />
              </CollapsibleSection>

              <CollapsibleSection title={`View 2 · Elevated vs Not Elevated · ${whose}`}>
                <ByBinaryView byBinary={validation.by_binary} />
              </CollapsibleSection>

              <CollapsibleSection title={`View 3 · Predicted Risk Band vs Really Elevated · ${whose}`}>
                <ByBandView byBand={validation.by_band} />
              </CollapsibleSection>

              <CollapsibleSection title={`Choose Your Alert Level · ${whose}`}>
                <AlertLevelCard key={loaded?.caregiverId ?? ''} points={validation.points} />
              </CollapsibleSection>
            </>
          )}

          {!isSingleCaregiver && (
            <CollapsibleSection title={`By Caregiver · ${ALL_CAREGIVERS_LABEL}`}>
              <ByCaregiverSection validation={validation} onSelectCaregiver={selectFromTable} />
            </CollapsibleSection>
          )}

          <p className={styles.honestNote}>
            The model gives a risk score, not a yes/no answer. It ranks stressful days higher on average
            but is not a perfect detector.
          </p>
        </div>
      )}
    </div>
  )
}
