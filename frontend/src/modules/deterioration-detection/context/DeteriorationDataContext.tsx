// Shared, module-wide data + caching layer for deterioration-detection.
//
// Chosen approach: a single React Context/Provider wrapping the module's
// route (see ../routes.tsx), rather than duplicating fetch-on-mount logic
// in each tab. Two kinds of data live here:
//
// 1. Non-selection-dependent data (getMe, getCaregivers,
//    getModelPerformance, getRiskSummary) — fetched once when this
//    Provider mounts (i.e. once per visit to the module, since it wraps
//    the module's route and all four tabs render as children inside it
//    without it ever unmounting on an internal tab switch), and read by
//    any tab via useDeteriorationData().
//
// 2. Selection-dependent (or otherwise lazy) data (simulateCaregiver,
//    getRiskHistory, getCaregiverHistory, getRiskHeatmap — keyed by its
//    days window rather than by caregiver id — and getTeamTrends — a
//    single global resource keyed by one fixed constant, fetched only once
//    the Trends tab is actually opened) — cached per key in plain
//    in-memory Maps (refs, not state, so populating them doesn't itself
//    trigger a re-render). Consumers call the exposed
//    getCached*/fetchAndCache* pair: check the cache synchronously for
//    instant rendering, fetch and populate it otherwise.
//
// Everything here is in-memory only and resets on a full page reload —
// no localStorage/sessionStorage, as required.
//
// The context object + its value type live in deteriorationDataContext.ts,
// and the useDeteriorationData() hook in its own file too — both split out
// so this file exports only the Provider component (see the comment on
// each of those files for why that split matters).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DeteriorationDataContext } from './contextDefinition'
import type { DeteriorationDataContextValue } from './contextDefinition'
import {
  getBaselineHistory,
  getCaregiverHistory,
  getCaregivers,
  getMe,
  getModelPerformance,
  getRiskHeatmap,
  getRiskHistory,
  getRiskSummary,
  getTeamTrends,
  simulateCaregiver,
} from '../services/api'
import type {
  CaregiverListItem,
  MeResponse,
  ModelPerformanceResponse,
  RiskSummaryResponse,
} from '../services/api'

// Builds one getCached/fetchAndCache pair backed by a Map ref: cache hit
// resolves instantly (no network), a miss fetches once and dedupes
// concurrent callers for the same id via an in-flight-promise map.
function useIdCache<T>(fetchFn: (id: string) => Promise<T>) {
  const cache = useRef(new Map<string, T>())
  const inFlight = useRef(new Map<string, Promise<T>>())

  const getCached = useCallback((id: string) => cache.current.get(id), [])

  const fetchAndCache = useCallback(
    (id: string) => {
      const cached = cache.current.get(id)
      if (cached !== undefined) return Promise.resolve(cached)

      const pending = inFlight.current.get(id)
      if (pending) return pending

      const promise = fetchFn(id)
        .then((result) => {
          cache.current.set(id, result)
          return result
        })
        .finally(() => {
          inFlight.current.delete(id)
        })

      inFlight.current.set(id, promise)
      return promise
    },
    [fetchFn],
  )

  // Invalidation: drops both the resolved cache entry and any in-flight
  // promise for this id, so the *next* getCached(id) correctly reports "no
  // cached value" (undefined) and the next fetchAndCache(id) performs a
  // genuine fresh network request instead of returning stale data — used
  // when something outside the normal fetch-once flow (Demo Control's
  // reveal-next-day) writes new data server-side for a specific id.
  const clear = useCallback((id: string) => {
    cache.current.delete(id)
    inFlight.current.delete(id)
  }, [])

  return { getCached, fetchAndCache, clear }
}

