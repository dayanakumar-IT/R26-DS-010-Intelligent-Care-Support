// Module-local API client for the deterioration-detection backend
// (backend_services/deterioration-detection). Deliberately kept inside this
// module rather than in the shared src/services/ folder — it only talks to
// this one component's FastAPI service, not anything shared across modules.
//
// Reuses the shared Supabase client purely to read the current session's
// access token (never mutates it) — every request is sent as
// `Authorization: Bearer <token>`, matching how the backend's
// get_current_user dependency expects to be called.

import { supabase } from '../../../services/supabaseClient'
import type { UserRole } from '../../../types/user'

const API_BASE_URL =
  (import.meta.env.VITE_DETERIORATION_API_URL as string | undefined) ??
  'http://localhost:8000'

export interface MeResponse {
  id: string
  email: string
  name: string
  role: UserRole
  institution: string | null
  ward: string | null
}

export interface CaregiverListItem {
  id: string
  display_name: string
  ward: string | null
  institution: string | null
  data_mode: string
  participant_id: string
  supervisor_id: string | null
  created_at: string
}

export interface DailyFeatureRow {
  feature_date: string
  hr_mean: number | null
  hr_std: number | null
  hr_min: number | null
  hr_max: number | null
  hr_mean_deviation: number | null
  hr_dev_roll3: number | null
  hr_dev_roll7: number | null
  number_steps: number | null
  cardio_minutes: number | null
  fat_burn_minutes: number | null
  peak_minutes: number | null
  out_of_range_minutes: number | null
  resting_heart_rate: number | null
  steps_deviation: number | null
  sleep1efficiency: number | null
}

export interface CentralityRow {
  centrality_date: string
  degree_centrality: number
  weighted_centrality: number
}

export interface ParticipantBaseline {
  id: number
  participant_id: string
  baseline_type: string
  hr_mean_baseline: number
  steps_mean_baseline: number
  computed_from_start: string
  computed_from_end: string
  feature_pipeline_version: string
  created_at: string
}

export interface CaregiverHistoryResponse {
  caregiver: {
    id: string
    display_name: string
    ward: string | null
    data_mode: string
    participant_id: string
    // null when this caregiver has no device_registrations row — display
    // as absent, never fabricated.
    device_id: string | null
    device_type: string | null
  }
  daily_features: DailyFeatureRow[]
  centrality: CentralityRow[]
  baseline: ParticipantBaseline | null
}

export interface SimulateFactor {
  feature: string
  label: string
  shap_value: number
  direction: 'increases_risk' | 'decreases_risk'
}

export interface SimulateRawFeatures {
  hr_mean: number | null
  hr_std: number | null
  hr_min: number | null
  hr_max: number | null
  hr_mean_deviation_model: number | null
  hr_dev_roll3: number | null
  hr_dev_roll7: number | null
  number_steps: number | null
  cardio_minutes: number | null
  fat_burn_minutes: number | null
  peak_minutes: number | null
  out_of_range_minutes: number | null
  resting_heart_rate: number | null
  steps_deviation: number | null
  sleep1efficiency: number | null
  lag1_stress: number | null
}

export interface SimulateResponse {
  caregiver_id: string
  feature_date: string
  risk_probability: number
  risk_prediction: 0 | 1
  top_factor: SimulateFactor
  all_factors: SimulateFactor[]
  raw_features: SimulateRawFeatures
  stage1_predicted_baseline_hr: number
  hr_mean_deviation_model: number
}

export interface ModelPerformanceResponse {
  model_name: string
  version: string
  trained_at: string
  metrics: Record<string, unknown>
}

export interface RiskSummaryCaregiver {
  caregiver_id: string
  display_name: string
  ward: string | null
  latest_risk_probability: number | null
  latest_risk_prediction: 0 | 1 | null
  latest_feature_date: string | null
  top_shap_factor: string | null
  // The second-most-recent scored row's risk_probability — null when
  // fewer than 2 scored rows exist yet (never fabricated as 0 or equal to
  // latest).
  previous_risk_probability: number | null
}

export interface RiskSummaryStats {
  total: number
  high_risk_count: number
  moderate_risk_count: number
  low_risk_count: number
}

export interface RiskSummaryResponse {
  caregivers: RiskSummaryCaregiver[]
  summary: RiskSummaryStats
}

export interface RiskHistoryPoint {
  feature_date: string
  risk_probability: number | null
  risk_prediction: 0 | 1 | null
  top_shap_factor: string | null
}

export interface RiskHistoryResponse {
  caregiver: {
    id: string
    display_name: string
  }
  history: RiskHistoryPoint[]
}

