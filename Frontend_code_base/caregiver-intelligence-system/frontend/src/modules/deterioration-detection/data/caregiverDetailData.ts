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

/** Real TreeExplainer SHAP rows per nurse (from shap_by_nurse.json). */
export const NURSE_PHYSIO_SHAP_DATA: Record<
  string,
  { features: string[]; values: number[]; n_windows: number }
> = {
  F5: {
    features: ['eda_peaks_count', 'temp_mean', 'eda_min', 'eda_max', 'temp_std'],
    values: [0.4794, 0.2344, 0.1853, 0.1781, 0.1416],
    n_windows: 656,
  },
  '7A': {
    features: ['eda_peaks_count', 'temp_mean', 'temp_std', 'eda_min', 'eda_max'],
    values: [0.5488, 0.2555, 0.2187, 0.1752, 0.1164],
    n_windows: 1617,
  },
  '5C': {
    features: ['temp_mean', 'eda_mean', 'eda_peaks_count', 'eda_max', 'eda_min'],
    values: [0.5305, 0.3349, 0.28, 0.2085, 0.2009],
    n_windows: 950,
  },
  '6B': {
    features: ['temp_mean', 'eda_peaks_count', 'eda_max', 'eda_range', 'eda_mean'],
    values: [0.6281, 0.5524, 0.3715, 0.1405, 0.1341],
    n_windows: 928,
  },
  '94': {
    features: ['eda_peaks_count', 'temp_mean', 'temp_std', 'eda_min', 'eda_std'],
    values: [0.3836, 0.2217, 0.2001, 0.1854, 0.1184],
    n_windows: 702,
  },
  '7E': {
    features: ['eda_peaks_count', 'eda_mean', 'eda_max', 'temp_mean', 'eda_min'],
    values: [0.4091, 0.2103, 0.2032, 0.1646, 0.1588],
    n_windows: 315,
  },
  '83': {
    features: ['eda_peaks_count', 'eda_min', 'temp_mean', 'temp_std', 'temp_slope'],
    values: [0.502, 0.2125, 0.1656, 0.1473, 0.1372],
    n_windows: 1564,
  },
  '8B': {
    features: ['eda_peaks_count', 'temp_std', 'temp_mean', 'eda_min', 'eda_max'],
    values: [0.4809, 0.2195, 0.1844, 0.1466, 0.1294],
    n_windows: 541,
  },
  '6D': {
    features: ['temp_mean', 'eda_mean', 'eda_peaks_count', 'eda_max', 'eda_min'],
    values: [0.748, 0.3351, 0.3089, 0.2253, 0.1784],
    n_windows: 637,
  },
  BG: {
    features: ['eda_peaks_count', 'temp_mean', 'eda_min', 'temp_slope', 'temp_std'],
    values: [0.4947, 0.3385, 0.1467, 0.1336, 0.1328],
    n_windows: 744,
  },
  CE: {
    features: ['eda_mean', 'eda_max', 'temp_mean', 'eda_peaks_count', 'eda_range'],
    values: [0.811, 0.5301, 0.3615, 0.3016, 0.1644],
    n_windows: 887,
  },
  DF: {
    features: ['eda_mean', 'temp_mean', 'eda_max', 'eda_peaks_count', 'eda_std'],
    values: [0.5641, 0.36, 0.2904, 0.2701, 0.2474],
    n_windows: 1004,
  },
  E4: {
    features: ['eda_peaks_count', 'eda_min', 'temp_mean', 'temp_std', 'eda_max'],
    values: [0.4993, 0.3364, 0.2108, 0.1908, 0.1424],
    n_windows: 1747,
  },
  EG: {
    features: ['eda_peaks_count', 'temp_mean', 'eda_mean', 'temp_slope', 'eda_range'],
    values: [0.4578, 0.3558, 0.1702, 0.138, 0.1358],
    n_windows: 593,
  },
  '15': {
    features: ['eda_peaks_count', 'temp_mean', 'eda_min', 'temp_std', 'eda_max'],
    values: [0.5231, 0.2572, 0.1843, 0.1749, 0.1411],
    n_windows: 402,
  },
}

/** Profile route IDs → nurse code in `NURSE_PHYSIO_SHAP_DATA`. */
const CAREGIVER_ID_TO_SHAP_NURSE_KEY: Record<string, string> = {
  'CG-001': 'F5',
  'CG-002': '7A',
  'CG-003': '5C',
  'CG-004': '6B',
  'CG-005': '94',
  'CG-006': '7E',
  'CG-007': '83',
  'CG-008': '6D',
  'CG-009': 'BG',
  'CG-010': '15',
}

export function getPhysiologicalShapBundle(caregiver: CaregiverProfile): {
  contributions: ShapContribution[]
  nurseId: string
  nWindows: number
} {
  const nurseId = CAREGIVER_ID_TO_SHAP_NURSE_KEY[caregiver.id] ?? 'F5'
  const block = NURSE_PHYSIO_SHAP_DATA[nurseId]
  if (!block) {
    return { contributions: [], nurseId, nWindows: 0 }
  }
  const contributions: ShapContribution[] = block.features.map((feature, i) => ({
    feature,
    shapValue: Number(block.values[i]?.toFixed(4) ?? 0),
  }))
  return { contributions, nurseId, nWindows: block.n_windows }
}

/** Used by ModalityBreakdown subtitle (two-stream late fusion). */
export const MODALITY_CONTRIBUTION_SUBTITLE =
  'Late fusion weights derived from validated model F1 scores · Physiological F1=0.861 · Audio F1=0.804'

export function getModalitySlices(_caregiver: CaregiverProfile): ModalitySlice[] {
  return [
    {
      name: 'Physiological model · EDA + HRV features · 51.7%',
      value: 51.7,
      color: '#4F46E5',
    },
    {
      name: 'Audio / Acoustic model · voice stress · 48.3%',
      value: 48.3,
      color: '#14B8A6',
    },
  ]
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
