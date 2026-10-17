import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Icon from '../../../shared/components/Icon'
import CollapsibleSection from './CollapsibleSection'
import { useDeteriorationData } from '../context/useDeteriorationData'
import { getForecast, getForecastValidation, isForecastInsufficient } from '../services/api'
import type {
  ForecastResponse,
  ForecastSeriesItem,
  ForecastValidationByCaregiver,
  ForecastValidationResponse,
} from '../services/api'
import styles from './Forecast.module.css'

const ALL_CAREGIVERS_LABEL = 'All caregivers'
const RATING_DOMAIN: [number, number] = [1, 5]
const RATING_TICKS = [1, 2, 3, 4, 5]
const FORECAST_WINDOW_DAYS = 7
const TOOLTIP_STYLE = { borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: 12 }

function formatRating(value: number | null, digits = 2): string {
  return value === null ? '—' : value.toFixed(digits)
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`
}

// Calendar arithmetic on YYYY-MM-DD strings, in UTC so no timezone can
// shift a date by one.
function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Tooltip values may be a single number or a [low, high] range (the band).
function formatTooltipValue(value: unknown): string {
  if (Array.isArray(value) && value.length === 2) {
    return `${Number(value[0]).toFixed(1)} to ${Number(value[1]).toFixed(1)}`
  }
  return typeof value === 'number' ? value.toFixed(2) : 'No data'
}

function ExplainerBox() {
  return (
    <p className={styles.explainer}>
      The forecast is ONE number: the average stress rating over the next 7 days, made on the day shown.
      Example: forecast 2.1 (likely 1.6 to 2.7); the next 7 days were rated 1,2,3,2,2,3,1 so the real
      average was 2.0.
    </p>
  )
}

function HeadlineTable({ validation }: { validation: ForecastValidationResponse }) {
  return (
    <>
      <p className={styles.caption}>
        How close the forecast came to the real 7-day average, compared with two simple guesses. MAE is
        the average miss in rating points; RMSE weighs big misses more. Lower is better for both.
      </p>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Predictor</th>
              <th className={styles.th}>MAE</th>
              <th className={styles.th}>RMSE</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Forecast (PULSE Forecast V0)</td>
              <td className={styles.td}>{formatRating(validation.blend.mae, 3)}</td>
              <td className={styles.td}>{formatRating(validation.blend.rmse, 3)}</td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Simple guess: last 7 days&apos; average</td>
              <td className={styles.td}>{formatRating(validation.last7_guess.mae, 3)}</td>
              <td className={styles.td}>{formatRating(validation.last7_guess.rmse, 3)}</td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Simple guess: person&apos;s average so far</td>
              <td className={styles.td}>{formatRating(validation.person_avg_guess.mae, 3)}</td>
              <td className={styles.td}>{formatRating(validation.person_avg_guess.rmse, 3)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className={`${styles.tableWrapper} ${styles.tableSpacing}`}>
        <table className={styles.table}>
          <tbody>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Days compared (forecast with a known real 7-day average)</td>
              <td className={styles.td}>{validation.days.toLocaleString()}</td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Caregivers</td>
              <td className={styles.td}>{validation.caregivers}</td>
            </tr>
            <tr className={styles.tableRow}>
              <td className={styles.td}>Real average inside the 80% range</td>
              <td className={styles.td}>{formatPercent(validation.range_coverage)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

function ForecastScatter({ points }: { points: ForecastValidationResponse['points'] }) {
  if (points.length === 0) {
    return <p className={styles.status}>No forecasts with a known real 7-day average yet.</p>
  }
  return (
    <>
      <p className={styles.caption}>
        Each dot is one forecast: what was expected (across) against what really happened (up). Dots on
        the diagonal line were exactly right.
      </p>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
            <XAxis
              type="number"
              dataKey="forecast"
              name="Forecast"
              domain={RATING_DOMAIN}
              ticks={RATING_TICKS}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              label={{ value: 'Forecast', position: 'insideBottom', offset: -8, fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="actual"
              name="Really happened"
              domain={RATING_DOMAIN}
              ticks={RATING_TICKS}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              width={44}
            />
            <Tooltip
              formatter={(value, name) => [formatTooltipValue(value), name]}
              contentStyle={TOOLTIP_STYLE}
            />
            <ReferenceLine
              segment={[
                { x: RATING_DOMAIN[0], y: RATING_DOMAIN[0] },
                { x: RATING_DOMAIN[1], y: RATING_DOMAIN[1] },
              ]}
              stroke="var(--text-secondary)"
              strokeDasharray="4 3"
            />
            <Scatter data={points} fill="var(--brand-blue)" fillOpacity={0.35} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

type MaeSort = 'none' | 'asc' | 'desc'

function sortByMae(rows: ForecastValidationByCaregiver[], direction: 'asc' | 'desc') {
  return [...rows].sort((a, b) => {
    if (a.blend_mae === null && b.blend_mae === null) return 0
    if (a.blend_mae === null) return 1
    if (b.blend_mae === null) return -1
    return direction === 'asc' ? a.blend_mae - b.blend_mae : b.blend_mae - a.blend_mae
  })
}

function ByCaregiverTable({
  rows,
  onSelectCaregiver,
}: {
  rows: ForecastValidationByCaregiver[]
  onSelectCaregiver: (caregiverId: string) => void
}) {
  const [maeSort, setMaeSort] = useState<MaeSort>('none')
  const sortedRows = maeSort === 'none' ? rows : sortByMae(rows, maeSort)

  return (
    <>
      <p className={styles.caption}>
        Average forecast miss for each caregiver. Click a row to see that person&apos;s forecasts over
        time.
      </p>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Caregiver</th>
              <th className={styles.th}>Ward</th>
              <th className={styles.th}>Days</th>
              <th
                className={styles.th}
                aria-sort={maeSort === 'asc' ? 'ascending' : maeSort === 'desc' ? 'descending' : 'none'}
              >
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => setMaeSort((current) => (current === 'asc' ? 'desc' : 'asc'))}
                >
                  Forecast error (MAE) {maeSort === 'asc' ? '↑' : maeSort === 'desc' ? '↓' : '↕'}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
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
                aria-label={`Show forecast for ${row.display_name}`}
              >
                <td className={styles.td}>{row.display_name}</td>
                <td className={styles.td}>{row.ward ?? 'No ward listed'}</td>
                <td className={styles.td}>{row.days}</td>
                <td className={styles.td}>
                  {formatRating(row.blend_mae, 3)}
                  {!row.enough_data && <span className={styles.fewTag}>too few days</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ForecastOverTimeChart({ series }: { series: ForecastSeriesItem[] }) {
  const data = series.map((item) => ({ ...item, range: [item.low, item.high] }))
  const tickInterval = Math.max(0, Math.ceil(data.length / 6) - 1)

  return (
    <>
      <p className={styles.caption}>
        The line is the forecast made on each day, the shaded band its likely range, and the dots what
        the next 7 days really averaged. Days whose following week is not rated yet have no dot.
      </p>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
            <XAxis dataKey="date" interval={tickInterval} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis domain={RATING_DOMAIN} ticks={RATING_TICKS} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={32} />
            <Tooltip
              formatter={(value, name) => [formatTooltipValue(value), name]}
              labelFormatter={(label) => `Made on ${String(label)}`}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              dataKey="range"
              name="Likely range (80%)"
              stroke="none"
              fill="var(--brand-blue)"
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke="var(--brand-blue)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Dots only (strokeWidth 0); null actuals simply get no dot. */}
            <Line
              type="monotone"
              dataKey="actual_next7"
              name="Really happened (7-day avg)"
              stroke="var(--brand-purple)"
              strokeWidth={0}
              dot={{ r: 3, fill: 'var(--brand-purple)', stroke: 'var(--brand-purple)' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

function ForecastHistoryTable({ series }: { series: ForecastSeriesItem[] }) {
  const newestFirst = [...series].reverse()
  return (
    <div className={`${styles.tableWrapper} ${styles.tableSpacing}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Made on</th>
            <th className={styles.th}>Forecast</th>
            <th className={styles.th}>Likely range</th>
            <th className={styles.th}>Real next-7 average</th>
            <th className={styles.th}>Difference</th>
            <th className={styles.th}>Inside range?</th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((item) => {
            const difference = item.actual_next7 === null ? null : item.actual_next7 - item.forecast
            // A real average is always within 1-5, so testing it against
            // the clipped (displayed) range gives the same answer as the
            // unclipped range the backend uses for coverage.
            const inside =
              item.actual_next7 === null ? '' : item.actual_next7 >= item.low && item.actual_next7 <= item.high ? 'Yes' : 'No'
            return (
              <tr key={item.date} className={styles.tableRow}>
                <td className={styles.td}>{item.date}</td>
                <td className={styles.td}>{formatRating(item.forecast)}</td>
                <td className={styles.td}>
                  {item.low.toFixed(2)} to {item.high.toFixed(2)}
                </td>
                <td className={styles.td}>{formatRating(item.actual_next7)}</td>
                <td className={styles.td}>
                  {difference === null ? '—' : `${difference > 0 ? '+' : ''}${difference.toFixed(2)}`}
                </td>
                <td className={styles.td}>{inside}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function notYetKnownText(isDemo: boolean): string {
  return isDemo
    ? 'Reveal more days in Demo Control to see what really happened.'
    : 'Not enough ratings in the following 7 days to know what really happened.'
}

// Rendered with key={caregiver} by the parent so the picked date resets to
// the default whenever a different caregiver's data arrives.
function PickADateView({ forecast, isDemo }: { forecast: ForecastResponse; isDemo: boolean }) {
  const { series, daily_ratings: dailyRatings } = forecast

  // Default: the most recent date whose real 7-day average is known,
  // falling back to the most recent forecast date.
  const defaultDate = useMemo(() => {
    const withActual = series.filter((item) => item.actual_next7 !== null)
    return (withActual[withActual.length - 1] ?? series[series.length - 1])?.date ?? ''
  }, [series])
  const [pickedDate, setPickedDate] = useState(defaultDate)

  const picked = series.find((item) => item.date === pickedDate) ?? series.find((item) => item.date === defaultDate)
  const ratingByDate = useMemo(
    () => new Map(dailyRatings.map((rating) => [rating.date, rating.rating])),
    [dailyRatings],
  )

  if (!picked) return null

  const data = Array.from({ length: FORECAST_WINDOW_DAYS }, (_, index) => {
    const date = addDays(picked.date, index + 1)
    return {
      date,
      rating: ratingByDate.get(date) ?? null,
      forecast: picked.forecast,
      range: [picked.low, picked.high],
      actual: picked.actual_next7,
    }
  })

  return (
    <>
      <p className={styles.caption}>
        Choose the day a forecast was made to see the 7 days that followed: the real daily ratings, the
        forecast with its likely range, and the real 7-day average.
      </p>
      <div className={styles.pickRow}>
        <label className={styles.filterGroup}>
          <span className={styles.filterLabel}>Forecast made on</span>
          <select
            className={styles.select}
            value={picked.date}
            onChange={(event) => setPickedDate(event.target.value)}
          >
            {[...series].reverse().map((item) => (
              <option key={item.date} value={item.date}>
                {item.date}
                {item.actual_next7 === null ? ' (not known yet)' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.pickResult}>
          Forecast {picked.forecast.toFixed(1)}
          {picked.actual_next7 !== null ? `, really happened ${picked.actual_next7.toFixed(1)}` : ''}
        </p>
      </div>
      {picked.actual_next7 === null && <p className={styles.revealNote}>{notYetKnownText(isDemo)}</p>}

      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis domain={RATING_DOMAIN} ticks={RATING_TICKS} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={32} />
            <Tooltip
              formatter={(value, name) => [formatTooltipValue(value), name]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              dataKey="range"
              name="Likely range (80%)"
              stroke="none"
              fill="var(--brand-blue)"
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Line
              dataKey="forecast"
              name="Forecast (7-day average)"
              stroke="var(--brand-blue)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {picked.actual_next7 !== null && (
              <Line
                dataKey="actual"
                name="Real 7-day average"
                stroke="var(--brand-purple)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              dataKey="rating"
              name="Real daily rating"
              stroke="var(--risk-moderate)"
              strokeWidth={1.5}
              dot={{ r: 4, fill: 'var(--risk-moderate)', stroke: 'var(--risk-moderate)' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

interface LoadedForecast {
  // '' = all caregivers; otherwise the caregiver this payload belongs to.
  caregiverId: string
  validation: ForecastValidationResponse
  forecast: ForecastResponse | null
}

// Own tab (registered in Overview.tsx) with its own caregiver selection,
// independent of Model Check. Fetched locally; forecastRefreshKey is in the
// fetch effect's dependencies so a Demo Control reveal refreshes it.
export default function ForecastTab() {
  const { caregivers, pendingCaregiverId, setPendingCaregiverId, forecastRefreshKey } = useDeteriorationData()

  // Historical caregivers plus demo (replay) caregivers.
  const options = useMemo(
    () =>
      caregivers
        .filter((caregiver) => caregiver.data_mode === 'historical' || caregiver.data_mode === 'replay')
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [caregivers],
  )

  // Read once from any pending cross-tab navigation (e.g. "See forecast vs
  // actual" on the forecast card) — see contextDefinition.ts.
  const [selectedId, setSelectedId] = useState(() => pendingCaregiverId ?? '')
  const [loaded, setLoaded] = useState<LoadedForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pendingCaregiverId !== null) setPendingCaregiverId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let isCurrent = true
    const request: Promise<[ForecastValidationResponse, ForecastResponse | null]> = selectedId
      ? Promise.all([getForecastValidation(selectedId), getForecast(selectedId)])
      : getForecastValidation().then((validation) => [validation, null])

    request
      .then(([validation, forecast]) => {
        if (isCurrent) {
          setLoaded({ caregiverId: selectedId, validation, forecast })
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (isCurrent) setError(err instanceof Error ? err.message : 'Failed to load forecast.')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })
    return () => {
      // A newer selection (or refresh) supersedes this request.
      isCurrent = false
    }
  }, [selectedId, forecastRefreshKey])

  // Event-handler driven, so the loading/error resets never run as a
  // synchronous setState inside an effect body.
  const selectCaregiver = (caregiverId: string) => {
    if (caregiverId === selectedId) return
    setSelectedId(caregiverId)
    setLoading(true)
    setError(null)
  }

  const selectFromTable = (caregiverId: string) => {
    selectCaregiver(caregiverId)
    // The page scrolls inside the layout's <main>, not the window.
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const caregiverFor = (caregiverId: string) => options.find((caregiver) => caregiver.id === caregiverId)
  const whose = loaded
    ? loaded.caregiverId
      ? (caregiverFor(loaded.caregiverId)?.display_name ?? 'Selected caregiver')
      : ALL_CAREGIVERS_LABEL
    : ALL_CAREGIVERS_LABEL
  const isDemo = loaded ? caregiverFor(loaded.caregiverId)?.data_mode === 'replay' : false

  return (
    <div ref={topRef}>
      <ExplainerBox />

      <div className={styles.filterBar}>
        <label className={styles.filterGroup}>
          <span className={styles.filterLabel}>Show:</span>
          <select className={styles.select} value={selectedId} onChange={(event) => selectCaregiver(event.target.value)}>
            <option value="">{ALL_CAREGIVERS_LABEL}</option>
            {options.map((caregiver) => (
              <option key={caregiver.id} value={caregiver.id}>
                {caregiver.display_name} ({caregiver.ward ?? 'No ward listed'})
                {caregiver.data_mode === 'replay' ? ' · demo' : ''}
              </option>
            ))}
          </select>
        </label>
        {loading && loaded && <span className={styles.status}>Updating…</span>}
      </div>

      {error ? (
        <div className={styles.errorBox} role="alert">
          <Icon name="warning" size={18} className={styles.errorIcon} />
          <p className={styles.errorText}>{error}</p>
        </div>
      ) : !loaded ? (
        loading ? <p className={styles.status}>Loading forecast…</p> : null
      ) : (
        <div className={loading ? styles.dimmed : undefined} aria-busy={loading}>
          {loaded.caregiverId === '' ? (
            <>
              <CollapsibleSection title={`Forecast vs Simple Guesses · ${whose}`}>
                <HeadlineTable validation={loaded.validation} />
              </CollapsibleSection>
              <CollapsibleSection title={`Forecast vs What Really Happened · ${whose}`}>
                <ForecastScatter points={loaded.validation.points} />
              </CollapsibleSection>
              <CollapsibleSection title={`By Caregiver · ${whose}`}>
                <ByCaregiverTable rows={loaded.validation.by_caregiver} onSelectCaregiver={selectFromTable} />
              </CollapsibleSection>
              <p className={styles.honestNote}>
                Research notebook result on 26 unseen caregivers: MAE 0.291, RMSE 0.379. The forecast was at
                least as good as the better simple guess in every group tested; the gain is modest.
              </p>
            </>
          ) : (
            <>
              {!loaded.validation.enough_data && (
                <p className={styles.fewDaysNote} role="status">
                  Few days for this caregiver, so treat these numbers as indicative only.
                </p>
              )}
              <CollapsibleSection title={`Forecast vs Simple Guesses · ${whose}`}>
                <HeadlineTable validation={loaded.validation} />
                {loaded.validation.days === 0 && <p className={styles.revealNote}>{notYetKnownText(isDemo)}</p>}
              </CollapsibleSection>

              {loaded.forecast && isForecastInsufficient(loaded.forecast.latest) ? (
                <p className={styles.reason}>{loaded.forecast.latest.reason}</p>
              ) : loaded.forecast && loaded.forecast.series.length > 0 ? (
                <>
                  <CollapsibleSection title={`Forecast Over Time · ${whose}`}>
                    <ForecastOverTimeChart series={loaded.forecast.series} />
                    <ForecastHistoryTable series={loaded.forecast.series} />
                  </CollapsibleSection>
                  <CollapsibleSection title={`Pick a Date · ${whose}`}>
                    <PickADateView key={loaded.caregiverId} forecast={loaded.forecast} isDemo={isDemo} />
                  </CollapsibleSection>
                </>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  )
}
