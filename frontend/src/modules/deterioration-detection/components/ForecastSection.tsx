import { useEffect, useState } from 'react'
import Icon from '../../../shared/components/Icon'
import { useDeteriorationData } from '../context/useDeteriorationData'
import { getForecast, isForecastInsufficient } from '../services/api'
import type { ForecastResponse } from '../services/api'
import styles from './Forecast.module.css'

// Compact "Next 7 days forecast" card (PULSE Forecast V0), shown under
// RiskHistorySection in Caregiver Profiles and Risk Analysis. Fetched
// locally, not through the context caches; forecastRefreshKey is in the
// effect's dependencies so a Demo Control reveal refreshes it.
export default function ForecastSection({ caregiverId }: { caregiverId: string }) {
  const { forecastRefreshKey, setPendingCaregiverId, setActiveTab } = useDeteriorationData()

  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    getForecast(caregiverId)
      .then((result) => {
        if (isCurrent) {
          setForecast(result)
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
      isCurrent = false
    }
  }, [caregiverId, forecastRefreshKey])

  const openForecastTab = () => {
    setPendingCaregiverId(caregiverId)
    setActiveTab('forecast')
  }

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Next 7 days forecast</p>

      {loading && !forecast ? (
        <p className={styles.status}>Loading forecast…</p>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <Icon name="warning" size={18} className={styles.errorIcon} />
          <p className={styles.errorText}>{error}</p>
        </div>
      ) : forecast ? (
        isForecastInsufficient(forecast.latest) ? (
          <p className={styles.reason}>{forecast.latest.reason}</p>
        ) : (
          <>
            <div className={styles.bigNumberRow}>
              <p className={styles.bigNumber}>{forecast.latest.forecast.toFixed(1)}</p>
              <p className={styles.bigNumberSub}>
                likely between {forecast.latest.low.toFixed(1)} and {forecast.latest.high.toFixed(1)}
              </p>
            </div>
            <p className={styles.asOf}>Made on {forecast.latest.as_of}</p>
          </>
        )
      ) : null}

      <p className={styles.caption}>
        Expected average stress rating (1 = none, 5 = a great deal) over the next 7 days, based on this
        person&apos;s recent and usual ratings. It is an average of the week, not a day-by-day
        prediction. Wearable data is not used because it added almost nothing in testing.
      </p>

      <button type="button" className={styles.linkButton} onClick={openForecastTab}>
        See forecast vs actual
      </button>
    </div>
  )
}
