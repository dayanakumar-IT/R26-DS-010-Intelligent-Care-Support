import { create } from 'zustand'
import type { Patient, FallAlert, RiskLevel, PatientStatus, PoseQuality, ZoneType } from '../types'
import { PATIENTS as SEED_PATIENTS, ALERTS as SEED_ALERTS } from '../data/mockData'
import { loadManifest, type DemoManifest, type DemoEntry } from '../data/demoFeed'

let alertSeq = SEED_ALERTS.length + 1

// Sustained moderate-risk window: ~12 seconds (5 ticks × 2.5s) before firing a Moderate alert
const MODERATE_TICKS_REQUIRED = 5

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

function zoneFromPosture(p: Patient['posture']): ZoneType {
  return p === 'Lying' ? 'Bed' : p === 'Sitting' ? 'Chair' : 'Walking'
}

function liveUpdate(p: Patient): Patient {
  // Force overridden patients (P006/P018) to keep their static quality state for demo
  const fixedQuality = p.id === 'P006' ? 'Degraded' as PoseQuality
                     : p.id === 'P018' ? 'Unavailable' as PoseQuality
                     : null

  // Quality-degraded patients suppress micro-instability features → smaller noise
  // Quality-unusable patients are explicitly not scored (frozen)
  if (fixedQuality === 'Unavailable') {
    return { ...p, poseQuality: 'Unavailable', lastUpdated: nowTime() }
  }

  const noiseScale = fixedQuality === 'Degraded' ? 8 : 16
  const bias  = p.riskLevel === 'High Risk' ? 1.2 : p.riskLevel === 'Moderate Risk' ? 0.2 : -0.6
  const noise = (Math.random() - 0.5) * noiseScale
  const newScore = Math.max(5, Math.min(100, Math.round(p.riskScore + noise + bias)))
  const newTrend = [...p.trend.slice(1), newScore]
  const newConf  = Math.max(0.6, Math.min(0.99, p.confidence + (Math.random() - 0.5) * 0.015))
  const newLevel  = levelFromScore(newScore)
  const newStatus = statusFromScore(newScore)

  // Slight motion-dynamics drift to make the panel feel alive
  const drift = () => (Math.random() - 0.5) * 0.05
  const newAccel  = Math.max(0.02, +(p.acceleration + drift()).toFixed(2))
  const newDrop   = Math.max(0.00, +(p.verticalDrop + drift() * 0.4).toFixed(2))
  const newAsym   = Math.max(2, Math.min(60, Math.round(p.balanceAsymmetry + (Math.random() - 0.5) * 3)))

  return {
    ...p,
    riskScore: newScore,
    riskLevel: newLevel,
    status: newStatus,
    trend: newTrend,
    confidence: parseFloat(newConf.toFixed(2)),
    lastUpdated: nowTime(),
    trendChange: newScore - p.trend[0],
    poseQuality: fixedQuality ?? 'Good',
    zone: zoneFromPosture(p.posture),
    acceleration: newAccel,
    verticalDrop: newDrop,
    balanceAsymmetry: newAsym,
  }
}

const ALERT_TYPES: Record<string, string> = {
  'High Risk':     'Risk Escalation',
  'Moderate Risk': 'Sustained Early Warning',
  'Low Risk':      'Stability Restored',
}
const ALERT_DESC: Record<string, string[]> = {
  'High Risk':     ['Rapid increase in instability', 'Abnormal gait pattern detected', 'Prolonged body sway', 'Sudden balance loss'],
  'Moderate Risk': ['Sustained instability for 12s+', 'Posture transition risk persists', 'Continuous micro-movement instability'],
  'Low Risk':      ['Risk score returned to safe range', 'Movement stabilised'],
}

interface FallStore {
  patients: Patient[]
  alerts: FallAlert[]
  lastUpdate: Date
  edgeConnected: boolean
  // Per-patient counter — number of consecutive ticks in Moderate Risk
  moderateTicks: Record<string, number>
  // Total count of high-risk alerts ever generated (used by UI to detect new ones for audio cue)
  highAlertCount: number
  // Real backend model output for each patient (loaded from /demo_data/manifest.json)
  demoManifest: DemoManifest | null

  acknowledgeAlert: (id: string) => void
  resolveAlert: (id: string) => void
  setAlerts: (updater: (prev: FallAlert[]) => FallAlert[]) => void

  tick: () => void
  startLive: () => () => void
  initFromManifest: () => Promise<void>
}

