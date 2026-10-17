// Plain-English explanation card groups for the caregiver page's sub-tabs,
// all built from the one shared ExplainCard template. Wording lives in
// ../explanationText.ts; every number shown comes from the data passed in,
// and anything missing is simply not shown.

import { useEffect, useState } from 'react'
import ExplainCard from './ExplainCard'
import { riskLevelOf } from '../constants'
import { useDeteriorationData } from '../context/useDeteriorationData'
import {
  EXPECTED_HR_EXPLANATION,
  GLANCE_HEADING,
  HEART_RATE_INFLUENCES,
  RISK_LEVEL_TEXT,
  STRENGTH_LABELS,
  factorText,
  featureLabel,
  featureMeaning,
  forecastGlanceCard,
  formatFeatureValue,
  howToReadChartCard,
  lastReportedStressCard,
  riskScoreCard,
  todayVsExpectedCard,
  trendCard,
  trendHeadline,
  usualGapCard,
  whatChartShowsCard,
} from '../explanationText'
import { computeSevenDayTrend, countRecentAlerts, latestReportedStress } from '../riskTrend'
import { getForecast, isForecastInsufficient } from '../services/api'
import type {
  BaselineHistoryPoint,
  ForecastLatest,
  RiskHistoryResponse,
  SimulateFactor,
  SimulateRawFeatures,
  SimulateResponse,
} from '../services/api'
import styles from './CaregiverExplanations.module.css'

// Personal Baseline: a gap within this many bpm of the person's usual gap
// reads as "close to usual".
const CLOSE_TO_USUAL_GAP_BPM = 2
// Minimum recorded days before a "usual gap" is worth stating.
const MIN_USUAL_GAP_DAYS = 7
// "Large almost every day": at least this share of days have a gap of at
// least LARGE_GAP_BPM in the same direction as the average gap.
const LARGE_GAP_BPM = 10
const LARGE_GAP_SHARE = 0.8

// Explanations: a factor's strength relative to the largest factor.
const LARGE_STRENGTH_RATIO = 0.66
const MODERATE_STRENGTH_RATIO = 0.33
const FACTORS_PER_GROUP = 3

// Risk History: the "barely moves" sentence is added only when the stored
// top factor is lag1_stress on more than this share of scored days shown.
const LAG1_DOMINANT_SHARE = 0.5