export interface RiskHeatmapDay {
  feature_date: string
  risk_probability: number
}

export interface RiskHeatmapCaregiver {
  caregiver_id: string
  display_name: string
  ward: string | null
  days: RiskHeatmapDay[]
}

export interface RiskHeatmapResponse {
  caregivers: RiskHeatmapCaregiver[]
}

async function authorizedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    throw new Error(`Could not read auth session: ${sessionError.message}`)
  }

  const token = sessionData.session?.access_token
  if (!token) {
    throw new Error('No active session — please log in again.')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error(
      `Could not reach the deterioration-detection service at ${API_BASE_URL}. ` +
        'Is it running, and is VITE_DETERIORATION_API_URL set correctly?',
    )
  }

  if (!response.ok) {
    let detail = `Request to ${path} failed with status ${response.status}.`
    try {
      const body: unknown = await response.json()
      if (
        body &&
        typeof body === 'object' &&
        typeof (body as { detail?: unknown }).detail === 'string'
      ) {
        detail = (body as { detail: string }).detail
      }
    } catch {
      // Response body wasn't JSON — fall back to the generic message above.
    }
    throw new Error(detail)
  }

  return (await response.json()) as T
}

export function getMe(): Promise<MeResponse> {
  return authorizedFetch<MeResponse>('/me')
}

export function getCaregivers(): Promise<CaregiverListItem[]> {
  return authorizedFetch<CaregiverListItem[]>('/caregivers')
}

export function getCaregiverHistory(id: string): Promise<CaregiverHistoryResponse> {
  return authorizedFetch<CaregiverHistoryResponse>(
    `/caregivers/${encodeURIComponent(id)}/history`,
  )
}

export function simulateCaregiver(id: string, date?: string): Promise<SimulateResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return authorizedFetch<SimulateResponse>(
    `/caregivers/${encodeURIComponent(id)}/simulate${query}`,
    { method: 'POST' },
  )
}

export function getModelPerformance(): Promise<ModelPerformanceResponse> {
  return authorizedFetch<ModelPerformanceResponse>('/analytics/model-performance')
}

export function getRiskSummary(): Promise<RiskSummaryResponse> {
  return authorizedFetch<RiskSummaryResponse>('/analytics/risk-summary')
}

export function getRiskHistory(id: string): Promise<RiskHistoryResponse> {
  return authorizedFetch<RiskHistoryResponse>(`/caregivers/${encodeURIComponent(id)}/risk-history`)
}

export function getRiskHeatmap(days: 7 | 14 | 30 = 14): Promise<RiskHeatmapResponse> {
  return authorizedFetch<RiskHeatmapResponse>(`/analytics/risk-heatmap?days=${days}`)
}

export interface WeeklyTrendPoint {
  week_start: string
  avg_risk_probability: number
  high_count: number
  moderate_count: number
  low_count: number
}

export interface TeamTrendsFactorCount {
  factor: string
  count: number
}

export interface WardRiskSummary {
  ward: string
  caregiver_count: number
  high_count: number
  moderate_count: number
  low_count: number
  avg_risk_probability: number
}

export interface WeeklyFactorCounts {
  week_start: string
  factors: TeamTrendsFactorCount[]
}

export interface TeamTrendsResponse {
  weekly: WeeklyTrendPoint[]
  factor_counts: TeamTrendsFactorCount[]
  by_ward: WardRiskSummary[]
  factor_trends_by_week: WeeklyFactorCounts[]
}

export function getTeamTrends(): Promise<TeamTrendsResponse> {
  return authorizedFetch<TeamTrendsResponse>('/analytics/team-trends')
}

export interface BaselineHistoryPoint {
  feature_date: string
  actual_hr: number | null
  expected_hr: number
}

export interface BaselineHistoryResponse {
  history: BaselineHistoryPoint[]
}

// Slower than the other GET endpoints — the backend re-runs Stage 1
// inference per scored row, since stage1_predicted_baseline_hr is never
// persisted. Call this lazily (only when a caregiver's Personal Baseline
// sub-tab is actually opened), not eagerly alongside the rest.
export function getBaselineHistory(id: string): Promise<BaselineHistoryResponse> {
  return authorizedFetch<BaselineHistoryResponse>(
    `/caregivers/${encodeURIComponent(id)}/baseline-history`,
  )
}

export type RedistributionStatus = 'pending' | 'reviewed' | 'dismissed'