// Apply a DemoEntry's real model output to a seeded Patient. Keeps name,
// age, room, bed (display labels) but overrides everything that came from
// a backend model: riskLevel, riskScore, posture, confidence, status, zone.
function applyDemoEntry(p: Patient, e: DemoEntry): Patient {
  const status: PatientStatus =
    e.riskLevel === 'High Risk' ? 'Alert' :
    e.riskLevel === 'Moderate Risk' ? 'Monitoring' : 'Normal'
  const zone: ZoneType =
    e.posture === 'Lying' ? 'Bed' :
    e.posture === 'Sitting' ? 'Chair' : 'Walking'
  // Build a believable trend that lands on the real score
  const trend: number[] = []
  const start = Math.max(5, e.riskScore - 12 + Math.floor(Math.random() * 6))
  for (let i = 0; i < 10; i++) {
    const t = i / 9
    trend.push(Math.round(start + (e.riskScore - start) * t + (Math.random() - 0.5) * 3))
  }
  return {
    ...p,
    riskLevel: e.riskLevel,
    riskScore: e.riskScore,
    posture: e.posture,
    status,
    zone,
    confidence: e.confidence,
    trend,
    trendChange: e.riskScore - trend[0],
  }
}

export const useFallStore = create<FallStore>((set, get) => ({
  patients: SEED_PATIENTS.map(p => ({ ...p })),
  alerts: SEED_ALERTS.map(a => ({ ...a })),
  lastUpdate: new Date(),
  edgeConnected: true,
  moderateTicks: {},
  highAlertCount: SEED_ALERTS.filter(a => a.riskLevel === 'High Risk').length,
  demoManifest: null,

  initFromManifest: async () => {
    const m = await loadManifest()
    if (!m) return
    const byId = new Map(m.entries.map(e => [e.patientId, e]))
    set(s => ({
      demoManifest: m,
      patients: s.patients.map(p => {
        const e = byId.get(p.id)
        return e ? applyDemoEntry(p, e) : p
      }),
    }))
  },

  acknowledgeAlert: (id) =>
    set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'Acknowledged' as const } : a) })),

  resolveAlert: (id) =>
    set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, status: 'Resolved' as const } : a) })),

  setAlerts: (updater) =>
    set(s => ({ alerts: updater(s.alerts) })),

  tick: () => {
    const { patients, alerts, moderateTicks, highAlertCount, demoManifest } = get()

    const indices = new Set<number>()
    while (indices.size < 10) indices.add(Math.floor(Math.random() * patients.length))

    const updatedPatients = patients.map((p, i) => {
      if (!indices.has(i)) return p
      const next = liveUpdate(p)
      // If this patient has a real model anchor, keep the score within ±5 of it
      const e = demoManifest?.entries.find(x => x.patientId === p.id)
      if (e) {
        const anchored = Math.max(e.riskScore - 5, Math.min(e.riskScore + 5, next.riskScore))
        return {
          ...next,
          riskScore: anchored,
          riskLevel: e.riskLevel,        // never drift across class boundaries
          posture: e.posture,            // posture is fixed for this clip
        }
      }
      return next
    })

    const newAlerts: FallAlert[] = []
    const nextModerateTicks: Record<string, number> = { ...moderateTicks }
    let highCount = highAlertCount

    updatedPatients.forEach((np, i) => {
      const prev = patients[i]

      // ── High Risk: fire on level transition into High Risk
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
        highCount += 1
        // Reset moderate counter on escalation
        nextModerateTicks[np.id] = 0
      }
      // ── Moderate Risk: fire only after a sustained window (>= MODERATE_TICKS_REQUIRED ticks)
      else if (np.riskLevel === 'Moderate Risk') {
        const next = (nextModerateTicks[np.id] ?? 0) + 1
        nextModerateTicks[np.id] = next
        if (next === MODERATE_TICKS_REQUIRED) {
          const descs = ALERT_DESC['Moderate Risk']
          newAlerts.push({
            id: `A${String(alertSeq++).padStart(3, '0')}`,
            patientId: np.id, patientName: np.name,
            room: np.room, bed: np.bed, riskLevel: 'Moderate Risk',
            alertType: ALERT_TYPES['Moderate Risk'],
            description: descs[Math.floor(Math.random() * descs.length)],
            time: nowTime(), date: nowDate(), status: 'New',
          })
        }
      }
      // ── Reset moderate counter when patient leaves Moderate Risk
      else {
        nextModerateTicks[np.id] = 0
      }
    })

    set({
      patients: updatedPatients,
      alerts: newAlerts.length > 0 ? [...newAlerts, ...alerts].slice(0, 30) : alerts,
      lastUpdate: new Date(),
      moderateTicks: nextModerateTicks,
      highAlertCount: highCount,
    })
  },

  startLive: () => {
    const id = setInterval(() => get().tick(), 2500)
    return () => clearInterval(id)
  },
}))
