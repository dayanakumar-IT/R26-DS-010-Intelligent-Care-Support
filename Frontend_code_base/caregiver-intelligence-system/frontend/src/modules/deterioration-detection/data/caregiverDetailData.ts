import type {
  BaselineDayPoint,
  CaregiverProfile,
  ModalitySlice,
  ShapContribution,
  VoiceLogEntry,
} from '../types/deterioration.types'

export function buildBaselineSeries(caregiver: CaregiverProfile): BaselineDayPoint[] {
  return caregiver.ward14DayHistory.map((personal, i) => ({
    day: `Day ${i + 1}`,
    personal,
    population:
      caregiver.populationAverage[i] ??
      caregiver.populationAverage[caregiver.populationAverage.length - 1] ??
      0,
  }))
}

export function getShapContributions(caregiver: CaregiverProfile): ShapContribution[] {
  const hrvPull = (55 - caregiver.wearableHRV) / 2.4
  const voicePull = (caregiver.voiceStressProbability - 0.32) * 38
  const surveyPull = (caregiver.surveyScore - 38) * 0.35
  const shiftPull = caregiver.consecutiveHighRiskShifts * 5.2 + Math.max(0, caregiver.shiftsThisWeek - 3) * 2.1
  const baselineGap = Math.max(0, caregiver.deviationFromBaseline) * 0.22
  const scheduleEntropy = caregiver.riskScore * 0.08 - 4

  const raw: ShapContribution[] = [
    { feature: 'Wearable HRV vs. personal baseline', shapValue: Number(hrvPull.toFixed(2)) },
    { feature: 'Acoustic stress (shift communications)', shapValue: Number(voicePull.toFixed(2)) },
    { feature: 'Weekly survey / perceived load', shapValue: Number(surveyPull.toFixed(2)) },
    { feature: 'Consecutive high-risk shift streak', shapValue: Number(shiftPull.toFixed(2)) },
    { feature: 'Deviation from 14-day baseline window', shapValue: Number(baselineGap.toFixed(2)) },
    { feature: 'Schedule entropy (TILES-derived)', shapValue: Number(scheduleEntropy.toFixed(2)) },
  ]

  return [...raw].sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue))
}

export function getModalitySlices(caregiver: CaregiverProfile): ModalitySlice[] {
  const acoustic = caregiver.voiceStressProbability * 42
  const survey = caregiver.surveyScore * 0.42
  const hrv = Math.max(4, 72 - caregiver.wearableHRV) * 0.95
  const schedule = caregiver.shiftsThisWeek * 7 + caregiver.consecutiveHighRiskShifts * 11

  const total = acoustic + survey + hrv + schedule || 1
  const roundPct = (v: number) => Math.max(0, Math.round((v / total) * 100))

  let slices: ModalitySlice[] = [
    { name: 'Acoustic / voice', value: roundPct(acoustic), color: '#7C3AED' },
    { name: 'Survey / self-report', value: roundPct(survey), color: '#2563EB' },
    { name: 'Wearable HRV', value: roundPct(hrv), color: '#DC2626' },
    { name: 'Schedule & shifts', value: roundPct(schedule), color: '#14B8A6' },
  ]

  const sum = slices.reduce((s, x) => s + x.value, 0)
  if (sum !== 100 && slices.length > 0) {
    const diff = 100 - sum
    const maxIdx = slices.reduce((best, cur, i, arr) => (cur.value > arr[best].value ? i : best), 0)
    slices = slices.map((sl, i) => (i === maxIdx ? { ...sl, value: sl.value + diff } : sl))
  }

  return slices
}

export function getVoiceLogs(caregiver: CaregiverProfile): VoiceLogEntry[] {
  const p = Math.round(caregiver.voiceStressProbability * 100)
  const base = caregiver.id

  return [
    {
      id: `${base}-vl-1`,
      recordedAt: 'Today · 06:42',
      excerpt:
        '“…I don’t think we have enough coverage on three — can someone confirm the handoff before I leave?”',
      stressProbability: Math.min(99, p + 4),
      shiftContext: `${caregiver.shift} · handoff`,
    },
    {
      id: `${base}-vl-2`,
      recordedAt: 'Yesterday · 22:18',
      excerpt: '“…vitals are jumping again, I need a second set of eyes in room four…”',
      stressProbability: Math.min(99, p + 1),
      shiftContext: 'Night · ICU corridor',
    },
    {
      id: `${base}-vl-3`,
      recordedAt: '2d ago · 14:05',
      excerpt: '“…sorry, I’m running behind — family questions took longer than expected.”',
      stressProbability: Math.max(8, p - 6),
      shiftContext: `${caregiver.shift} · family update`,
    },
    {
      id: `${base}-vl-4`,
      recordedAt: '3d ago · 08:51',
      excerpt: '“…if we double-book that slot we’re going to burn the whole team out this week.”',
      stressProbability: Math.min(99, p + 2),
      shiftContext: 'Day · staffing board',
    },
    {
      id: `${base}-vl-5`,
      recordedAt: '4d ago · 19:33',
      excerpt: '“…I’m fine, I’m fine — just need ten minutes to reset before the next admit.”',
      stressProbability: Math.max(10, p - 3),
      shiftContext: 'Evening · break room',
    },
  ]
}
