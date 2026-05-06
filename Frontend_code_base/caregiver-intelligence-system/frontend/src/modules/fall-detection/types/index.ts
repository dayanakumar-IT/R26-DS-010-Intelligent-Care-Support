export type RiskLevel = 'Low Risk' | 'Moderate Risk' | 'High Risk'
export type PostureType = 'Lying' | 'Sitting' | 'Standing' | 'Walking'
export type PatientStatus = 'Normal' | 'Monitoring' | 'Alert' | 'Recovery'
export type AlertStatus = 'New' | 'Acknowledged' | 'Resolved'
export type FallTab = 'dashboard' | 'room-overview' | 'alerts-risk' | 'event-replay' | 'reports' | 'settings'
export type PatientDetailTab = 'overview' | 'live-view' | 'history' | 'replay' | 'analytics'

export interface Patient {
  id: string
  name: string
  age: number
  gender: 'Male' | 'Female'
  room: string
  roomId: string
  bed: string
  riskLevel: RiskLevel
  riskScore: number
  posture: PostureType
  status: PatientStatus
  lastUpdated: string
  confidence: number
  trend: number[]
  trendChange: number
  bodyTilt: number
  speed: number
}

export interface RoomData {
  id: string
  name: string
  totalBeds: number
  lowRisk: number
  moderateRisk: number
  highRisk: number
  alerts: number
  bedsOccupied: number
  bedsAvailable: number
}

export interface FallAlert {
  id: string
  patientId: string
  patientName: string
  room: string
  bed: string
  riskLevel: RiskLevel
  alertType: string
  description: string
  time: string
  date: string
  status: AlertStatus
}

export interface RecordedEvent {
  id: string
  patientId: string
  patientName: string
  room: string
  bed: string
  riskLevel: RiskLevel
  time: string
  date: string
  duration: string
}

export interface HistoryEntry {
  time: string
  event: string
  riskLevel: RiskLevel
  riskScore: number
  duration: string
}
