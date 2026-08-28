const BASE = 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export interface Room {
  id: number
  room_code: string
  ward: string | null
  camera_src: string | null
  caregiver_id: string | null
  zone_config: unknown | null
  created_at: string
}

export interface Patient {
  id: number
  patient_code: string
  gender: 'M' | 'F' | 'Other' | null
  room_id: string | null
  created_at: string
}

export interface Alert {
  id: number
  patient_id: number | null
  room_id: number | null
  timestamp: string
  risk_score: number
  risk_level: 'MODERATE' | 'HIGH'
  posture: string | null
  key_factors: string[]
  acknowledged: boolean
  ack_by: string | null
  ack_at: string | null
  r2_replay_key: string | null
  created_at: string
}

export interface DashboardSummary {
  total_rooms: number
  total_patients: number
  total_alerts: number
  unacknowledged_alerts: number
  high_alerts_today: number
  patients_by_level: Record<string, number>
}

export const api = {
  getDashboard: () => request<DashboardSummary>('/api/dashboard/summary'),
  getRooms: () => request<Room[]>('/api/rooms'),
  getPatients: () => request<Patient[]>('/api/patients'),
  getAlerts: () => request<Alert[]>('/api/alerts'),
  acknowledgeAlert: (id: number) =>
    request<Alert>(`/api/alerts/${id}/acknowledge`, { method: 'PATCH' }),
}
