import { useState, useEffect, useRef } from 'react'
import type { Patient, PatientDetailTab } from '../types'
import { SkeletonPose } from './SkeletonPose'
import { Sparkline, RiskArc, MiniArea, DonutChart } from './Charts'
import { PATIENT_HISTORY } from '../data/mockData'

// Palette: #1E3A8A navy | #2563EB blue | #14B8A6 teal | #7C3AED purple
const riskColor = (l: string) => l === 'High Risk' ? '#EF4444' : l === 'Moderate Risk' ? '#F59E0B' : '#14B8A6'
const riskBg   = (l: string) => l === 'High Risk' ? 'rgba(239,68,68,0.08)' : l === 'Moderate Risk' ? 'rgba(245,158,11,0.08)' : 'rgba(20,184,166,0.08)'
const scoreColor = (s: number) => s >= 71 ? '#EF4444' : s >= 41 ? '#F59E0B' : '#14B8A6'

interface Props { patient: Patient; onClose: () => void; onViewLive: (p: Patient) => void }

const DETAIL_TABS: { id: PatientDetailTab; label: string }[] = [
  { id: 'overview',   label: 'Overview'   },
  { id: 'live-view',  label: 'Live View'  },
  { id: 'history',    label: 'History'    },
  { id: 'replay',     label: 'Replay'     },
  { id: 'analytics',  label: 'Analytics'  },
]