export function DeteriorationDataProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [meLoading, setMeLoading] = useState(true)
  const [meError, setMeError] = useState<string | null>(null)

  const [caregivers, setCaregivers] = useState<CaregiverListItem[]>([])
  const [caregiversLoading, setCaregiversLoading] = useState(true)
  const [caregiversError, setCaregiversError] = useState<string | null>(null)

  const [modelPerformance, setModelPerformance] = useState<ModelPerformanceResponse | null>(null)
  const [modelPerformanceLoading, setModelPerformanceLoading] = useState(true)
  const [modelPerformanceError, setModelPerformanceError] = useState<string | null>(null)

  const [riskSummary, setRiskSummary] = useState<RiskSummaryResponse | null>(null)
  const [riskSummaryLoading, setRiskSummaryLoading] = useState(true)
  const [riskSummaryError, setRiskSummaryError] = useState<string | null>(null)

  // Cross-tab navigation state — see the long comment on these fields in
  // contextDefinition.ts for why this lives here rather than a router.
  const [activeTab, setActiveTab] = useState('overview')
  const [pendingCaregiverId, setPendingCaregiverId] = useState<string | null>(null)
  const [pendingRiskFilter, setPendingRiskFilter] = useState<string | null>(null)
  const [pendingWardFilter, setPendingWardFilter] = useState<string | null>(null)

  // Re-callable version of the risk-summary fetch below, exposed via
  // context for anything that mutates data risk-summary is built from and
  // needs it to reflect that immediately (Demo Control's reveal-next-day).
  // Deliberately NOT reused *inside* the mount effect below — calling
  // something that synchronously resets state from inside a useEffect body
  // is exactly the set-state-in-effect problem this module has hit
  // before; this version's synchronous setRiskSummaryLoading(true)/
  // setRiskSummaryError(null) resets are only safe because every caller is
  // an event handler (or another callback chain rooted in one), never a
  // bare effect body.
  const refetchRiskSummary = useCallback(() => {
    setRiskSummaryLoading(true)
    setRiskSummaryError(null)
    return getRiskSummary()
      .then((result) => {
        setRiskSummary(result)
      })
      .catch((err: unknown) => {
        setRiskSummaryError(err instanceof Error ? err.message : 'Failed to load risk summary.')
      })
      .finally(() => {
        setRiskSummaryLoading(false)
      })
  }, [])

  useEffect(() => {
    let isMounted = true

    getMe()
      .then((result) => {
        if (isMounted) setMe(result)
      })
      .catch((err: unknown) => {
        if (isMounted) setMeError(err instanceof Error ? err.message : 'Failed to load user profile.')
      })
      .finally(() => {
        if (isMounted) setMeLoading(false)
      })

    getCaregivers()
      .then((result) => {
        if (isMounted) setCaregivers(result)
      })
      .catch((err: unknown) => {
        if (isMounted) setCaregiversError(err instanceof Error ? err.message : 'Failed to load caregivers.')
      })
      .finally(() => {
        if (isMounted) setCaregiversLoading(false)
      })

    getModelPerformance()
      .then((result) => {
        if (isMounted) setModelPerformance(result)
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setModelPerformanceError(
            err instanceof Error ? err.message : 'Failed to load model performance.',
          )
        }
      })
      .finally(() => {
        if (isMounted) setModelPerformanceLoading(false)
      })

    getRiskSummary()
      .then((result) => {
        if (isMounted) setRiskSummary(result)
      })
      .catch((err: unknown) => {
        if (isMounted) setRiskSummaryError(err instanceof Error ? err.message : 'Failed to load risk summary.')
      })
      .finally(() => {
        if (isMounted) setRiskSummaryLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const assessmentCache = useIdCache(simulateCaregiver)
  const riskHistoryCache = useIdCache(getRiskHistory)
  const caregiverHistoryCache = useIdCache(getCaregiverHistory)
  const riskHeatmapCache = useIdCache((days: string) => getRiskHeatmap(Number(days) as 7 | 14 | 30))
  const teamTrendsCache = useIdCache(() => getTeamTrends())
  const baselineHistoryCache = useIdCache(getBaselineHistory)

  // Drops every per-caregiver cache entry for one id in one call — all
  // four (assessment/riskHistory/caregiverHistory/baselineHistory) are
  // derived from daily_features, the exact table reveal-next-day writes
  // to, so a reveal makes all four stale for that caregiver at once, not
  // just one of them. (riskHeatmap/teamTrends are team-wide aggregates,
  // not per-caregiver, and aren't part of the bug this fixes — see the
  // note where this is called in DemoControl.tsx.)
  const invalidateCaregiver = useCallback(
    (caregiverId: string) => {
      assessmentCache.clear(caregiverId)
      riskHistoryCache.clear(caregiverId)
      caregiverHistoryCache.clear(caregiverId)
      baselineHistoryCache.clear(caregiverId)
    },
    // Depending on each .clear specifically (not the whole *Cache objects,
    // as the rule suggests) is deliberate: useIdCache returns a fresh
    // object every render, but .clear itself is its own useCallback with
    // an empty dep array inside useIdCache, so it's actually stable
    // forever — depending on the whole object instead would just make
    // invalidateCaregiver re-create itself every render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assessmentCache.clear, riskHistoryCache.clear, caregiverHistoryCache.clear, baselineHistoryCache.clear],
  )

  const value = useMemo<DeteriorationDataContextValue>(
    () => ({
      me,
      meLoading,
      meError,
      caregivers,
      caregiversLoading,
      caregiversError,
      modelPerformance,
      modelPerformanceLoading,
      modelPerformanceError,
      riskSummary,
      riskSummaryLoading,
      riskSummaryError,
      refetchRiskSummary,
      invalidateCaregiver,
      getCachedRiskHeatmap: riskHeatmapCache.getCached,
      fetchAndCacheRiskHeatmap: riskHeatmapCache.fetchAndCache,
      getCachedAssessment: assessmentCache.getCached,
      fetchAndCacheAssessment: assessmentCache.fetchAndCache,
      getCachedRiskHistory: riskHistoryCache.getCached,
      fetchAndCacheRiskHistory: riskHistoryCache.fetchAndCache,
      getCachedCaregiverHistory: caregiverHistoryCache.getCached,
      fetchAndCacheCaregiverHistory: caregiverHistoryCache.fetchAndCache,
      getCachedTeamTrends: teamTrendsCache.getCached,
      fetchAndCacheTeamTrends: teamTrendsCache.fetchAndCache,
      getCachedBaselineHistory: baselineHistoryCache.getCached,
      fetchAndCacheBaselineHistory: baselineHistoryCache.fetchAndCache,
      activeTab,
      setActiveTab,
      pendingCaregiverId,
      setPendingCaregiverId,
      pendingRiskFilter,
      setPendingRiskFilter,
      pendingWardFilter,
      setPendingWardFilter,
    }),
    [
      me,
      meLoading,
      meError,
      caregivers,
      caregiversLoading,
      caregiversError,
      modelPerformance,
      modelPerformanceLoading,
      modelPerformanceError,
      riskSummary,
      riskSummaryLoading,
      riskSummaryError,
      refetchRiskSummary,
      invalidateCaregiver,
      riskHeatmapCache.getCached,
      riskHeatmapCache.fetchAndCache,
      assessmentCache.getCached,
      assessmentCache.fetchAndCache,
      riskHistoryCache.getCached,
      riskHistoryCache.fetchAndCache,
      caregiverHistoryCache.getCached,
      caregiverHistoryCache.fetchAndCache,
      teamTrendsCache.getCached,
      teamTrendsCache.fetchAndCache,
      baselineHistoryCache.getCached,
      baselineHistoryCache.fetchAndCache,
      activeTab,
      pendingCaregiverId,
      pendingRiskFilter,
      pendingWardFilter,
    ],
  )

  return (
    <DeteriorationDataContext.Provider value={value}>{children}</DeteriorationDataContext.Provider>
  )
}
