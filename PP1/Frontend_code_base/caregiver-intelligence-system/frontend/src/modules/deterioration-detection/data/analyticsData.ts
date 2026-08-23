export const WEEKLY_DISTRIBUTION = [
  { week: 'W1', critical: 0, high: 1, moderate: 3, low: 6 },
  { week: 'W2', critical: 0, high: 2, moderate: 3, low: 5 },
  { week: 'W3', critical: 1, high: 2, moderate: 3, low: 4 },
  { week: 'W4', critical: 1, high: 3, moderate: 3, low: 3 },
  { week: 'W5', critical: 1, high: 2, moderate: 4, low: 3 },
  { week: 'W6', critical: 1, high: 3, moderate: 3, low: 3 },
  { week: 'W7', critical: 2, high: 3, moderate: 3, low: 2 },
  { week: 'W8', critical: 2, high: 3, moderate: 3, low: 2 },
  { week: 'W9', critical: 1, high: 3, moderate: 4, low: 2 },
  { week: 'W10', critical: 1, high: 4, moderate: 3, low: 2 },
]

/** Single-stream / fusion F1 benchmarks (accuracy field = bar height; chart uses accuracy dataKey). */
export const MODALITY_PERFORMANCE = [
  {
    modality: 'Wearable HRV (physiological only)',
    accuracy: 68,
    f1: 68,
    precision: 70,
    recall: 66,
    color: '#DC2626',
  },
  {
    modality: 'Acoustic / Voice (audio only)',
    accuracy: 80,
    f1: 80,
    precision: 81,
    recall: 79,
    color: '#7C3AED',
  },
  {
    modality: 'Survey / Self-report',
    accuracy: 65,
    f1: 65,
    precision: 67,
    recall: 63,
    color: '#2563EB',
  },
  {
    modality: 'Schedule Features',
    accuracy: 72,
    f1: 72,
    precision: 73,
    recall: 71,
    color: '#14B8A6',
  },
  {
    modality: 'Late Fusion — All streams',
    accuracy: 86,
    f1: 86,
    precision: 87,
    recall: 85,
    color: '#1E3A8A',
  },
]

/** Bar series legend label (AnalyticsPage Modality Comparison chart). */
export const MODALITY_PERFORMANCE_BAR_LEGEND_LABEL = 'F1 Score %'

/** Italic caption below the modality ablation bar chart. */
export const MODALITY_ABLATION_CAPTION =
  'Late Fusion model (Physiological F1=0.861) outperforms best single modality (Audio F1=0.804) by 6 points. Empirically validates the multimodal fusion approach. Trained on 15 nurses · 13,287 windows · TILES-2018 dataset.'

export type ShiftHeatmapRow = {
  shift: string
  Mon: number
  Tue: number
  Wed: number
  Thu: number
  Fri: number
  Sat: number
  Sun: number
}

export const SHIFT_HEATMAP: ShiftHeatmapRow[] = [
  { shift: 'Day', Mon: 42, Tue: 45, Wed: 48, Thu: 44, Fri: 52, Sat: 38, Sun: 35 },
  { shift: 'Evening', Mon: 51, Tue: 54, Wed: 49, Thu: 56, Fri: 61, Sat: 45, Sun: 42 },
  { shift: 'Night', Mon: 68, Tue: 72, Wed: 65, Thu: 74, Fri: 78, Sat: 58, Sun: 55 },
]

export type ForecastRow = {
  day: string
  actual: number | null
  forecast: number | null
  upper: number | null
  lower: number | null
}

export const FORECAST_DATA: ForecastRow[] = [
  { day: 'Day 1', actual: 57, forecast: null, upper: null, lower: null },
  { day: 'Day 2', actual: 59, forecast: null, upper: null, lower: null },
  { day: 'Day 3', actual: 61, forecast: null, upper: null, lower: null },
  { day: 'Day 4', actual: 58, forecast: null, upper: null, lower: null },
  { day: 'Day 5', actual: 63, forecast: null, upper: null, lower: null },
  { day: 'Day 6', actual: 65, forecast: null, upper: null, lower: null },
  { day: 'Day 7', actual: 64, forecast: null, upper: null, lower: null },
  { day: 'Day 8', actual: null, forecast: 67, upper: 72, lower: 62 },
  { day: 'Day 9', actual: null, forecast: 70, upper: 76, lower: 64 },
  { day: 'Day 10', actual: null, forecast: 68, upper: 75, lower: 61 },
  { day: 'Day 11', actual: null, forecast: 72, upper: 79, lower: 65 },
  { day: 'Day 12', actual: null, forecast: 74, upper: 82, lower: 66 },
  { day: 'Day 13', actual: null, forecast: 71, upper: 79, lower: 63 },
  { day: 'Day 14', actual: null, forecast: 73, upper: 81, lower: 65 },
]

export const WARD_TREND = [
  { week: 'Week 1', 'ICU Ward 3': 42, 'General Ward 7': 35, Rehabilitation: 28 },
  { week: 'Week 2', 'ICU Ward 3': 48, 'General Ward 7': 38, Rehabilitation: 30 },
  { week: 'Week 3', 'ICU Ward 3': 55, 'General Ward 7': 41, Rehabilitation: 27 },
  { week: 'Week 4', 'ICU Ward 3': 61, 'General Ward 7': 44, Rehabilitation: 32 },
  { week: 'Week 5', 'ICU Ward 3': 58, 'General Ward 7': 47, Rehabilitation: 29 },
  { week: 'Week 6', 'ICU Ward 3': 67, 'General Ward 7': 43, Rehabilitation: 31 },
  { week: 'Week 7', 'ICU Ward 3': 72, 'General Ward 7': 49, Rehabilitation: 28 },
  { week: 'Week 8', 'ICU Ward 3': 78, 'General Ward 7': 52, Rehabilitation: 33 },
  { week: 'Week 9', 'ICU Ward 3': 75, 'General Ward 7': 50, Rehabilitation: 30 },
  { week: 'Week 10', 'ICU Ward 3': 80, 'General Ward 7': 55, Rehabilitation: 35 },
]
