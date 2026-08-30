import { lazy, Suspense, useEffect, useState } from 'react'
import { useDeteriorationData } from '../context/useDeteriorationData'
import WardChip from './WardChip'
import type { RiskHeatmapDay, RiskHeatmapResponse } from '../services/api'
import type { RiskTier } from './CaregiverAvatar3D'
import styles from './TeamRiskHeatmap.module.css'

// Code-split, same as everywhere else this avatar is used — the chunk is
// shared/deduped across every import site by Vite, so this doesn't add a
// second download. Worth flagging though: unlike Caregiver Profiles (a
// detail view a supervisor opens deliberately), this callout sits on
// Overview — the tab a session lands on by default — so putting an avatar
// here does mean the three.js chunk now loads on a typical first visit,
// not only once someone drills into a specific caregiver. That's a
// deliberate tradeoff this redesign asked for explicitly, not an oversight.
const CaregiverAvatar3D = lazy(() => import('./CaregiverAvatar3D'))

const DAY_OPTIONS = [7, 14, 30] as const
type DayOption = (typeof DAY_OPTIONS)[number]

// Same thresholds used everywhere else in this module (Overview KPI cards,
// Risk Analysis badges): >0.5 high, 0.35-0.5 moderate, otherwise low.
function cellClass(probability: number): string {
  if (probability > 0.5) return styles.cellHigh
  if (probability >= 0.35) return styles.cellModerate
  return styles.cellLow
}

function riskTierOf(probability: number): RiskTier {
  if (probability > 0.5) return 'high'
  if (probability >= 0.35) return 'moderate'
  return 'low'
}

interface DeltaResult {
  caregiverId: string
  displayName: string
  ward: string | null
  previousValue: number
  previousDate: string
  latestValue: number
  latestDate: string
  delta: number
}

function computeDeltas(caregivers: RiskHeatmapResponse['caregivers']): DeltaResult[] {
  const deltas: DeltaResult[] = []
  for (const caregiver of caregivers) {
    if (caregiver.days.length < 2) continue
    const previous = caregiver.days[caregiver.days.length - 2]!
    const latest = caregiver.days[caregiver.days.length - 1]!
    deltas.push({
      caregiverId: caregiver.caregiver_id,
      displayName: caregiver.display_name,
      ward: caregiver.ward,
      previousValue: previous.risk_probability,
      previousDate: previous.feature_date,
      latestValue: latest.risk_probability,
      latestDate: latest.feature_date,
      delta: latest.risk_probability - previous.risk_probability,
    })
  }
  return deltas
}

export default function TeamRiskHeatmap() {
  const [days, setDays] = useState<DayOption>(14)

  return (
    <>
      <div className={styles.headerRow}>
        <p className={styles.sectionLabel}>Team Risk Heatmap</p>
        <div className={styles.rangeToggle} role="group" aria-label="Heatmap date range">
          {DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={days === option}
              className={`${styles.rangeButton} ${days === option ? styles.rangeButtonActive : ''}`}
              onClick={() => setDays(option)}
            >
              Last {option} days
            </button>
          ))}
        </div>
      </div>

      {/* Remounted via key={days}: switching ranges is a fresh fetch (or an
          instant cache hit if that range was already viewed this session),
          not a reset of whatever range was showing before. */}
      <HeatmapLoader key={days} days={days} />
    </>
  )
}

// Mirrors the CaregiverRiskPanel pattern in RiskAnalysis.tsx: cache-derived
// initial state (instant, no loading flash on a repeat visit to a range
// already fetched this session) and a mount-once effect that only runs a
// network fetch on an actual cache miss.
function HeatmapLoader({ days }: { days: DayOption }) {
  const { getCachedRiskHeatmap, fetchAndCacheRiskHeatmap } = useDeteriorationData()
  const cacheKey = String(days)
  const cached = getCachedRiskHeatmap(cacheKey)

  const [riskHeatmap, setRiskHeatmap] = useState<RiskHeatmapResponse | null>(cached ?? null)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    if (!cached) {
      fetchAndCacheRiskHeatmap(cacheKey)
        .then((result) => {
          if (isMounted) setRiskHeatmap(result)
        })
        .catch((err: unknown) => {
          if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load risk heatmap.')
        })
        .finally(() => {
          if (isMounted) setLoading(false)
        })
    }

    return () => {
      isMounted = false
    }
    // This component is remounted via key={days} above, so this effect is
    // intentionally mount-once per range; cached/fetchAndCacheRiskHeatmap
    // are only meant to be read once at that initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  if (loading) {
    return <p className={styles.status}>Loading heatmap…</p>
  }
  if (error) {
    return <p className={styles.riskUnavailable}>Heatmap unavailable: {error}</p>
  }
  if (!riskHeatmap) {
    return null
  }
  return <HeatmapContent riskHeatmap={riskHeatmap} days={days} />
}

