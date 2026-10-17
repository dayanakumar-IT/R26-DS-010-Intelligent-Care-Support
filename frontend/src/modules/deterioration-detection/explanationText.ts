// All plain-English wording for the caregiver page's explanation cards lives
// here, so text can be edited without touching component logic.
//
// Honesty rules these texts follow: plain English, no diagnosis or medical
// claims, every number comes from data passed in (never invented), and the
// model's limits are stated. Threshold numbers are formatted from the single
// source in ./constants rather than typed into sentences.

import { ALERT_LINE, HIGH_RISK_THRESHOLD, MODERATE_RISK_THRESHOLD } from './constants'
import type { RiskLevel } from './constants'

const percent = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`
const signed = (value: number, digits = 1) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}`

export const MODERATE_PCT = percent(MODERATE_RISK_THRESHOLD)
export const HIGH_PCT = percent(HIGH_RISK_THRESHOLD)
export const ALERT_PCT = percent(ALERT_LINE)

// Research figures quoted in the limits text (from the research model
// evaluation, not computed by this app).
export const RESEARCH_ROC_AUC = '0.72'
export const RESEARCH_ALERT_RECALL = 'about 5%'

// ---------------------------------------------------------------------------
// Model features: friendly label, one-sentence meaning, value format.
// Covers all 16 entries of FEATURE_ORDER in main.py.
// ---------------------------------------------------------------------------

export interface FeatureExplanation {
  label: string
  meaning: string
  formatValue: (value: number) => string
}

const bpm = (value: number) => `${Math.round(value)} bpm`
const minutes = (value: number) => `${Math.round(value)} min`

export const FEATURE_EXPLANATIONS: Record<string, FeatureExplanation> = {
  hr_mean: {
    label: 'Average heart rate',
    meaning: "The person's average heart rate across the day, from the wearable.",
    formatValue: bpm,
  },
  hr_std: {
    label: 'How much heart rate varied during the day',
    meaning: 'A higher value means heart rate moved up and down more during the day.',
    formatValue: (value) => `${value.toFixed(1)} bpm`,
  },
  hr_min: {
    label: 'Lowest heart rate of the day',
    meaning: 'The lowest heart rate the wearable recorded that day.',
    formatValue: bpm,
  },
  hr_max: {
    label: 'Highest heart rate of the day',
    meaning: 'The highest heart rate the wearable recorded that day.',
    formatValue: bpm,
  },
  hr_mean_deviation_model: {
    label: "Heart rate compared with the model's expected level",
    meaning:
      "How far the day's average heart rate was above (+) or below (−) the heart rate the model expected for that day.",
    formatValue: (value) => `${signed(value)} bpm`,
  },
  hr_dev_roll3: {
    label: 'Heart-rate trend over the last 3 days',
    meaning:
      "How far this person's daily average heart rate has been above or below their own usual level, averaged over the last 3 days.",
    formatValue: (value) => `${signed(value)} bpm`,
  },
  hr_dev_roll7: {
    label: 'Heart-rate trend over the last 7 days',
    meaning:
      "How far this person's daily average heart rate has been above or below their own usual level, averaged over the last 7 days.",
    formatValue: (value) => `${signed(value)} bpm`,
  },
  number_steps: {
    label: 'Step count',
    meaning: 'Steps recorded by the wearable for the day.',
    formatValue: (value) => `${Math.round(value).toLocaleString()} steps`,
  },
  cardio_minutes: {
    label: 'Cardio-zone minutes',
    meaning: 'Minutes with heart rate in the cardio zone (vigorous effort).',
    formatValue: minutes,
  },
  fat_burn_minutes: {
    label: 'Fat-burn-zone minutes',
    meaning: 'Minutes with heart rate in the fat-burn zone (moderate effort).',
    formatValue: minutes,
  },
  peak_minutes: {
    label: 'Peak-zone minutes',
    meaning: 'Minutes with heart rate in the peak zone (very hard effort).',
    formatValue: minutes,
  },
  out_of_range_minutes: {
    label: 'Minutes below the fat-burn zone',
    meaning: 'Minutes with heart rate below the fat-burn zone, such as rest and light everyday activity.',
    formatValue: minutes,
  },
  resting_heart_rate: {
    label: 'Resting heart rate',
    meaning: "The wearable's estimate of the person's lowest calm heart rate.",
    formatValue: bpm,
  },
  steps_deviation: {
    label: 'Steps compared with usual',
    meaning: "The day's step count minus this person's average step count.",
    formatValue: (value) => `${signed(value, 0)} steps`,
  },
  sleep1efficiency: {
    label: 'Sleep efficiency',
    meaning: 'The share of time in bed the wearable recorded as asleep, for the main sleep.',
    formatValue: (value) => `${Math.round(value)}%`,
  },
  lag1_stress: {
    label: 'Stress on the previous recorded day',
    meaning:
      'Whether the person reported elevated stress (3 or more out of 5) on their previous recorded day: 1 = elevated, 0 = not elevated.',
    formatValue: (value) =>
      value === 1 ? '1 (elevated)' : value === 0 ? '0 (not elevated)' : `${value}`,
  },
}

