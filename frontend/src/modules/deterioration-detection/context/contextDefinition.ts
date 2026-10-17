// Just the React context object + its value type, in their own file (not
// exported alongside DeteriorationDataProvider or useDeteriorationData) so
// neither of those files mixes a component/hook export with a plain-object
// export — that mix is what trips react-refresh/only-export-components and
// breaks Vite Fast Refresh for the file.

import { createContext } from 'react'
import type {
  BaselineHistoryResponse,
  CaregiverHistoryResponse,
  CaregiverListItem,
  MeResponse,
  ModelPerformanceResponse,
  RiskHeatmapResponse,
  RiskHistoryResponse,
  RiskSummaryResponse,
  SimulateResponse,
  TeamTrendsResponse,
} from '../services/api'

export interface DeteriorationDataContextValue {
  me: MeResponse | null
  meLoading: boolean
  meError: string | null

  caregivers: CaregiverListItem[]
  caregiversLoading: boolean
  caregiversError: string | null

  modelPerformance: ModelPerformanceResponse | null
  modelPerformanceLoading: boolean
  modelPerformanceError: string | null

  riskSummary: RiskSummaryResponse | null
  riskSummaryLoading: boolean
  riskSummaryError: string | null
  // Re-fetches risk-summary on demand (resets loading/error, then
  // replaces riskSummary once the new response arrives) — for anything
  // that mutates data risk-summary is built from and needs it to reflect
  // that immediately, rather than waiting for the next full page load.
  // Currently only Demo Control's reveal-next-day calls this.
  refetchRiskSummary: () => void

  // Drops the assessment/riskHistory/caregiverHistory/baselineHistory
  // cache entries for one caregiver id — all four are derived from
  // daily_features, so anything that writes new daily_features rows for
  // a caregiver outside the normal fetch-once flow (reveal-next-day)
  // needs to call this or every other tab keeps showing what was cached
  // before that write.
  invalidateCaregiver: (caregiverId: string) => void

  // Keyed by the days-window string ("7" | "14" | "30") rather than fixed,
  // since Team Risk Heatmap now has its own 7/14/30-day range toggle (see
  // TeamRiskHeatmap.tsx) — same getCached/fetchAndCache pattern as the
  // per-caregiver caches below, just keyed by window instead of by id.
  getCachedRiskHeatmap: (days: string) => RiskHeatmapResponse | undefined
  fetchAndCacheRiskHeatmap: (days: string) => Promise<RiskHeatmapResponse>

  getCachedAssessment: (caregiverId: string) => SimulateResponse | undefined
  fetchAndCacheAssessment: (caregiverId: string) => Promise<SimulateResponse>

  getCachedRiskHistory: (caregiverId: string) => RiskHistoryResponse | undefined
  fetchAndCacheRiskHistory: (caregiverId: string) => Promise<RiskHistoryResponse>

  getCachedCaregiverHistory: (caregiverId: string) => CaregiverHistoryResponse | undefined
  fetchAndCacheCaregiverHistory: (caregiverId: string) => Promise<CaregiverHistoryResponse>

  // A single global resource (not per-id), but kept on the same
  // getCached/fetchAndCache keyed-cache pattern as everything else here —
  // called with one fixed key (see Trends.tsx) — purely so it doesn't need
  // its own bespoke state shape. Deliberately NOT fetched eagerly at
  // Provider mount like me/caregivers/riskSummary: Trends is the one tab a
  // session might never open, so this only fetches the first time that tab
  // actually renders.
  getCachedTeamTrends: (key: string) => TeamTrendsResponse | undefined
  fetchAndCacheTeamTrends: (key: string) => Promise<TeamTrendsResponse>

  // Lazy — only fetched the first time a caregiver's Personal Baseline
  // sub-tab is actually opened (see CaregiverProfiles.tsx), since the
  // backend endpoint re-runs Stage 1 inference per row and is explicitly
  // slower than the other GET endpoints.
  getCachedBaselineHistory: (caregiverId: string) => BaselineHistoryResponse | undefined
  fetchAndCacheBaselineHistory: (caregiverId: string) => Promise<BaselineHistoryResponse>

  // Cross-tab navigation. This module's four tabs are plain ternary
  // branches in Overview.tsx (not real routes), so "navigate to tab X with
  // caregiver Y / filter Z pre-set" needs somewhere shared to live — this
  // context already wraps every tab, so it's the natural place rather than
  // adding a second provider. The pending* fields are one-shot signals: a
  // destination tab reads its relevant pending value as its initial state
  // (the same cache-derived-initial-state pattern used throughout this
  // module) and clears it right after, in a mount-once effect — every tab
  // component here already remounts fresh on every tab switch (the ternary
  // swaps element types), so "read once at mount, then clear" is sufficient
  // and never fights a later manual change by the user.
  activeTab: string
  setActiveTab: (tab: string) => void

  pendingCaregiverId: string | null
  setPendingCaregiverId: (id: string | null) => void

  pendingRiskFilter: string | null
  setPendingRiskFilter: (value: string | null) => void

  pendingWardFilter: string | null
  setPendingWardFilter: (value: string | null) => void
}

export const DeteriorationDataContext = createContext<DeteriorationDataContextValue | null>(null)