// Shared by both callouts below — avatar, name, ward, previous → current
// risk values, absolute point change with a directional arrow, and a
// "View Profile" button that hands off to Caregiver Profiles via the
// shared pending-navigation context (see contextDefinition.ts) rather than
// a router, since this module's tabs are plain ternary branches.
function DeltaCallout({
  delta,
  variant,
  onViewProfile,
}: {
  delta: DeltaResult
  variant: 'improved' | 'increase'
  onViewProfile: () => void
}) {
  const pointChange = Math.abs(delta.delta * 100)
  const arrow = variant === 'improved' ? '↓' : '↑'

  return (
    <div className={`${styles.calloutCard} ${variant === 'improved' ? styles.calloutImproved : styles.calloutIncrease}`}>
      <p className={styles.calloutLabel}>{variant === 'improved' ? 'Most Improved' : 'Largest Risk Increase'}</p>
      <div className={styles.calloutBody}>
        <div className={styles.calloutAvatar}>
          <Suspense fallback={<div className={styles.calloutAvatarFallback} />}>
            <CaregiverAvatar3D riskTier={riskTierOf(delta.latestValue)} width={56} height={56} />
          </Suspense>
        </div>
        <div className={styles.calloutInfo}>
          <p className={styles.calloutName}>{delta.displayName}</p>
          <WardChip ward={delta.ward} />
          <p className={styles.calloutValues}>
            {(delta.previousValue * 100).toFixed(1)}% → {(delta.latestValue * 100).toFixed(1)}%
            <span className={variant === 'improved' ? styles.calloutDeltaDown : styles.calloutDeltaUp}>
              {' '}
              {arrow} {pointChange.toFixed(1)} pts
            </span>
          </p>
        </div>
      </div>
      <button type="button" className={styles.calloutButton} onClick={onViewProfile}>
        View Profile
      </button>
    </div>
  )
}

function HeatmapContent({ riskHeatmap, days }: { riskHeatmap: RiskHeatmapResponse; days: DayOption }) {
  const { setActiveTab, setPendingCaregiverId } = useDeteriorationData()
  const deltas = computeDeltas(riskHeatmap.caregivers)
  const mostImproved =
    deltas.length > 0 ? deltas.reduce((a, b) => (b.delta < a.delta ? b : a)) : null
  const largestIncrease =
    deltas.length > 0 ? deltas.reduce((a, b) => (b.delta > a.delta ? b : a)) : null

  const goToProfile = (caregiverId: string) => {
    setPendingCaregiverId(caregiverId)
    setActiveTab('caregiver-profiles')
  }

  // Caregivers with zero scored days render as an all-empty row that adds
  // nothing but visual noise — excluded entirely from the grid, with a
  // caption below stating how many were left out so it's clear they're
  // hidden, not simply absent from the system.
  const visibleCaregivers = riskHeatmap.caregivers.filter((c) => c.days.length > 0)
  const excludedCount = riskHeatmap.caregivers.length - visibleCaregivers.length

  return (
    <>
      <p className={styles.captionText}>
        Last {days} scored days per caregiver, most recent on the right
      </p>
      {excludedCount > 0 && (
        <p className={styles.captionText}>
          {excludedCount} caregiver{excludedCount === 1 ? '' : 's'} not yet monitored{' '}
          {excludedCount === 1 ? 'is' : 'are'} not shown.
        </p>
      )}

      {mostImproved && largestIncrease && (
        <div className={styles.calloutGrid}>
          <DeltaCallout
            delta={mostImproved}
            variant="improved"
            onViewProfile={() => goToProfile(mostImproved.caregiverId)}
          />
          <DeltaCallout
            delta={largestIncrease}
            variant="increase"
            onViewProfile={() => goToProfile(largestIncrease.caregiverId)}
          />
        </div>
      )}

      {visibleCaregivers.length === 0 ? (
        <p className={styles.status}>No caregivers with scored data yet.</p>
      ) : (
        <div className={styles.heatmapWrapper}>
          <div className={styles.heatmapGrid}>
            {visibleCaregivers.map((caregiver) => {
              // Pad on the left with nulls so caregivers with fewer than
              // `days` real points still line up with the most-recent
              // column on the right, rather than stretching or shifting.
              const padCount = Math.max(0, days - caregiver.days.length)
              const paddedDays: (RiskHeatmapDay | null)[] = [
                ...(Array(padCount).fill(null) as null[]),
                ...caregiver.days,
              ]

              return (
                <div key={caregiver.caregiver_id} className={styles.heatmapRow}>
                  <div className={styles.heatmapRowLabel}>
                    <span className={styles.heatmapName}>{caregiver.display_name}</span>
                    {caregiver.ward && <WardChip ward={caregiver.ward} />}
                  </div>
                  <div className={styles.heatmapCells}>
                    {paddedDays.map((day, index) =>
                      day ? (
                        <div
                          key={day.feature_date}
                          className={`${styles.cell} ${cellClass(day.risk_probability)}`}
                          title={`${day.feature_date}: ${(day.risk_probability * 100).toFixed(1)}%`}
                        />
                      ) : (
                        <div
                          key={index}
                          className={`${styles.cell} ${styles.cellEmpty}`}
                          title="No data"
                        />
                      ),
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