export function featureLabel(feature: string): string {
  return FEATURE_EXPLANATIONS[feature]?.label ?? 'Another measure'
}

export function featureMeaning(feature: string): string | null {
  return FEATURE_EXPLANATIONS[feature]?.meaning ?? null
}

export function formatFeatureValue(feature: string, value: number | null): string | null {
  if (value === null) return null
  const explanation = FEATURE_EXPLANATIONS[feature]
  return explanation ? explanation.formatValue(value) : null
}

// ---------------------------------------------------------------------------
// Risk levels
// ---------------------------------------------------------------------------

export const RISK_LEVEL_TEXT: Record<RiskLevel, { label: string; emoji: string; tone: 'good' | 'watch' }> = {
  low: { label: 'Low', emoji: '🟢', tone: 'good' },
  moderate: { label: 'Moderate', emoji: '🟡', tone: 'watch' },
  high: { label: 'High', emoji: '🔴', tone: 'watch' },
}

export const RISK_LEVEL_RANGES = `Low is below ${MODERATE_PCT}, Moderate is ${MODERATE_PCT} to ${HIGH_PCT}, High is ${HIGH_PCT} and above.`

// ---------------------------------------------------------------------------
// Overview tab: "Today at a glance"
// ---------------------------------------------------------------------------

export const GLANCE_HEADING = 'Today at a glance'

export const riskScoreCard = {
  title: 'Risk score',
  headline: (probability: number, level: RiskLevel) => `${percent(probability)} · ${RISK_LEVEL_TEXT[level].label}`,
  meaning: (date: string) =>
    `The model's estimated chance that this caregiver would report elevated stress (3 or more out of 5) on ${date}. ${RISK_LEVEL_RANGES}`,
  explainMore: [
    "How it is made: the model combines heart-rate and activity signals from the wearable with the stress the caregiver reported on their previous recorded day.",
    'What it is not: a diagnosis, or a measure of how the person feels.',
    `How good it is: in research testing it ranked stressful days above calm ones with a ROC-AUC of ${RESEARCH_ROC_AUC} (0.5 = chance, 1.0 = perfect). It is a risk-ranking tool, not a yes/no answer.`,
  ],
}

export const STRESS_RATING_LABELS: Record<number, string> = {
  1: 'No stress at all',
  2: 'Very little stress',
  3: 'Some stress',
  4: 'A lot of stress',
  5: 'A great deal of stress',
}

export const lastReportedStressCard = {
  title: 'Last reported stress',
  headline: (rating: number) => {
    const label = STRESS_RATING_LABELS[Math.round(rating)]
    return label ? `${rating} out of 5 · ${label}` : `${rating} out of 5`
  },
  meaning: (date: string) =>
    `What the caregiver themselves reported on ${date} (1 = no stress, 5 = a great deal of stress).`,
}

export const forecastGlanceCard = {
  title: 'Next 7 days forecast',
  headline: (forecast: number) => `${forecast.toFixed(1)} average rating expected`,
  meaning: (low: number, high: number, asOf: string) =>
    `Likely between ${low.toFixed(1)} and ${high.toFixed(1)} (1 = no stress, 5 = a great deal). Made on ${asOf}. An average for the week, not a day-by-day prediction.`,
}

