export type RiskLevel = 'critical' | 'high' | 'moderate' | 'low'
export type Trend = 'rising' | 'stable' | 'improving'

export interface CaregiverProfile {
  id: string
  name: string
  ward: string
  role: string
  shift: string
  riskScore: number
  riskLevel: RiskLevel
  trend: Trend
  baselineScore: number
  deviationFromBaseline: number
  lastCheckIn: string
  shiftsThisWeek: number
  voiceStressProbability: number
  surveyScore: number
  wearableHRV: number
  consecutiveHighRiskShifts: number
  dataSource: string
  ward14DayHistory: number[]
  populationAverage: number[]
}

export interface AlertItem {
  id: string
  caregiverId: string
  caregiverName: string
  ward: string
  severity: RiskLevel
  message: string
  timestamp: string
}

export interface WardTrendPoint {
  week: string
  'ICU Ward 3': number
  'General Ward 7': number
  Rehabilitation: number
}

export interface BaselineDayPoint {
  day: string
  personal: number
  population: number
}

export interface ShapContribution {
  feature: string
  shapValue: number
}

export interface ModalitySlice {
  name: string
  value: number
  color: string
}

export interface VoiceLogEntry {
  id: string
  recordedAt: string
  excerpt: string
  stressProbability: number
  shiftContext: string
}

export type SuggestionStatus = 'pending' | 'approved' | 'rejected'

export interface RedistributionSuggestion {
  id: string
  fromCaregiverId: string
  fromCaregiverName: string
  fromWard: string
  fromCurrentRisk: number
  fromRiskLevel: RiskLevel
  fromCurrentLoad: number
  fromProjectedRisk: number
  toCaregiverId: string
  toCaregiverName: string
  toWard: string
  toCurrentRisk: number
  toRiskLevel: RiskLevel
  toCurrentLoad: number
  toProjectedLoad: number
  taskDescription: string
  rationale: string
  impactScore: number
  status: SuggestionStatus
  priority: 'urgent' | 'recommended' | 'optional'
}

export interface WorkloadEntry {
  caregiverId: string
  caregiverName: string
  ward: string
  currentLoad: number
  maxLoad: number
  riskLevel: RiskLevel
  riskScore: number
}