export interface RedistributionRecommendation {
  id: string
  flagged_caregiver_id: string
  suggested_caregiver_id: string | null
  flagged_risk_probability: number
  flagged_shift: string | null
  flagged_unit: string | null
  suggested_shift: string | null
  suggested_unit: string | null
  reasoning: string
  status: RedistributionStatus
  generated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  // Joined in server-side for display — the table itself only stores ids.
  flagged_caregiver_name: string | null
  suggested_caregiver_name: string | null
  // Not a persisted column — the table only stores
  // flagged_risk_probability. Looked up fresh (current, not
  // generation-time) by the backend since a suggested candidate's risk
  // was never stored anywhere else. Null exactly when there's no
  // suggested caregiver at all.
  suggested_risk_probability: number | null
}

export interface GenerateRedistributionResponse {
  flagged_count: number
  matched_count: number
  unmatched_count: number
  recommendations: RedistributionRecommendation[]
}

// Admin: evaluates every historical caregiver. Supervisor: evaluates only
// their own caregivers as candidates for flagging — but a match can still
// come from any caregiver regardless of who supervises them, so a
// supervisor may see a suggested candidate that isn't their own.
export function generateRedistributionRecommendations(): Promise<GenerateRedistributionResponse> {
  return authorizedFetch<GenerateRedistributionResponse>(
    '/analytics/generate-redistribution-recommendations',
    { method: 'POST' },
  )
}

export interface RedistributionRecommendationsResponse {
  recommendations: RedistributionRecommendation[]
}

// Admin sees every recommendation; a supervisor sees only rows whose
// *flagged* caregiver is their own.
export function getRedistributionRecommendations(): Promise<RedistributionRecommendationsResponse> {
  return authorizedFetch<RedistributionRecommendationsResponse>('/analytics/redistribution-recommendations')
}

export function markRedistributionRecommendationReviewed(
  id: string,
): Promise<RedistributionRecommendation> {
  return authorizedFetch<RedistributionRecommendation>(
    `/analytics/redistribution-recommendations/${encodeURIComponent(id)}/mark-reviewed`,
    { method: 'POST' },
  )
}

// --- Demo Control (admin-only live demo-reveal feature) ---

export interface UploadRawDataResponse {
  days_staged: number
  date_range: { first: string; last: string }
}

// authorizedFetch doesn't set a Content-Type header itself, so passing a
// FormData body works as-is — the browser sets the correct
// multipart/form-data boundary automatically.
export function uploadRawData(
  caregiverId: string,
  hrFile: File,
  dsFile: File,
): Promise<UploadRawDataResponse> {
  const formData = new FormData()
  formData.append('hr_file', hrFile)
  formData.append('ds_file', dsFile)
  return authorizedFetch<UploadRawDataResponse>(
    `/admin/upload-raw-data/${encodeURIComponent(caregiverId)}`,
    { method: 'POST', body: formData },
  )
}

export interface UploadSurveyResponsesResponse {
  dates_matched: number
  dates_in_file_with_no_staged_row: number
}

export function uploadSurveyResponses(
  caregiverId: string,
  emaFile: File,
): Promise<UploadSurveyResponsesResponse> {
  const formData = new FormData()
  formData.append('ema_file', emaFile)
  return authorizedFetch<UploadSurveyResponsesResponse>(
    `/admin/upload-survey-responses/${encodeURIComponent(caregiverId)}`,
    { method: 'POST', body: formData },
  )
}

export interface RevealNextDayResponse {
  revealed_date: string
  day_number: number
  enough_history_for_prediction: boolean
  // Null on days 1-7 (fewer than 7 prior revealed days); real once this
  // day itself is the 8th or later reveal.
  risk_probability: number | null
  risk_prediction: 0 | 1 | null
  top_shap_factor: string | null
}

export function revealNextDay(caregiverId: string): Promise<RevealNextDayResponse> {
  return authorizedFetch<RevealNextDayResponse>(
    `/admin/reveal-next-day/${encodeURIComponent(caregiverId)}`,
    { method: 'POST' },
  )
}

export interface StagingStatusDay {
  feature_date: string
  revealed: boolean
  hr_mean_full: number | null
  number_steps: number | null
  sleep1efficiency: number | null
  // Null means "did not answer" for that day — never fabricated.
  real_stress: number | null
}

export interface StagingStatusResponse {
  total_staged: number
  revealed_count: number
  days: StagingStatusDay[]
}

export function getStagingStatus(caregiverId: string): Promise<StagingStatusResponse> {
  return authorizedFetch<StagingStatusResponse>(
    `/admin/staging-status/${encodeURIComponent(caregiverId)}`,
  )
}