export const trendCard = {
  title: '7-day trend',
  alertLine: (crossed: number, days: number) =>
    crossed === 0
      ? `No day in the last ${days} crossed the alert line (${ALERT_PCT}).`
      : `${crossed} of the last ${days} days crossed the alert line (${ALERT_PCT}).`,
  note: `The alert line is set high. In research testing it caught only ${RESEARCH_ALERT_RECALL} of stressful days, so no alert does not mean no stress. Look at the score and its trend too.`,
  notEnoughHistory: 'Not enough scored days yet to show a trend.',
}

export function trendHeadline(
  direction: 'increasing' | 'stable' | 'decreasing' | undefined,
  pointChange: number | undefined,
): string {
  if (direction === undefined || pointChange === undefined) {
    return 'Not enough earlier days yet to compare this week with the week before.'
  }
  if (direction === 'stable') return 'Risk has been stable compared with the week before.'
  const change = `${Math.abs(pointChange).toFixed(1)} points`
  return direction === 'increasing'
    ? `Risk has gone up by ${change} compared with the week before.`
    : `Risk has gone down by ${change} compared with the week before.`
}

export function assessmentLine(prediction: 0 | 1, date: string, probability: number): string {
  return prediction === 1
    ? `Alert on ${date} (score ${percent(probability)}, alert line ${ALERT_PCT}).`
    : `No alert on ${date} (score ${percent(probability)}, alert line ${ALERT_PCT}).`
}

// ---------------------------------------------------------------------------
// Personal Baseline tab
// ---------------------------------------------------------------------------

// What "expected heart rate" really is (matches main.py's Stage 1:
// _predict_stage1_baseline_hr uses only hr_dev_roll3, hr_dev_roll7 and
// day_of_week — deviations from the person's own average, never their
// absolute level — in a regressor trained across many people).
export const EXPECTED_HR_EXPLANATION = [
  "Expected heart rate is the model's estimate of the day's average heart rate. It comes from a model trained on many people's data.",
  "It does not know this person's usual heart-rate level. It only uses how far their daily average heart rate has been above or below their own average over the last 3 and 7 days, and the day of the week.",
  "So for some people the actual heart rate sits well above or below the expected line almost every day. Comparing a day with this person's usual gap is more useful than the gap on its own.",
]

export const HEART_RATE_INFLUENCES =
  'Many everyday things change heart rate: physical activity during the shift, sleep, illness, caffeine, medication, heat, or how the wearable is worn. This is not a medical judgement.'

export const todayVsExpectedCard = {
  title: 'Today vs expected',
  headline: (actual: number, expected: number) =>
    `Actual ${actual.toFixed(1)} bpm vs expected ${expected.toFixed(1)} bpm (${signed(actual - expected)} bpm)`,
  meaning: (date: string) =>
    `Actual is the wearable's average heart rate on ${date}. Expected is the model's estimate for that day (see "Explain more").`,
}

export const usualGapCard = {
  title: 'Is that gap unusual for this person?',
  headline: (days: number, averageGap: number, todayGap: number, difference: number, closeBpm: number) => {
    const base = `Over ${days} recorded days the gap averaged ${signed(averageGap)} bpm, so today's ${signed(todayGap)} bpm`
    if (Math.abs(difference) < closeBpm) return `${base} is close to this person's usual gap.`
    return `${base} is about ${Math.abs(difference).toFixed(0)} bpm ${difference > 0 ? 'above' : 'below'} this person's usual gap.`
  },
  alwaysLargeNote:
    "A gap that is large every day is this person's normal pattern. Pay attention to days when the gap is bigger than usual.",
  notEnoughDays: 'Not enough recorded days yet to know this person’s usual gap.',
}

export const expectedPhrase = "the model's expected heart rate"

// ---------------------------------------------------------------------------
// Risk History tab
// ---------------------------------------------------------------------------

export const RISK_SERIES_LEGEND = 'Risk score (left axis)'
export const STRESS_SERIES_LEGEND = 'Reported stress (right axis)'