export function PatientDetailPanel({ patient, onClose, onViewLive }: Props) {
  const [tab, setTab] = useState<PatientDetailTab>('overview')
  const [liveScore, setLiveScore] = useState(patient.riskScore)
  const [liveConf, setLiveConf] = useState(patient.confidence)
  const [livePosture, setLivePosture] = useState(patient.posture)
  const [liveTrend, setLiveTrend] = useState(patient.trend)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackTime, setPlaybackTime] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (tab !== 'live-view' || !isPlaying) return
    timerRef.current = setInterval(() => {
      setLiveScore(s => {
        const delta = (Math.random() - 0.48) * 2
        return Math.max(0, Math.min(100, Math.round(s + delta)))
      })
      setLiveConf(c => Math.max(0.6, Math.min(0.99, c + (Math.random() - 0.5) * 0.02)))
      setLiveTrend(t => [...t.slice(1), liveScore])
    }, 1200)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [tab, isPlaying, liveScore])

  useEffect(() => {
    if (tab !== 'replay' || !isPlaying) return
    const t = setInterval(() => setPlaybackTime(p => Math.min(p + 1, 300)), 1000)
    return () => clearInterval(t)
  }, [tab, isPlaying])

  const history = PATIENT_HISTORY[patient.id] ?? []
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-lg)',
        width: 'min(900px, 96vw)', maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Modal Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.06) 0%,transparent 60%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: riskBg(patient.riskLevel), border: `1.5px solid ${riskColor(patient.riskLevel)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: riskColor(patient.riskLevel) }}>{patient.id}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-strong)' }}>{patient.name} · {patient.room} / {patient.bed}</div>
              <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>Age {patient.age} · {patient.gender} · Last updated {patient.lastUpdated}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: riskBg(patient.riskLevel), color: riskColor(patient.riskLevel), border: `1px solid ${riskColor(patient.riskLevel)}40` }}>{patient.riskLevel}</span>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 20px', background: 'var(--surface)' }}>
          {DETAIL_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: tab === t.id ? '#F97316' : 'var(--text)',
              borderBottom: tab === t.id ? '2.5px solid #F97316' : '2.5px solid transparent',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {tab === 'overview' && <OverviewTab patient={patient} />}
          {tab === 'live-view' && <LiveViewTab patient={patient} liveScore={liveScore} liveConf={liveConf} livePosture={livePosture} liveTrend={liveTrend} isPlaying={isPlaying} setIsPlaying={setIsPlaying} onViewLive={onViewLive} />}
          {tab === 'history' && <HistoryTab patient={patient} history={history} />}
          {tab === 'replay' && <ReplayTab patient={patient} isPlaying={isPlaying} setIsPlaying={setIsPlaying} playbackTime={playbackTime} setPlaybackTime={setPlaybackTime} />}
          {tab === 'analytics' && <AnalyticsTab patient={patient} />}
        </div>
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ patient }: { patient: Patient }) {
  const c = riskColor(patient.riskLevel)
  const fields = [
    ['Patient ID', patient.id], ['Name', patient.name], ['Age', String(patient.age)],
    ['Patient ID', patient.id], ['Name', patient.name], ['Age', String(patient.age)],
    ['Gender', patient.gender], ['Room', patient.room], ['Bed', patient.bed],
    ['Risk Level', patient.riskLevel], ['Risk Score', `${patient.riskScore}/100`],
    ['Confidence', patient.confidence.toFixed(2)],
    ['Body Tilt', `${patient.bodyTilt}°`], ['Speed', `${patient.speed} m/s`],
    ['Status', patient.status], ['Last Updated', patient.lastUpdated],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 11, color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Patient Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {fields.map(([k, v]) => (
            <div key={k} style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: k === 'Risk Level' ? c : k === 'Risk Score' ? scoreColor(patient.riskScore) : '#1F2937' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, background: '#0F172A', borderRadius: 16, border: `1px solid ${c}30` }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Skeletal Analysis</div>
          <SkeletonPose posture={patient.posture} riskLevel={patient.riskLevel} size={160} />
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: c }}>Edge AI · ST-GCN Detection</div>
        </div>
        <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 14, border: '1px solid #F3F4F6' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>30-Second Risk Trend</div>
          <Sparkline data={patient.trend} color={c} width={240} height={50} filled />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#64748B' }}>
            <span>Score: <b style={{ color: scoreColor(patient.riskScore) }}>{patient.riskScore}</b></span>
            <span style={{ color: patient.trendChange > 0 ? '#EF4444' : '#14B8A6', fontWeight: 700 }}>{patient.trendChange > 0 ? '▲' : '▼'} {Math.abs(patient.trendChange)} trend</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Live View Tab ────────────────────────────────────────────────────────────
function LiveViewTab({ patient, liveScore, liveConf, livePosture, liveTrend, isPlaying, setIsPlaying, onViewLive }: {
  patient: Patient; liveScore: number; liveConf: number; livePosture: string
  liveTrend: number[]; isPlaying: boolean; setIsPlaying: (v: boolean) => void; onViewLive: (p: Patient) => void
}) {
  const c = scoreColor(liveScore)
  const lvl = liveScore >= 71 ? 'High Risk' : liveScore >= 41 ? 'Moderate Risk' : 'Low Risk'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Left: Live skeleton */}
      <div style={{ background: '#0F172A', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'stretch' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite' }} />
          </div>
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>LIVE</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748B' }}>25 FPS</span>
        </div>
        <SkeletonPose posture={patient.posture} riskLevel={lvl as any} animated size={200} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
          {[
            ['Posture', livePosture, '#F97316'],
            ['Risk Score', `${liveScore}/100`, c],
            ['Confidence', liveConf.toFixed(2), '#3B82F6'],
            ['Body Tilt', `${patient.bodyTilt}°`, '#8B5CF6'],
            ['Speed', `${patient.speed} m/s`, '#10B981'],
            ['Status', liveScore >= 71 ? 'Alert' : 'Monitoring', liveScore >= 71 ? '#EF4444' : '#F59E0B'],
          ].map(([k, v, col]) => (
            <div key={k} style={{ background: '#1E293B', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: col as string }}>{v}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setIsPlaying(!isPlaying)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1E293B', color: '#94A3B8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {isPlaying ? '⏸ Pause' : '▶ Resume'}
        </button>
      </div>
      {/* Right: Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Live Risk Score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <RiskArc score={liveScore} size={90} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{liveScore}</div>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>/ 100 — <span style={{ color: c, fontWeight: 700 }}>{lvl}</span></div>
              <div style={{ marginTop: 6 }}>
                <Sparkline data={liveTrend} color={c} width={120} height={30} filled />
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)', flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Movement Log (Last 5)</div>
          {(PATIENT_HISTORY[patient.id] ?? []).slice(0, 5).map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: riskColor(h.riskLevel), flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--text-strong)' }}>{h.event}</div>
              <div style={{ fontSize: 11, color: 'var(--text)' }}>{h.time}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: riskColor(h.riskLevel) }}>{h.riskScore}</div>
            </div>
          ))}
          {(PATIENT_HISTORY[patient.id] ?? []).length === 0 && (
            <div style={{ color: 'var(--text)', fontSize: 12, textAlign: 'center', padding: 20 }}>No history available</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ patient, history }: { patient: Patient; history: ReturnType<typeof Array.prototype.slice> }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)' }}>Movement History — {patient.name}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['All', 'High Risk', 'Moderate', 'Low Risk'].map(f => (
            <button key={f} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: f === 'All' ? '#F97316' : 'var(--surface)', color: f === 'All' ? 'white' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>{f}</button>
          ))}
        </div>
      </div>
      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text)' }}>No history recorded yet.</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Time', 'Event', 'Risk Level', 'Score', 'Duration'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text)' }}>{h.time}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-strong)', fontWeight: 600 }}>{h.event}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: riskBg(h.riskLevel), color: riskColor(h.riskLevel) }}>{h.riskLevel}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: scoreColor(h.riskScore) }}>{h.riskScore}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text)' }}>{h.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Replay Tab ───────────────────────────────────────────────────────────────
function ReplayTab({ patient, isPlaying, setIsPlaying, playbackTime, setPlaybackTime }: {
  patient: Patient; isPlaying: boolean; setIsPlaying: (v: boolean) => void
  playbackTime: number; setPlaybackTime: (v: number) => void
}) {
  const totalDuration = 300
  const pct = (playbackTime / totalDuration) * 100
  const events = [
    { at: 20,  label: 'Normal',            color: '#16A34A' },
    { at: 80,  label: 'Posture Change',    color: '#F59E0B' },
    { at: 140, label: 'Unstable Movement', color: '#F97316' },
    { at: 200, label: 'High Risk Alert',   color: '#EF4444' },
    { at: 260, label: 'Recovery',          color: '#16A34A' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)' }}>Event Replay — {patient.name} ({patient.room} / {patient.bed})</div>
      {/* Player */}
      <div style={{ background: '#0F172A', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <SkeletonPose posture={patient.posture} riskLevel={patient.riskLevel} animated={isPlaying} size={180} />
        <div style={{ width: '100%', color: '#94A3B8', fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>{`${String(Math.floor(playbackTime / 60)).padStart(2,'0')}:${String(playbackTime % 60).padStart(2,'0')}`}</span>
          <span>{`${String(Math.floor(totalDuration / 60)).padStart(2,'0')}:${String(totalDuration % 60).padStart(2,'0')}`}</span>
        </div>
        {/* Progress bar */}
        <div style={{ width: '100%', height: 8, background: '#1E293B', borderRadius: 4, position: 'relative', cursor: 'pointer' }}
          onClick={e => { const r = (e.target as HTMLElement).getBoundingClientRect(); setPlaybackTime(Math.round(((e.clientX - r.left) / r.width) * totalDuration)) }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#F97316', borderRadius: 4, transition: 'width 0.3s' }} />
          {events.map(ev => (
            <div key={ev.at} style={{ position: 'absolute', top: -4, left: `${(ev.at / totalDuration) * 100}%`, width: 3, height: 16, background: ev.color, borderRadius: 2 }} title={ev.label} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setPlaybackTime(Math.max(0, playbackTime - 10))} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1E293B', color: '#94A3B8', cursor: 'pointer', fontSize: 13 }}>⏮ -10s</button>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#F97316', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={() => setPlaybackTime(Math.min(totalDuration, playbackTime + 10))} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1E293B', color: '#94A3B8', cursor: 'pointer', fontSize: 13 }}>+10s ⏭</button>
        </div>
      </div>
      {/* Events timeline */}
      <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Event Timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map(ev => (
            <div key={ev.at} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setPlaybackTime(ev.at)}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-strong)', fontWeight: 500 }}>{ev.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>{`${String(Math.floor(ev.at / 60)).padStart(2,'0')}:${String(ev.at % 60).padStart(2,'0')}`}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ patient }: { patient: Patient }) {
  const stats = [
    { label: 'Risk Score',      value: `${patient.riskScore}/100`, color: scoreColor(patient.riskScore) },
    { label: 'Total Alerts',    value: '6',    color: '#EF4444'  },
    { label: 'High Risk Events',value: '3',    color: '#F97316'  },
    { label: 'Moderate Events', value: '2',    color: '#F59E0B'  },
  ]

  // Heatmap for body part detectability
  const heatmap = [
    { part: 'Head',      val: 0.95 }, { part: 'Neck',    val: 0.92 },
    { part: 'L. Shoulder', val: 0.88 }, { part: 'R. Shoulder', val: 0.87 },
    { part: 'L. Elbow',  val: 0.82 }, { part: 'R. Elbow', val: 0.84 },
    { part: 'L. Wrist',  val: 0.76 }, { part: 'R. Wrist', val: 0.78 },
    { part: 'Torso',     val: 0.94 }, { part: 'L. Hip',  val: 0.86 },
    { part: 'R. Hip',    val: 0.85 }, { part: 'L. Knee', val: 0.80 },
    { part: 'R. Knee',   val: 0.81 }, { part: 'L. Ankle',val: 0.72 },
    { part: 'R. Ankle',  val: 0.74 }, { part: 'Spine',   val: 0.90 },
  ]

  const heatColor = (v: number) => {
    const r = Math.round(239 * (1 - v) + 22 * v)
    const g = Math.round(68 * (1 - v) + 163 * v)
    const b = Math.round(68 * (1 - v) + 74 * v)
    return `rgb(${r},${g},${b})`
  }

  const trendData = patient.trend.map((v, i) => ({ label: `${i * 3}s`, values: [{ key: 'score', value: v, color: '#F97316' }] }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Stats */}
      <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {stats.map(s => (
          <div key={s.label} style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Detection Confidence Heatmap</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
          {heatmap.map(h => (
            <div key={h.part} style={{ padding: '6px 4px', borderRadius: 6, background: heatColor(h.val), textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'white', fontWeight: 700, opacity: 0.9 }}>{h.part}</div>
              <div style={{ fontSize: 11, color: 'white', fontWeight: 800 }}>{Math.round(h.val * 100)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Trend */}
      <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Risk Score Trend (30s)</div>
        <MiniArea data={patient.trend} color={scoreColor(patient.riskScore)} width={260} height={80} />
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: 'var(--text)' }}>Min: <b style={{ color: '#16A34A' }}>{Math.min(...patient.trend)}</b></div>
          <div style={{ fontSize: 11, color: 'var(--text)' }}>Max: <b style={{ color: '#EF4444' }}>{Math.max(...patient.trend)}</b></div>
          <div style={{ fontSize: 11, color: 'var(--text)' }}>Avg: <b style={{ color: 'var(--text-strong)' }}>{Math.round(patient.trend.reduce((a,b)=>a+b,0)/patient.trend.length)}</b></div>
          <div style={{ fontSize: 11, color: 'var(--text)' }}>Trend: <b style={{ color: '#EF4444' }}>▲ +{patient.trendChange}</b></div>
        </div>
      </div>

      {/* Key Insights */}
      <div style={{ gridColumn: '1/-1', padding: 16, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Key Insights</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { icon: '⚠️', label: 'Risk Trend', value: 'Increasing', note: `+${patient.trendChange} over 30s`, color: '#EF4444' },
            { icon: '🦴', label: 'Most Unstable Joint', value: 'Lower Limbs', note: 'Knee & ankle', color: '#F97316' },
            { icon: '🎯', label: 'Avg Confidence', value: `${Math.round(patient.confidence * 100)}%`, note: 'Pose detection', color: '#3B82F6' },
          ].map(ins => (
            <div key={ins.label} style={{ padding: 12, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{ins.icon}</div>
              <div style={{ fontSize: 11, color: 'var(--text)' }}>{ins.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: ins.color }}>{ins.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text)' }}>{ins.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
