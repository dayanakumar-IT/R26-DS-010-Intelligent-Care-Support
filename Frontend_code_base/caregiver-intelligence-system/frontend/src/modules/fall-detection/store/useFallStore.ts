import { create } from 'zustand'
import type { Patient, FallAlert, RiskLevel, PatientStatus } from '../types'
import { PATIENTS as SEED_PATIENTS, ALERTS as SEED_ALERTS } from '../data/mockData'

let alertSeq = SEED_ALERTS.length + 1

function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
}
function nowDate() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
}

function levelFromScore(s: number): RiskLevel {
  return s >= 71 ? 'High Risk' : s >= 41 ? 'Moderate Risk' : 'Low Risk'
}
function statusFromScore(s: number): PatientStatus {
  return s >= 71 ? 'Alert' : s >= 41 ? 'Monitoring' : 'Normal'
}

function liveUpdate(p: Patient): Patient {
  // Larger noise so scores regularly cross the 41/71 thresholds, producing visible level changes
  const bias  = p.riskLevel === 'High Risk' ? 1.2 : p.riskLevel === 'Moderate Risk' ? 0.2 : -0.6
  const noise = (Math.random() - 0.5) * 16
  const newScore = Math.max(5, Math.min(100, Math.round(p.riskScore + noise + bias)))
  const newTrend = [...p.trend.slice(1), newScore]
  const newConf  = Math.max(0.6, Math.min(0.99, p.confidence + (Math.random() - 0.5) * 0.015))
  const newLevel  = levelFromScore(newScore)
  const newStatus = statusFromScore(newScore)
  return {
    ...p,
    riskScore: newScore,
    riskLevel: newLevel,
    status: newStatus,
    trend: newTrend,
    confidence: parseFloat(newConf.toFixed(2)),
    lastUpdated: nowTime(),
    trendChange: newScore - p.trend[0],
  }
}

const ALERT_TYPES: Record<string, string> = {
  'High Risk':     'Risk Escalation',
  'Moderate Risk': 'Early Warning',
  'Low Risk':      'Stability Restored',
}
const ALERT_DESC: Record<string, string[]> = {
  'High Risk':     ['Rapid increase in instability', 'Abnormal gait pattern detected', 'Prolonged body sway', 'Sudden balance loss'],
  'Moderate Risk': ['Gradual instability buildup', 'Posture transition risk', 'Micro-movement instability'],
  'Low Risk':      ['Risk score returned to safe range', 'Movement stabilised'],
}

interface FallStore {
  patients: Patient[]
  alerts: FallAlert[]
  lastUpdate: Date
  edgeConnected: boolean

  // Actions
  acknowledgeAlert: (id: string) => void
  resolveAlert: (id: string) => void
  setAlerts: (updater: (prev: FallAlert[]) => FallAlert[]) => void

  // Real-time
  tick: () => void
  startLive: () => () => void
}

export const useFallStore = create<FallStore>((set, get) => ({
  patients: SEED_PATIENTS.map(p => ({ ...p })),
  alerts: SEED_ALERTS.map(a => ({ ...a })),
  lastUpdate: new Date(),
  edgeConnected: true,

  acknowledgeAlert: (id) =>
    set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'Acknowledged' as const } : a) })),

  resolveAlert: (id) =>
    set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'Resolved' as const } : a) })),

  setAlerts: (updater) =>
    set(s => ({ alerts: updater(s.alerts) })),

  tick: () => {
    const { patients, alerts } = get()

    // Update 10 random patients per tick for faster visible changes
    const indices = new Set<number>()
    while (indices.size < 10) indices.add(Math.floor(Math.random() * patients.length))

    const updatedPatients = patients.map((p, i) => indices.has(i) ? liveUpdate(p) : p)

    // Detect escalation: patient crossed into High Risk
    const newAlerts: FallAlert[] = []
    updatedPatients.forEach((np, i) => {
      const prev = patients[i]
      if (np.riskLevel === 'High Risk' && prev.riskLevel !== 'High Risk') {
        const descs = ALERT_DESC['High Risk']
        newAlerts.push({
          id: `A${String(alertSeq++).padStart(3, '0')}`,
          patientId: np.id, patientName: np.name,
          room: np.room, bed: np.bed, riskLevel: 'High Risk',
          alertType: ALERT_TYPES['High Risk'],
          description: descs[Math.floor(Math.random() * descs.length)],
          time: nowTime(), date: nowDate(), status: 'New',
        })
      }
    })

    set({
      patients: updatedPatients,
      alerts: newAlerts.length > 0 ? [...newAlerts, ...alerts].slice(0, 30) : alerts,
      lastUpdate: new Date(),
    })
  },

  startLive: () => {
    const id = setInterval(() => get().tick(), 2500)
    return () => clearInterval(id)
  },
}))