function Paragraphs({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Overview tab: "Today at a glance"
// ---------------------------------------------------------------------------

export function TodayAtAGlance({
  caregiverId,
  assessment,
  riskHistory,
}: {
  caregiverId: string
  assessment: SimulateResponse | null
  riskHistory: RiskHistoryResponse | null
}) {
  const { forecastRefreshKey } = useDeteriorationData()
  const [forecast, setForecast] = useState<ForecastLatest | null>(null)

  // The forecast card is optional: any failure (including the endpoint not
  // existing on an older backend) just means the card isn't shown.
  useEffect(() => {
    let isCurrent = true
    getForecast(caregiverId)
      .then((result) => {
        if (isCurrent) setForecast(isForecastInsufficient(result.latest) ? null : result.latest)
      })
      .catch(() => {
        if (isCurrent) setForecast(null)
      })
    return () => {
      isCurrent = false
    }
  }, [caregiverId, forecastRefreshKey])

  const level = assessment ? riskLevelOf(assessment.risk_probability) : null
  const lastStress = riskHistory ? latestReportedStress(riskHistory.history) : null
  const trend = riskHistory ? computeSevenDayTrend(riskHistory.history) : null
  const alerts = riskHistory ? countRecentAlerts(riskHistory.history) : null

  return (
    <div>
      <p className={styles.heading}>{GLANCE_HEADING}</p>
      <div className={styles.grid}>
        {assessment && level && (
          <ExplainCard
            emoji={RISK_LEVEL_TEXT[level].emoji}
            title={riskScoreCard.title}
            tone={RISK_LEVEL_TEXT[level].tone}
            headline={riskScoreCard.headline(assessment.risk_probability, level)}
            meaning={riskScoreCard.meaning(assessment.feature_date)}
            explainMore={<Paragraphs lines={riskScoreCard.explainMore} />}
          />
        )}

        {lastStress && (
          <ExplainCard
            emoji="🗣️"
            title={lastReportedStressCard.title}
            headline={lastReportedStressCard.headline(lastStress.rating)}
            meaning={lastReportedStressCard.meaning(lastStress.date)}
          />
        )}

        {forecast && (
          <ExplainCard
            emoji="🔮"
            title={forecastGlanceCard.title}
            headline={forecastGlanceCard.headline(forecast.forecast)}
            meaning={forecastGlanceCard.meaning(forecast.low, forecast.high, forecast.as_of)}
          />
        )}

        {trend && (
          <ExplainCard
            emoji={trend.direction === 'increasing' ? '📈' : trend.direction === 'decreasing' ? '📉' : '➡️'}
            title={trendCard.title}
            tone={trend.direction === 'increasing' ? 'watch' : 'info'}
            headline={
              trend.status === 'not-enough-history'
                ? trendCard.notEnoughHistory
                : trendHeadline(trend.direction, trend.pointChange)
            }
            meaning={alerts ? trendCard.alertLine(alerts.crossed, alerts.days) : undefined}
            note={trendCard.note}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Personal Baseline tab
// ---------------------------------------------------------------------------

export function BaselineExplanations({
  assessment,
  baselineHistory,
}: {
  assessment: SimulateResponse | null
  baselineHistory: BaselineHistoryPoint[] | null
}) {
  const actual = assessment?.raw_features.hr_mean ?? null
  const expected = assessment?.stage1_predicted_baseline_hr ?? null
  const todayGap = actual !== null && expected !== null ? actual - expected : null

  const gaps = (baselineHistory ?? [])
    .filter((point) => point.actual_hr !== null)
    .map((point) => point.actual_hr! - point.expected_hr)
  const averageGap = gaps.length >= MIN_USUAL_GAP_DAYS ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : null
  const alwaysLarge =
    averageGap !== null &&
    gaps.filter((gap) => Math.sign(gap) === Math.sign(averageGap) && Math.abs(gap) >= LARGE_GAP_BPM).length /
      gaps.length >=
      LARGE_GAP_SHARE

  if (todayGap === null || actual === null || expected === null || !assessment) return null

  return (
    <div className={styles.grid}>
      <ExplainCard
        emoji="💓"
        title={todayVsExpectedCard.title}
        headline={todayVsExpectedCard.headline(actual, expected)}
        meaning={todayVsExpectedCard.meaning(assessment.feature_date)}
        explainMore={<Paragraphs lines={EXPECTED_HR_EXPLANATION} />}
      />

      {baselineHistory !== null && (
        <ExplainCard
          emoji="📏"
          title={usualGapCard.title}
          tone={averageGap !== null && Math.abs(todayGap - averageGap) >= LARGE_GAP_BPM ? 'watch' : 'info'}
          headline={
            averageGap === null
              ? usualGapCard.notEnoughDays
              : usualGapCard.headline(gaps.length, averageGap, todayGap, todayGap - averageGap, CLOSE_TO_USUAL_GAP_BPM)
          }
          meaning={alwaysLarge ? usualGapCard.alwaysLargeNote : undefined}
          explainMore={<Paragraphs lines={[...EXPECTED_HR_EXPLANATION.slice(1), HEART_RATE_INFLUENCES]} />}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Risk History tab
// ---------------------------------------------------------------------------

export function RiskHistoryExplanations({ points }: { points: RiskHistoryResponse['history'] }) {
  const scored = points.filter((point) => point.risk_probability !== null)
  const rated = points.filter((point) => point.actual_stress !== null)
  const withFactor = scored.filter((point) => point.top_shap_factor !== null)
  const lag1Dominant =
    withFactor.length > 0 &&
    withFactor.filter((point) => point.top_shap_factor === 'lag1_stress').length / withFactor.length >
      LAG1_DOMINANT_SHARE

  let summary: string = whatChartShowsCard.noScores
  if (scored.length > 0) {
    const values = scored.map((point) => point.risk_probability!)
    summary =
      whatChartShowsCard.riskRange(Math.min(...values), Math.max(...values)) +
      (rated.length > 0
        ? whatChartShowsCard.ratings(rated.filter((point) => point.actual_stress === 1).length, rated.length)
        : whatChartShowsCard.noRatings)
  }

  return (
    <div className={`${styles.grid} ${styles.afterChart}`}>
      <ExplainCard
        emoji="📖"
        title={howToReadChartCard.title}
        headline={howToReadChartCard.headline}
        meaning={howToReadChartCard.meaning}
        note={howToReadChartCard.note}
      />
      <ExplainCard
        emoji="🔎"
        title={whatChartShowsCard.title}
        headline={summary}
        meaning={lag1Dominant ? whatChartShowsCard.lag1Dominant : undefined}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Explanations tab
// ---------------------------------------------------------------------------

function strengthOf(shapValue: number, largest: number): string | null {
  if (largest <= 0) return null
  const ratio = Math.abs(shapValue) / largest
  if (ratio >= LARGE_STRENGTH_RATIO) return STRENGTH_LABELS.large
  if (ratio >= MODERATE_STRENGTH_RATIO) return STRENGTH_LABELS.moderate
  return STRENGTH_LABELS.small
}

function rawValueOf(rawFeatures: SimulateRawFeatures, feature: string): number | null {
  return feature in rawFeatures ? rawFeatures[feature as keyof SimulateRawFeatures] : null
}

function FactorCard({
  factor,
  largest,
  rawFeatures,
}: {
  factor: SimulateFactor
  largest: number
  rawFeatures: SimulateRawFeatures
}) {
  const raises = factor.shap_value > 0
  const strength = strengthOf(factor.shap_value, largest)
  const value = formatFeatureValue(factor.feature, rawValueOf(rawFeatures, factor.feature))
  const meaning = featureMeaning(factor.feature)

  return (
    <ExplainCard
      emoji={raises ? '↑' : '↓'}
      title={`${raises ? 'Raises' : 'Lowers'} the score${strength ? ` · ${strength}` : ''}`}
      tone={raises ? 'watch' : 'good'}
      headline={featureLabel(factor.feature)}
      meaning={
        <>
          {value && (
            <>
              {factorText.valueLabel}: <strong>{value}</strong>.{' '}
            </>
          )}
          {raises ? factorText.raisesSentence : factorText.lowersSentence}
        </>
      }
      explainMore={meaning ? <p>{meaning}</p> : undefined}
    />
  )
}

export function FactorExplanations({ assessment }: { assessment: SimulateResponse }) {
  // all_factors arrives sorted by |shap_value|, largest first. Factors with
  // exactly zero contribution had no effect on this score, so they're left
  // out of both lists rather than shown as "reducing" it.
  const contributing = assessment.all_factors.filter((factor) => factor.shap_value !== 0)
  const largest = contributing.length > 0 ? Math.abs(contributing[0]!.shap_value) : 0
  const top = contributing[0]
  const increasing = contributing.filter((factor) => factor.shap_value > 0).slice(0, FACTORS_PER_GROUP)
  const reducing = contributing.filter((factor) => factor.shap_value < 0).slice(0, FACTORS_PER_GROUP)

  return (
    <div className={styles.factorSections}>
      {top && (
        <p className={styles.factorHeadline}>
          {factorText.biggestInfluence(featureLabel(top.feature), top.shap_value > 0)}
        </p>
      )}
      <p className={styles.disclaimer}>{factorText.disclaimer}</p>

      {increasing.length > 0 && (
        <div>
          <p className={`${styles.groupHeading} ${styles.groupHeadingIncreasing}`}>{factorText.increasingHeading}</p>
          <div className={styles.grid}>
            {increasing.map((factor) => (
              <FactorCard key={factor.feature} factor={factor} largest={largest} rawFeatures={assessment.raw_features} />
            ))}
          </div>
        </div>
      )}

      {reducing.length > 0 && (
        <div>
          <p className={`${styles.groupHeading} ${styles.groupHeadingReducing}`}>{factorText.reducingHeading}</p>
          <div className={styles.grid}>
            {reducing.map((factor) => (
              <FactorCard key={factor.feature} factor={factor} largest={largest} rawFeatures={assessment.raw_features} />
            ))}
          </div>
        </div>
      )}

      <p className={styles.bottomNote}>{factorText.bottomNote}</p>
    </div>
  )
}
