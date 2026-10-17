// Shared risk-history calculations for the caregiver page. computeSevenDayTrend
// was moved here unchanged from CaregiverProfiles.tsx so the existing 7-day
// trend card and the "Today at a glance" trend card use one implementation.

import type { RiskHistoryResponse } from './services/api'

// Percentage-point threshold below which a 7-day-vs-previous-7-day change
// reads as "Stable" rather than naming a direction — a plain, explicit
// judgment call (not derived from any research), chosen the same way the
// backend's own risk-tier thresholds document their reasoning: small
// enough to catch a genuine shift, large enough not to flag routine
// day-to-day noise as a trend.
export const TREND_STABLE_THRESHOLD_POINTS = 3

const TREND_WINDOW_DAYS = 7

export interface SevenDayTrend {
  // 'not-enough-history': fewer than 7 scored days exist at all.
  // 'not-enough-comparison': 7+ scored days exist, but fewer than 14, so
  // there's no full prior 7-day window to compare against.
  // 'ok': a full comparison was computed.
  status: 'not-enough-history' | 'not-enough-comparison' | 'ok'
  direction?: 'increasing' | 'stable' | 'decreasing'
  pointChange?: number
  elevatedCount?: number
}

export function computeSevenDayTrend(history: RiskHistoryResponse['history']): SevenDayTrend {
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

// How many of the most recent scored days (up to 7) crossed the model's
// alert line — i.e. had risk_prediction 1. Null when nothing is scored.
export function countRecentAlerts(history: RiskHistoryResponse['history']): { crossed: number; days: number } | null {
  const recent = history.filter((point) => point.risk_probability !== null).slice(-TREND_WINDOW_DAYS)
  if (recent.length === 0) return null
  return { crossed: recent.filter((point) => point.risk_prediction === 1).length, days: recent.length }
}

// The most recent day with a reported stress rating, or null if none.
export function latestReportedStress(history: RiskHistoryResponse['history']): { date: string; rating: number } | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const point = history[index]!
    if (point.actual_stress !== null) return { date: point.feature_date, rating: point.actual_stress }
  }
  return null
}