export const howToReadChartCard = {
  title: 'How to read this chart',
  headline: 'Blue line = risk score. Purple dots = the stress the caregiver reported.',
  meaning:
    'The blue line and the left axis show the model’s risk score (percent). The purple dots and the right axis show the stress rating the caregiver reported that day (1 to 5). A dot sitting at 1 means the caregiver reported no stress that day. Gaps are days without a score or a rating.',
  note: 'The two axes start at the same height (0% on the left, 1 on the right) but measure different things.',
}

export const whatChartShowsCard = {
  title: 'What the chart shows',
  riskRange: (low: number, high: number) =>
    low === high ? `Risk was ${percent(low)} over this period` : `Risk stayed between ${percent(low)} and ${percent(high)} over this period`,
  ratings: (noStressDays: number, ratedDays: number) =>
    ` and the caregiver reported stress 1 (no stress) on ${noStressDays} of ${ratedDays} rated days.`,
  noRatings: '. No stress ratings were reported in this period.',
  lag1Dominant:
    'The score barely moves because it relies heavily on the previous reported stress rating.',
  noScores: 'No scored days in this period yet.',
}

// ---------------------------------------------------------------------------
// Workload tab
// ---------------------------------------------------------------------------

// modelUse was verified against the deployed Stage 2 model, not assumed:
// every measure below is one of the 16 model inputs (FEATURE_ORDER in
// main.py), and number_steps, cardio_minutes, peak_minutes and
// out_of_range_minutes are never split on by any of the model's trees, so
// their SHAP contribution is always exactly zero.
export type ModelUse = 'used' | 'not-used' | 'not-input'

export const MODEL_USE_LABEL: Record<ModelUse, string> = {
  used: 'Used by the model',
  'not-used': 'Not used by the model',
  'not-input': 'Not a model input',
}

export interface WorkloadExplanation {
  emoji: string
  meaning: string
  modelUse: ModelUse
}

export const WORKLOAD_EXPLANATIONS: Record<string, WorkloadExplanation> = {
  number_steps: { emoji: '👣', meaning: 'Steps for the day.', modelUse: 'not-used' },
  cardio_minutes: { emoji: '🏃', meaning: 'Heart rate in the cardio zone (vigorous effort).', modelUse: 'not-used' },
  fat_burn_minutes: { emoji: '🚶', meaning: 'Heart rate in the fat-burn zone (moderate effort).', modelUse: 'used' },
  peak_minutes: { emoji: '⚡', meaning: 'Heart rate in the peak zone (very hard effort).', modelUse: 'not-used' },
  out_of_range_minutes: {
    emoji: '🪑',
    meaning: 'Heart rate below the fat-burn zone (rest and light activity).',
    modelUse: 'not-used',
  },
  resting_heart_rate: { emoji: '❤️', meaning: 'The lowest calm heart rate the wearable estimated.', modelUse: 'used' },
}

export const vsUsualText = (changeRatio: number, earlierDays: number) =>
  `${signed(changeRatio * 100, 0)}% vs usual (average of ${earlierDays} earlier days)`

export const aboutWorkloadCard = {
  title: 'About these numbers',
  headline: 'Daily activity and heart-rate measures for the most recent recorded day.',
  meaning: 'Shown for context, next to this person’s own usual level.',
  explainMore: [
    "These numbers come from the caregiver's wearable. They describe activity and heart rate, not how hard the shift was.",
    'They are shown for context. Most of them do not change the risk score: measures marked "Not used by the model" have no effect on it at all.',
  ],
}

// ---------------------------------------------------------------------------
// Explanations tab
// ---------------------------------------------------------------------------

export const factorText = {
  biggestInfluence: (label: string, raises: boolean) =>
    `The biggest influence on today's score is ${label.charAt(0).toLowerCase()}${label.slice(1)}, which pushes the score ${raises ? 'up' : 'down'}.`,
  disclaimer: "How each factor contributed to the model's prediction — not a diagnosis.",
  raisesSentence: "This pushed today's score up.",
  lowersSentence: "This pulled today's score down.",
  valueLabel: 'Value on this day',
  bottomNote: 'These factors explain the model’s score. They do not show why a person feels stressed.',
  increasingHeading: 'Factors increasing risk',
  reducingHeading: 'Factors reducing risk',
}

export const STRENGTH_LABELS = { small: 'Small', moderate: 'Moderate', large: 'Large' } as const
