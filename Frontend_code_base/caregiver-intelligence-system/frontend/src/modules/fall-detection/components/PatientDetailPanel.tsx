import { useState, useEffect, useRef, useMemo } from 'react'
import type { Patient, PatientDetailTab } from '../types'
import { Sparkline, RiskArc, MiniArea } from './Charts'
import { PATIENT_HISTORY } from '../data/mockData'
import {
  getPatientScenario, computeJoints, BONES, ALL_JOINTS, JOINT_LABELS,
  STAGE_JUMPS, getLiveActivity, type Frame,
} from '../utils/skeletonScenarios'

const riskColor  = (l: string) => l === 'High Risk' ? '#EF4444' : l === 'Moderate Risk' ? '#F59E0B' : '#14B8A6'
const riskBg     = (l: string) => l === 'High Risk' ? 'rgba(239,68,68,0.08)' : l === 'Moderate Risk' ? 'rgba(245,158,11,0.08)' : 'rgba(20,184,166,0.08)'
const scoreColor = (s: number) => s >= 71 ? '#EF4444' : s >= 41 ? '#F59E0B' : '#14B8A6'

const fallRiskLabel = (score: number) =>
  score >= 71 ? { label: 'Fall Risk', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: '⚠' }
  : score >= 41 ? { label: 'Near-Fall Risk', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: '⚡' }
  : { label: 'Normal Activity', color: '#14B8A6', bg: 'rgba(20,184,166,0.1)', icon: '✓' }

interface Props { patient: Patient; onClose: () => void; onViewLive: (p: Patient) => void }

const DETAIL_TABS: { id: PatientDetailTab; label: string }[] = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'live-view', label: 'Live View' },
  { id: 'history',   label: 'History'   },
  { id: 'replay',    label: 'Replay'    },
  { id: 'analytics', label: 'Analytics' },
]

export function PatientDetailPanel({ patient, onClose, onViewLive }: Props) {
  const [tab, setTab] = useState<PatientDetailTab>('overview')
  const rc = riskColor(patient.riskLevel)
  const history = PATIENT_HISTORY[patient.id] ?? []

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(15,23,42,0.5)',
        backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background:'white', borderRadius:20,
        boxShadow:'0 24px 64px rgba(15,23,42,0.22)',
        width:'min(960px,96vw)', maxHeight:'92vh',
        overflow:'hidden', display:'flex', flexDirection:'column',
      }}>
        {/* ── Modal header ── */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #E5E7EB',
          background:'linear-gradient(135deg,rgba(30,58,138,0.04),transparent)',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:42, height:42, borderRadius:12, background:riskBg(patient.riskLevel),
              border:`2px solid ${rc}`, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontWeight:900, color:rc, letterSpacing:'-0.5px' }}>
              {patient.id}
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#111827' }}>
                {patient.name}
                <span style={{ fontWeight:500, color:'#6B7280', marginLeft:8 }}>
                  · {patient.room} / {patient.bed}
                </span>
              </div>
              <div style={{ fontSize:12, color:'#94A3B8', marginTop:2 }}>
                Age {patient.age} · {patient.gender} · Last updated {patient.lastUpdated}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:700,
              background:riskBg(patient.riskLevel), color:rc, border:`1px solid ${rc}40` }}>
              {patient.riskLevel}
            </span>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:8,
              border:'1px solid #E5E7EB', background:'white', cursor:'pointer',
              fontSize:20, color:'#94A3B8', display:'flex', alignItems:'center', justifyContent:'center',
              lineHeight:1 }}>×</button>
          </div>
        </div>

        {/* ── Sub-tabs ── */}
        <div style={{ display:'flex', borderBottom:'1px solid #E5E7EB', background:'white',
          padding:'0 20px', flexShrink:0 }}>
          {DETAIL_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'11px 16px', border:'none', background:'transparent', cursor:'pointer',
              fontSize:13, fontWeight:600,
              color: tab === t.id ? '#1E3A8A' : '#6B7280',
              borderBottom: tab === t.id ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
              transition:'all 0.15s', whiteSpace:'nowrap',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Content ── */}
        <div style={{ overflowY:'auto', flex:1, padding:20, background:'#F9FAFB' }}>
          {tab === 'overview'  && <OverviewTab  patient={patient} />}
          {tab === 'live-view' && <LiveViewTab  patient={patient} onViewLive={onViewLive} />}
          {tab === 'history'   && <HistoryTab   patient={patient} history={history} />}
          {tab === 'replay'    && <ReplayTab    patient={patient} />}
          {tab === 'analytics' && <AnalyticsTab patient={patient} />}
        </div>
      </div>
    </div>
  )
}

// ── Shared skeleton canvas ────────────────────────────────────────────────────
// Loop ranges by risk+status — Alert patients never enter the Recovery phase (frames 30-39)
// because the system is showing "going toward the fall", not the aftermath.
interface SkeletonCanvasProps {
  patientId: string
  riskLevel: string
  posture?: string
  patientStatus?: string
  size?: number
  showStats?: boolean
  showStageLabel?: boolean
  loop?: boolean
  onFrameChange?: (frame: Frame) => void
}
function SkeletonCanvas({
  patientId, riskLevel, posture, patientStatus = 'Normal', size = 220,
  showStats = false, showStageLabel = true, loop = true, onFrameChange,
}: SkeletonCanvasProps) {
  const scenario = useMemo(() => getPatientScenario(patientId, posture), [patientId, posture])

  // Derive loop window and speed from clinical state.
  // Alert + High Risk  → stuck in Near-Fall zone (17-29): "patient is GOING TO FALL right now"
  // High Risk only     → escalation zone (8-23): rising instability visible
  // Moderate           → normal+early (0-16): building imbalance
  // Low Risk           → normal only (0-7): what the patient is doing calmly
  const { loopStart, loopEnd, speed } = useMemo(() => {
    const isAlert = patientStatus === 'Alert'
    if (riskLevel === 'High Risk' && isAlert) return { loopStart: 17, loopEnd: 29, speed: 80  }
    if (riskLevel === 'High Risk')             return { loopStart: 8,  loopEnd: 23, speed: 105 }
    if (riskLevel === 'Moderate Risk')         return { loopStart: 0,  loopEnd: 16, speed: 145 }
    return                                            { loopStart: 0,  loopEnd: 7,  speed: 185 }
  }, [riskLevel, patientStatus])

  const [frameIdx, setFrameIdx] = useState(loopStart)
  const [joints, setJoints] = useState(() => computeJoints(scenario.frames[loopStart] ?? scenario.frames[0], 0.3))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setFrameIdx(loopStart) }, [patientId, loopStart])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setFrameIdx(i => {
        if (i >= loopEnd) return loop ? loopStart : loopEnd
        return i + 1
      })
    }, speed)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loopStart, loopEnd, speed, loop])

  useEffect(() => {
    const f = scenario.frames[Math.min(frameIdx, scenario.frames.length - 1)]
    const noise = f.stage === 'critical' ? 1.8 : f.stage === 'high' ? 1.2 : f.stage === 'early' ? 0.7 : 0.3
    setJoints(computeJoints(f, noise))
    onFrameChange?.(f)
  }, [frameIdx, scenario.frames, onFrameChange])

  const frame = scenario.frames[Math.min(frameIdx, scenario.frames.length - 1)]

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
      <svg width={size} height={Math.round(size * 1.1)} viewBox="0 0 100 110" style={{ display:'block' }}>
        <defs>
          <radialGradient id={`glow-${patientId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={frame.stageColor} stopOpacity="0.08" />
            <stop offset="100%" stopColor={frame.stageColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="110" fill={`url(#glow-${patientId})`} />
        {/* Shadow ellipse */}
        <ellipse cx={50 + frame.swayX * 0.25} cy={100} rx={9} ry={2.5}
          fill={frame.stageColor} opacity="0.18" />
        {/* Sway arrow */}
        {Math.abs(frame.swayX) > 4 && (
          <line x1={50} y1={52} x2={50 + frame.swayX * 0.45} y2={52}
            stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.6" />
        )}
        {/* Bones */}
        {BONES.map(([a, b]) => {
          const ja = joints[a], jb = joints[b]
          if (!ja || !jb) return null
          const hot = frame.unstable.includes(a) || frame.unstable.includes(b)
          return <line key={`${a}-${b}`} x1={ja.x} y1={ja.y} x2={jb.x} y2={jb.y}
            stroke={hot ? frame.stageColor : '#3B82F6'} strokeWidth="2.2"
            strokeLinecap="round" opacity={hot ? 1 : 0.85} />
        })}
        {/* Joints */}
        {Object.entries(joints).map(([name, j]) => {
          const unstable = frame.unstable.includes(name)
          const isHead = name === 'head'
          const col = unstable ? frame.stageColor : '#60A5FA'
          return (
            <g key={name}>
              {unstable && <circle cx={j.x} cy={j.y} r={isHead ? 9 : 5} fill={col} opacity="0.18" />}
              <circle cx={j.x} cy={j.y} r={isHead ? 6 : unstable ? 3.6 : 2.8}
                fill={col} stroke="#0F172A" strokeWidth="1" opacity={unstable ? 1 : 0.9} />
            </g>
          )
        })}
        {/* Alert pulse on high-risk head */}
        {(frame.stage === 'critical' || frame.stage === 'high') && (
          <circle cx={joints['head']?.x ?? 50} cy={joints['head']?.y ?? 10} r="9"
            fill="none" stroke={frame.stageColor} strokeWidth="1.5" opacity="0.4">
            <animate attributeName="r" values="9;14;9" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="1.2s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      {showStageLabel && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:frame.stageColor,
            boxShadow: frame.stage !== 'normal' ? `0 0 6px ${frame.stageColor}` : 'none' }} />
          <span style={{ fontSize:11, fontWeight:700, color:frame.stageColor }}>{frame.stageLabel}</span>
        </div>
      )}
      {showStats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, width:'100%', marginTop:6 }}>
          {([
            ['Tilt',  `${frame.tilt}°`,               frame.tilt > 15 ? '#EF4444' : frame.tilt > 8 ? '#F59E0B' : '#14B8A6'],
            ['Sway',  `${Math.abs(frame.swayX)}`,     Math.abs(frame.swayX) > 15 ? '#EF4444' : '#14B8A6'],
            ['Speed', `${frame.speed.toFixed(2)}`,    frame.speed > 0.5 ? '#EF4444' : '#14B8A6'],
            ['Conf',  `${Math.round(frame.confidence * 100)}%`, '#2563EB'],
          ] as [string, string, string][]).map(([k, v, c]) => (
            <div key={k} style={{ background:'#1E293B', borderRadius:6, padding:'5px 4px', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#64748B', fontWeight:600 }}>{k}</div>
              <div style={{ fontSize:12, fontWeight:800, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ patient }: { patient: Patient }) {
  const c   = riskColor(patient.riskLevel)
  const sc  = scoreColor(patient.riskScore)
  const frl = fallRiskLabel(patient.riskScore)
  const scenario = useMemo(() => getPatientScenario(patient.id, patient.posture), [patient.id, patient.posture])


  const infoRows: [string, string, string?][] = [
    ['Patient ID',   patient.id],
    ['Name',         patient.name],
    ['Age',          String(patient.age)],
    ['Gender',       patient.gender],
    ['Room',         patient.room],
    ['Bed',          patient.bed],
    ['Risk Level',   patient.riskLevel,             c],
    ['Risk Score',   `${patient.riskScore} / 100`,  sc],
    ['Confidence',   `${(patient.confidence * 100).toFixed(0)}%`],
    ['Body Tilt',    `${patient.bodyTilt}°`],
    ['Speed',        `${patient.speed} m/s`],
    ['Status',       patient.status],
    ['Last Updated', patient.lastUpdated],
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, alignItems:'start' }}>

      {/* ── Left: Patient info ── */}
      <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB', overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #F3F4F6',
          background:'linear-gradient(90deg,rgba(30,58,138,0.04),transparent)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#1F2937', textTransform:'uppercase',
            letterSpacing:'0.06em' }}>Patient Information</div>
          <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>
            Edge AI · ST-GCN Skeletal Analysis · Privacy Preserved
          </div>
        </div>
        <div style={{ padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {infoRows.map(([k, v, color]) => (
            <div key={k} style={{ padding:'9px 12px', background:'#F9FAFB',
              borderRadius:10, border:'1px solid #F3F4F6' }}>
              <div style={{ fontSize:10, color:'#94A3B8', marginBottom:3, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.04em' }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:800,
                color: color ?? '#1F2937' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Skeleton + trend ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Skeleton analysis card */}
        <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #F3F4F6',
            background:'linear-gradient(90deg,rgba(30,58,138,0.05),transparent)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#1F2937', textTransform:'uppercase',
                letterSpacing:'0.06em' }}>Skeletal Analysis</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999,
                  background:`${scenario.categoryColor}15`, color:scenario.categoryColor }}>
                  {scenario.icon} {scenario.category}
                </span>
              </div>
            </div>
          </div>
          <div style={{ background:'#0F172A', padding:'20px 20px 16px',
            display:'flex', flexDirection:'column', alignItems:'center' }}>
            {/* Live badge */}
            <div style={{ alignSelf:'stretch', display:'flex', alignItems:'center',
              justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#14B8A6' }}>
                  <div style={{ width:'100%', height:'100%', borderRadius:'50%',
                    background:'#14B8A6', animation:'pulse 1.5s infinite' }} />
                </div>
                <span style={{ fontSize:10, color:'#94A3B8', fontWeight:700,
                  textTransform:'uppercase', letterSpacing:'0.1em' }}>Live</span>
              </div>
              <span style={{ fontSize:10, color:'#475569' }}>ST-GCN · Edge AI</span>
            </div>

            <SkeletonCanvas
              patientId={patient.id}
              riskLevel={patient.riskLevel}
              posture={patient.posture}
              patientStatus={patient.status}
              size={200}
              showStageLabel={true}
            />

            {/* Current activity label */}
            <div style={{ marginTop:10, padding:'6px 14px', borderRadius:8, textAlign:'center',
              background:`${scenario.categoryColor}15`, border:`1px solid ${scenario.categoryColor}30` }}>
              <div style={{ fontSize:10, color:'#64748B', marginBottom:2 }}>Detected Situation</div>
              <div style={{ fontSize:12, fontWeight:700, color:scenario.categoryColor }}>
                {patient.riskLevel === 'Low Risk' ? scenario.normalLabel : scenario.situation}
              </div>
            </div>
          </div>
        </div>

        {/* Risk assessment card */}
        <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB', padding:'14px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#1F2937', textTransform:'uppercase',
              letterSpacing:'0.06em' }}>Risk Assessment</div>
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:999,
              background:frl.bg, color:frl.color }}>
              {frl.icon} {frl.label}
            </span>
          </div>

          {/* Score bar */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:11, color:'#94A3B8' }}>Risk Score</span>
              <span style={{ fontSize:13, fontWeight:900, color:sc }}>{patient.riskScore}/100</span>
            </div>
            <div style={{ height:8, borderRadius:999, background:'#F3F4F6', overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:999, width:`${patient.riskScore}%`,
                background: patient.riskScore >= 71
                  ? 'linear-gradient(90deg,#F59E0B,#EF4444)'
                  : patient.riskScore >= 41 ? 'linear-gradient(90deg,#14B8A6,#F59E0B)'
                  : '#14B8A6',
                transition:'width 0.6s ease' }} />
            </div>
          </div>

          {/* 30s trend */}
          <div>
            <div style={{ fontSize:11, color:'#94A3B8', marginBottom:6, fontWeight:600 }}>
              30-Second Risk Trend
            </div>
            <Sparkline data={patient.trend} color={c} width={260} height={44} filled />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
              <span style={{ fontSize:11, color:'#64748B' }}>
                Score: <b style={{ color:sc }}>{patient.riskScore}</b>
              </span>
              <span style={{ fontSize:11, fontWeight:700,
                color: patient.trendChange > 0 ? '#EF4444' : '#14B8A6' }}>
                {patient.trendChange > 0 ? '▲' : '▼'} {Math.abs(patient.trendChange)} trend
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Live View Tab ─────────────────────────────────────────────────────────────
function LiveViewTab({ patient, onViewLive }: { patient: Patient; onViewLive: (p: Patient) => void }) {
  const [liveScore, setLiveScore] = useState(patient.riskScore)
  const [liveConf,  setLiveConf]  = useState(patient.confidence)
  const [liveTrend, setLiveTrend] = useState(patient.trend)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentFrame, setCurrentFrame] = useState<Frame | null>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const eventRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const scenario  = useMemo(() => getPatientScenario(patient.id, patient.posture), [patient.id, patient.posture])

  const c   = scoreColor(liveScore)
  const lvl = liveScore >= 71 ? 'High Risk' : liveScore >= 41 ? 'Moderate Risk' : 'Low Risk'
  const frl = fallRiskLabel(liveScore)

  // Derive which stage the patient is currently in (drives event descriptions)
  const currentStage = patient.status === 'Alert' ? 'critical'
    : patient.riskLevel === 'High Risk'   ? 'high'
    : patient.riskLevel === 'Moderate Risk' ? 'early'
    : 'normal'

  // Live movement log — seeds from history then adds new contextual events over time
  const [liveEvents, setLiveEvents] = useState(() =>
    (PATIENT_HISTORY[patient.id] ?? []).slice(0, 5).map(h => ({
      time: h.time, event: h.event,
      riskScore: h.riskScore, riskLevel: h.riskLevel as string,
    }))
  )

  // Score ticker
  useEffect(() => {
    if (!isPlaying) return
    timerRef.current = setInterval(() => {
      setLiveScore(s => Math.max(0, Math.min(100, Math.round(s + (Math.random() - 0.48) * 2))))
      setLiveConf(c => Math.max(0.6, Math.min(0.99, c + (Math.random() - 0.5) * 0.02)))
      setLiveTrend(t => [...t.slice(1), liveScore])
    }, 1200)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isPlaying, liveScore])

  // Live event generator — adds new contextual event every 3.5–6 s, based on patient state
  useEffect(() => {
    const schedule = () => {
      const delay = 3500 + Math.random() * 2500
      eventRef.current = setTimeout(() => {
        const desc = getLiveActivity(scenario.scenarioId, currentStage)
        const base = patient.riskScore
        const spread = patient.riskLevel === 'High Risk' ? 9 : patient.riskLevel === 'Moderate Risk' ? 6 : 4
        const score = Math.max(5, Math.min(99, Math.round(base + (Math.random() - 0.38) * spread)))
        const t = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true })
        setLiveEvents(prev => [{
          time: t, event: desc, riskScore: score,
          riskLevel: score >= 71 ? 'High Risk' : score >= 41 ? 'Moderate Risk' : 'Low Risk',
        }, ...prev].slice(0, 9))
        schedule()
      }, delay)
    }
    // First event after 1.5 s so there's an immediate update
    eventRef.current = setTimeout(() => {
      const desc = getLiveActivity(scenario.scenarioId, currentStage)
      const score = Math.max(5, Math.min(99, patient.riskScore))
      const t = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true })
      setLiveEvents(prev => [{ time: t, event: desc, riskScore: score,
        riskLevel: score >= 71 ? 'High Risk' : score >= 41 ? 'Moderate Risk' : 'Low Risk',
      }, ...prev].slice(0, 9))
      schedule()
    }, 1500)
    return () => { if (eventRef.current) clearTimeout(eventRef.current) }
  }, [patient.id, patient.riskLevel, patient.status, scenario.scenarioId, currentStage, patient.riskScore])

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>

      {/* ── Left: Live skeleton ── */}
      <div style={{ background:'#0F172A', borderRadius:16, padding:'16px 20px 20px',
        display:'flex', flexDirection:'column', gap:12 }}>
        {/* Header bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:9, height:9, borderRadius:'50%', background:'#EF4444',
              boxShadow:'0 0 8px #EF4444' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%',
                background:'#EF4444', animation:'pulse 1s infinite' }} />
            </div>
            <span style={{ fontSize:11, color:'#94A3B8', fontWeight:700,
              textTransform:'uppercase', letterSpacing:'0.1em' }}>LIVE</span>
          </div>
          <span style={{ fontSize:11, color:'#64748B' }}>25 FPS · ST-GCN</span>
        </div>

        {/* Situation banner */}
        <div style={{ padding:'7px 12px', borderRadius:8,
          background:`${scenario.categoryColor}18`, border:`1px solid ${scenario.categoryColor}30` }}>
          <div style={{ fontSize:9, color:'#64748B', textTransform:'uppercase',
            letterSpacing:'0.05em', marginBottom:2 }}>
            {scenario.icon} {scenario.category}
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:scenario.categoryColor }}>
            {lvl === 'Low Risk' ? scenario.normalLabel : scenario.situation}
          </div>
        </div>

        {/* Skeleton */}
        <div style={{ display:'flex', justifyContent:'center' }}>
          <SkeletonCanvas
            patientId={patient.id}
            riskLevel={patient.riskLevel}
            posture={patient.posture}
            patientStatus={patient.status}
            size={200}
            showStageLabel={true}
            showStats={true}
            onFrameChange={setCurrentFrame}
          />
        </div>

        {/* Stats grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginTop:4 }}>
          {[
            ['Posture',     patient.posture,                              '#F97316'],
            ['Risk Score',  `${liveScore}/100`,                          c],
            ['Confidence',  liveConf.toFixed(2),                         '#3B82F6'],
            ['Body Tilt',   `${patient.bodyTilt}°`,                      '#8B5CF6'],
            ['Speed',       `${patient.speed} m/s`,                      '#10B981'],
            ['Status',      liveScore >= 71 ? 'Alert' : liveScore >= 41 ? 'Monitoring' : 'Normal',
              liveScore >= 71 ? '#EF4444' : liveScore >= 41 ? '#F59E0B' : '#14B8A6'],
          ].map(([k, v, col]) => (
            <div key={k} style={{ background:'#1E293B', borderRadius:9, padding:'9px 11px' }}>
              <div style={{ fontSize:10, color:'#64748B', marginBottom:3 }}>{k}</div>
              <div style={{ fontSize:14, fontWeight:700, color:col as string }}>{v}</div>
            </div>
          ))}
        </div>

        <button onClick={() => setIsPlaying(p => !p)} style={{ padding:'9px 0', borderRadius:10,
          border:'none', background:'#1E293B', color: isPlaying ? '#94A3B8' : '#14B8A6',
          cursor:'pointer', fontSize:13, fontWeight:700 }}>
          {isPlaying ? '⏸ Pause' : '▶ Resume'}
        </button>
      </div>

      {/* ── Right: Risk gauge + movement log ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Live risk score */}
        <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB', padding:'16px' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#1F2937', marginBottom:12 }}>
            Live Risk Score
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:18 }}>
            <RiskArc score={liveScore} size={90} />
            <div>
              <div style={{ fontSize:28, fontWeight:900, color:c, lineHeight:1 }}>{liveScore}</div>
              <div style={{ fontSize:12, color:'#6B7280', marginTop:3 }}>
                / 100 — <span style={{ color:c, fontWeight:700 }}>{lvl}</span>
              </div>
              <div style={{ marginTop:6 }}>
                <Sparkline data={liveTrend} color={c} width={130} height={32} filled />
              </div>
            </div>
          </div>
          {/* Fall risk badge */}
          <div style={{ marginTop:12, padding:'8px 12px', borderRadius:10,
            background:frl.bg, border:`1px solid ${frl.color}25`,
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, fontWeight:700, color:frl.color }}>
              {frl.icon} {frl.label}
            </span>
            <span style={{ fontSize:11, color:'#94A3B8' }}>Confidence: {(liveConf * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Stage progression */}
        <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB', padding:'14px 16px' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#1F2937', marginBottom:10 }}>
            Risk Stage Progression
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {STAGE_JUMPS.map((s, i) => {
              const active = liveScore >= (i === 0 ? 0 : i === 1 ? 30 : i === 2 ? 55 : i === 3 ? 75 : 50)
                && (i === STAGE_JUMPS.length - 1 || liveScore < [0,30,55,75,85][i + 1])
              return (
                <div key={s.label} style={{ flex:1, padding:'7px 8px', borderRadius:8, textAlign:'center',
                  background: active ? `${s.color}18` : '#F9FAFB',
                  border:`1px solid ${active ? s.color + '40' : '#E5E7EB'}` }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:s.color,
                    margin:'0 auto 4px', opacity: active ? 1 : 0.3 }} />
                  <div style={{ fontSize:9, fontWeight:700,
                    color: active ? s.color : '#94A3B8' }}>{s.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Live movement log — updates every few seconds */}
        <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB',
          flex:1, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #F3F4F6',
            background:'linear-gradient(90deg,rgba(30,58,138,0.03),transparent)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#1F2937' }}>Movement Log</div>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#14B8A6',
                  animation:'pulse 1.5s infinite' }} />
                <span style={{ fontSize:10, color:'#14B8A6', fontWeight:700 }}>LIVE</span>
              </div>
            </div>
            <div style={{ fontSize:11, color:'#94A3B8', marginTop:1 }}>
              Auto-updating · ST-GCN analysis feed
            </div>
          </div>
          {/* Current frame activity — tied to skeleton animation */}
          {currentFrame && (
            <div style={{ margin:'8px 12px', padding:'8px 12px', borderRadius:9,
              background: currentFrame.stage === 'critical' || currentFrame.stage === 'high'
                ? 'rgba(239,68,68,0.06)' : currentFrame.stage === 'early'
                ? 'rgba(245,158,11,0.06)' : 'rgba(20,184,166,0.06)',
              border:`1px solid ${currentFrame.stageColor}30` }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                  background:currentFrame.stageColor,
                  boxShadow: currentFrame.stage !== 'normal' ? `0 0 5px ${currentFrame.stageColor}` : 'none' }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:currentFrame.stageColor }}>
                    NOW: {currentFrame.stageLabel}
                  </div>
                  <div style={{ fontSize:10, color:'#94A3B8', marginTop:1 }}>
                    Tilt {currentFrame.tilt}° · Sway {Math.abs(currentFrame.swayX)} · {currentFrame.speed.toFixed(2)}m/s
                  </div>
                </div>
                <span style={{ fontSize:11, fontWeight:900, color:scoreColor(currentFrame.risk) }}>
                  {currentFrame.risk}
                </span>
              </div>
            </div>
          )}
          <div style={{ overflowY:'auto', maxHeight:280 }}>
            {liveEvents.length === 0 ? (
              <div style={{ padding:'24px', textAlign:'center', color:'#94A3B8', fontSize:12 }}>
                Awaiting first detection...
              </div>
            ) : liveEvents.map((h, i) => {
              const fr = fallRiskLabel(h.riskScore)
              const isNewest = i === 0
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10,
                  padding:'8px 14px', borderBottom:'1px solid #F9FAFB',
                  background: isNewest ? `${fr.bg}` : 'transparent',
                  transition:'background 0.4s' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0,
                    background:riskColor(h.riskLevel),
                    boxShadow: isNewest && h.riskScore >= 71 ? `0 0 6px ${riskColor(h.riskLevel)}` : 'none' }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:'#1F2937', fontWeight: isNewest ? 700 : 500,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {h.event}
                    </div>
                    <div style={{ fontSize:10, color:'#94A3B8', marginTop:1 }}>{h.time}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:999,
                    background:fr.bg, color:fr.color, flexShrink:0 }}>{fr.icon}</span>
                  <span style={{ fontSize:11, fontWeight:800,
                    color:riskColor(h.riskLevel), flexShrink:0 }}>{h.riskScore}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── History Tab ───────────────────────────────────────────────────────────────
function HistoryTab({ patient, history }: {
  patient: Patient
  history: { time: string; event: string; riskLevel: string; riskScore: number; duration: string }[]
}) {
  const [filter, setFilter] = useState('All')

  const filtered = history.filter(h => {
    if (filter === 'Fall Risk')    return h.riskScore >= 71
    if (filter === 'Near-Fall')    return h.riskScore >= 41 && h.riskScore < 71
    if (filter === 'Normal')       return h.riskScore < 41
    if (filter === 'High Risk')    return h.riskLevel === 'High Risk'
    if (filter === 'Moderate')     return h.riskLevel === 'Moderate Risk'
    return true
  })

  const fallCount   = history.filter(h => h.riskScore >= 71).length
  const nearCount   = history.filter(h => h.riskScore >= 41 && h.riskScore < 71).length
  const normalCount = history.filter(h => h.riskScore < 41).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {[
          { label:'Total Events',    value:history.length, color:'#1E3A8A', icon:'📋' },
          { label:'Fall Risk',       value:fallCount,      color:'#EF4444', icon:'⚠' },
          { label:'Near-Fall Risk',  value:nearCount,      color:'#F59E0B', icon:'⚡' },
          { label:'Normal Activity', value:normalCount,    color:'#14B8A6', icon:'✓' },
        ].map(s => (
          <div key={s.label} style={{ background:'white', border:'1px solid #E5E7EB',
            borderRadius:12, padding:'12px 14px', borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#6B7280', marginTop:1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB', overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #E5E7EB',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'#111827' }}>
              Movement History — {patient.name}
            </div>
            <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>
              {filtered.length} of {history.length} events shown
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['All','Fall Risk','Near-Fall','Normal','High Risk','Moderate'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding:'5px 10px', borderRadius:7, fontSize:11, cursor:'pointer', fontWeight:600,
                border:'1px solid',
                borderColor: filter === f ? (f === 'Fall Risk' || f === 'High Risk' ? '#EF4444' : f === 'Near-Fall' || f === 'Moderate' ? '#F59E0B' : f === 'Normal' ? '#14B8A6' : '#1E3A8A') : '#E5E7EB',
                background:  filter === f ? (f === 'Fall Risk' || f === 'High Risk' ? 'rgba(239,68,68,0.1)' : f === 'Near-Fall' || f === 'Moderate' ? 'rgba(245,158,11,0.1)' : f === 'Normal' ? 'rgba(20,184,166,0.1)' : 'rgba(30,58,138,0.1)') : 'transparent',
                color:       filter === f ? (f === 'Fall Risk' || f === 'High Risk' ? '#EF4444' : f === 'Near-Fall' || f === 'Moderate' ? '#F59E0B' : f === 'Normal' ? '#14B8A6' : '#1E3A8A') : '#64748B',
              }}>{f}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#94A3B8', fontSize:13 }}>
            No events match the selected filter.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#F9FAFB' }}>
                  {['Time','Event / Detected Situation','Fall Risk Assessment','Risk Level','Score','Duration'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10,
                      fontWeight:700, color:'#6B7280', textTransform:'uppercase',
                      letterSpacing:'0.04em', borderBottom:'1px solid #E5E7EB',
                      whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => {
                  const frl = fallRiskLabel(h.riskScore)
                  const isHigh = h.riskScore >= 71
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid #F3F4F6',
                      background: isHigh ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                      <td style={{ padding:'11px 14px', color:'#6B7280', whiteSpace:'nowrap' }}>
                        {h.time}
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ fontWeight:600, color:'#1F2937' }}>{h.event}</div>
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11,
                          fontWeight:700, background:frl.bg, color:frl.color,
                          border:`1px solid ${frl.color}30`, whiteSpace:'nowrap' }}>
                          {frl.icon} {frl.label}
                        </span>
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ padding:'3px 9px', borderRadius:999, fontSize:11,
                          fontWeight:700, background:riskBg(h.riskLevel),
                          color:riskColor(h.riskLevel) }}>{h.riskLevel}</span>
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ fontSize:14, fontWeight:900,
                            color:scoreColor(h.riskScore) }}>{h.riskScore}</span>
                          <div style={{ width:36, height:5, borderRadius:999, background:'#F3F4F6', overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:999, width:`${h.riskScore}%`,
                              background:scoreColor(h.riskScore) }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'11px 14px', color:'#94A3B8', whiteSpace:'nowrap' }}>
                        {h.duration}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Timeline visualization */}
      {history.length > 0 && (
        <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB', padding:'14px 16px' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#1F2937', marginBottom:12 }}>
            Risk Timeline
          </div>
          <div style={{ position:'relative', paddingLeft:16 }}>
            <div style={{ position:'absolute', left:7, top:8, bottom:8, width:2,
              background:'#E5E7EB', borderRadius:1 }} />
            {history.map((h, i) => {
              const frl = fallRiskLabel(h.riskScore)
              return (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12,
                  marginBottom:10, position:'relative' }}>
                  <div style={{ width:12, height:12, borderRadius:'50%',
                    background:frl.color, flexShrink:0, marginTop:2,
                    boxShadow: h.riskScore >= 71 ? `0 0 8px ${frl.color}80` : 'none' }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#1F2937' }}>{h.event}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:999,
                        background:frl.bg, color:frl.color }}>{frl.label}</span>
                    </div>
                    <div style={{ display:'flex', gap:10, marginTop:3 }}>
                      <span style={{ fontSize:11, color:'#94A3B8' }}>{h.time}</span>
                      <span style={{ fontSize:11, fontWeight:700,
                        color:scoreColor(h.riskScore) }}>Score: {h.riskScore}</span>
                      <span style={{ fontSize:11, color:'#94A3B8' }}>Duration: {h.duration}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Replay Tab ────────────────────────────────────────────────────────────────
function ReplayTab({ patient }: { patient: Patient }) {
  const scenario = useMemo(() => getPatientScenario(patient.id, patient.posture), [patient.id, patient.posture])
  const [frameIdx, setFrameIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [looping, setLooping] = useState(true)
  const [joints, setJoints] = useState(() => computeJoints(scenario.frames[0], 0.3))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Alert patients: cap at Near-Fall (frame 29) — the system is showing the APPROACH to the fall,
  // not the recovery. Recovery frames only appear if the patient has been stabilised.
  const isAlert     = patient.status === 'Alert'
  const totalFrames = isAlert ? 30 : scenario.frames.length

  useEffect(() => {
    setFrameIdx(0)
    setPlaying(true)
  }, [patient.id])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!playing) return
    timerRef.current = setInterval(() => {
      setFrameIdx(i => {
        if (i >= totalFrames - 1) {
          if (looping) return 0
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, Math.round(120 / speed))
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, speed, looping, totalFrames])

  useEffect(() => {
    const f = scenario.frames[Math.min(frameIdx, scenario.frames.length - 1)]
    const noise = f.stage === 'critical' ? 1.8 : f.stage === 'high' ? 1.2 : f.stage === 'early' ? 0.7 : 0.3
    setJoints(computeJoints(f, noise))
  }, [frameIdx, scenario.frames])

  const frame = scenario.frames[Math.min(frameIdx, scenario.frames.length - 1)]

  const phasedEvents = [
    { label:'Normal',            time:'00:00', color:'#14B8A6', frameStart:0  },
    { label:'Early Instability', time:'00:16', color:'#F59E0B', frameStart:8  },
    { label:'High Risk',         time:'00:34', color:'#EF4444', frameStart:17 },
    { label:'⚠ Near-Fall Alert', time:'00:48', color:'#EF4444', frameStart:24 },
    ...(isAlert ? [] : [{ label:'Recovery', time:'01:00', color:'#2563EB', frameStart:30 }]),
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Situation banner */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
        borderRadius:12, background:`${scenario.categoryColor}10`,
        border:`1.5px solid ${scenario.categoryColor}30` }}>
        <div style={{ width:38, height:38, borderRadius:10, background:scenario.categoryColor,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:18, flexShrink:0 }}>
          {scenario.icon}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase',
              letterSpacing:'0.06em', padding:'2px 8px', borderRadius:6,
              background:`${scenario.categoryColor}25`, color:scenario.categoryColor }}>
              {scenario.category}
            </span>
            <span style={{ fontSize:13, fontWeight:700, color:'#1F2937' }}>{scenario.situation}</span>
          </div>
          <div style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>
            {patient.name} · {patient.room} / {patient.bed} · ST-GCN Skeletal Analysis · Privacy Preserved
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <div style={{ width:7, height:7, borderRadius:'50%',
            background: playing ? '#14B8A6' : '#94A3B8' }} />
          <span style={{ fontSize:11, fontWeight:700,
            color: playing ? '#14B8A6' : '#94A3B8' }}>{playing ? 'Playing' : 'Paused'}</span>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:14 }}>

        {/* ── Skeleton player ── */}
        <div style={{ background:'#0F172A', borderRadius:16, overflow:'hidden' }}>
          {/* Player header */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #1E293B',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:'white' }}>
                Event Replay — {patient.name}
                <span style={{ fontSize:11, fontWeight:500, color:'#64748B', marginLeft:8 }}>
                  {patient.room} / {patient.bed}
                </span>
              </div>
              <div style={{ fontSize:10, color:'#475569', marginTop:2 }}>
                Edge AI · Skeletal Data Only (No Video) · 5-Second Capture
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6,
                background:'rgba(124,58,237,0.15)', color:'#A78BFA' }}>ST-GCN</span>
              <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6,
                background:'rgba(20,184,166,0.15)', color:'#14B8A6' }}>Edge</span>
            </div>
          </div>

          {/* Canvas + side panel */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 180px' }}>
            {/* SVG canvas */}
            <div style={{ position:'relative', padding:'20px 24px', display:'flex',
              flexDirection:'column', alignItems:'center' }}>
              {/* Stage badge */}
              <div style={{ position:'absolute', top:12, left:12, display:'flex',
                alignItems:'center', gap:6, zIndex:1 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:frame.stageColor,
                  boxShadow:`0 0 8px ${frame.stageColor}` }}>
                  {frame.stage !== 'normal' && (
                    <div style={{ width:'100%', height:'100%', borderRadius:'50%',
                      background:frame.stageColor, animation:'ping 1s infinite', opacity:0.4 }} />
                  )}
                </div>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:6,
                  background:`${frame.stageColor}25`, color:frame.stageColor }}>
                  {frame.stageLabel}
                </span>
              </div>
              {/* Frame counter */}
              <div style={{ position:'absolute', top:14, right:12, fontSize:10, color:'#475569' }}>
                Frame {frameIdx+1}/{totalFrames} · {(frame.t/1000).toFixed(1)}s
              </div>

              <svg width="240" height="280" viewBox="0 0 100 100" style={{ marginTop:24 }}>
                <defs>
                  <radialGradient id="rpGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={frame.stageColor} stopOpacity="0.07" />
                    <stop offset="100%" stopColor={frame.stageColor} stopOpacity="0" />
                  </radialGradient>
                </defs>
                <rect x="0" y="0" width="100" height="100" fill="url(#rpGlow)" />
                <ellipse cx={50 + frame.swayX*0.25} cy={96} rx={8} ry={2}
                  fill={frame.stageColor} opacity="0.22" />
                {Math.abs(frame.swayX) > 3 && (
                  <line x1={50} y1={52} x2={50 + frame.swayX*0.4} y2={52}
                    stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.65" />
                )}
                {BONES.map(([a, b]) => {
                  const ja = joints[a], jb = joints[b]
                  if (!ja || !jb) return null
                  const hot = frame.unstable.includes(a) || frame.unstable.includes(b)
                  return <line key={`${a}-${b}`} x1={ja.x} y1={ja.y} x2={jb.x} y2={jb.y}
                    stroke={hot ? frame.stageColor : '#2563EB'} strokeWidth="2.2"
                    strokeLinecap="round" opacity={hot ? 1 : 0.85} />
                })}
                {Object.entries(joints).map(([name, j]) => {
                  const unstable = frame.unstable.includes(name)
                  const isHead = name === 'head'
                  const col = unstable ? frame.stageColor : '#60A5FA'
                  return (
                    <g key={name}>
                      {unstable && <circle cx={j.x} cy={j.y} r={isHead ? 9 : 5}
                        fill={col} opacity="0.2" />}
                      <circle cx={j.x} cy={j.y} r={isHead ? 6 : unstable ? 3.5 : 2.8}
                        fill={col} stroke="#0F172A" strokeWidth="1" opacity={unstable ? 1 : 0.85} />
                    </g>
                  )
                })}
              </svg>

              {/* Body metrics */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)',
                gap:6, width:'100%', marginTop:12 }}>
                {([
                  ['Tilt',  `${frame.tilt}°`,                frame.tilt > 15 ? '#EF4444' : frame.tilt > 8 ? '#F59E0B' : '#14B8A6'],
                  ['Sway',  `${Math.abs(frame.swayX)}`,      Math.abs(frame.swayX) > 15 ? '#EF4444' : '#14B8A6'],
                  ['Speed', `${frame.speed.toFixed(2)}m/s`,  frame.speed > 0.5 ? '#EF4444' : '#14B8A6'],
                  ['Conf',  `${Math.round(frame.confidence*100)}%`, '#2563EB'],
                ] as [string, string, string][]).map(([k, v, c]) => (
                  <div key={k} style={{ background:'#1E293B', borderRadius:7, padding:'6px 4px', textAlign:'center' }}>
                    <div style={{ fontSize:9, color:'#64748B', fontWeight:600 }}>{k}</div>
                    <div style={{ fontSize:12, fontWeight:800, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk + joint heatmap */}
            <div style={{ borderLeft:'1px solid #1E293B', background:'#0A1628',
              display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'14px 12px', borderBottom:'1px solid #1E293B', textAlign:'center' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'#475569',
                  textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Risk Score</div>
                <div style={{ fontSize:36, fontWeight:900, lineHeight:1,
                  color:scoreColor(frame.risk) }}>{frame.risk}</div>
                <div style={{ fontSize:10, color:'#475569', marginBottom:6 }}>/100</div>
                <div style={{ height:6, borderRadius:999, background:'#1E293B', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:999, width:`${frame.risk}%`,
                    background:scoreColor(frame.risk), transition:'width 0.2s' }} />
                </div>
                <div style={{ marginTop:6, fontSize:10, fontWeight:700, padding:'2px 8px',
                  borderRadius:999, display:'inline-block',
                  background:`${scoreColor(frame.risk)}18`, color:scoreColor(frame.risk) }}>
                  {frame.risk >= 71 ? 'High Risk' : frame.risk >= 41 ? 'Moderate' : 'Low Risk'}
                </div>
              </div>
              <div style={{ padding:'10px 12px', flex:1 }}>
                <div style={{ fontSize:9, fontWeight:700, color:'#475569',
                  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                  Joint Instability
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {ALL_JOINTS.filter(j => j !== 'head').slice(0, 12).map(j => {
                    const isUnstable = frame.unstable.includes(j)
                    const pct = isUnstable
                      ? Math.round(Math.random() * 40 + 55)
                      : Math.round(Math.random() * 18 + 4)
                    return (
                      <div key={j} style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ fontSize:8, width:56, flexShrink:0, textAlign:'right',
                          color: isUnstable ? '#EF4444' : '#475569' }}>
                          {JOINT_LABELS[j]}
                        </div>
                        <div style={{ flex:1, height:4, borderRadius:999, background:'#1E293B' }}>
                          <div style={{ height:'100%', borderRadius:999, width:`${pct}%`,
                            background: isUnstable ? '#EF4444' : '#14B8A6',
                            transition:'width 0.3s' }} />
                        </div>
                        {isUnstable && <span style={{ fontSize:8, color:'#EF4444' }}>!</span>}
                      </div>
                    )
                  })}
                </div>
                <div style={{ marginTop:8, textAlign:'center' }}>
                  <span style={{ fontSize:14, fontWeight:900,
                    color: frame.unstable.length > 5 ? '#EF4444' : frame.unstable.length > 2 ? '#F59E0B' : '#14B8A6' }}>
                    {frame.unstable.length}
                  </span>
                  <span style={{ fontSize:9, color:'#64748B', marginLeft:4 }}>flagged</span>
                </div>
              </div>
            </div>
          </div>

          {/* Playback controls */}
          <div style={{ padding:'14px 16px', borderTop:'1px solid #1E293B' }}>
            {/* Timeline scrubber */}
            <div style={{ position:'relative', marginBottom:10 }}>
              <div style={{ height:8, borderRadius:999, background:'#1E293B', cursor:'pointer' }}
                onClick={e => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setFrameIdx(Math.round(((e.clientX - r.left) / r.width) * (totalFrames - 1)))
                  }}>
                  <div style={{ height:'100%', borderRadius:999,
                    width:`${(frameIdx / Math.max(1, totalFrames - 1)) * 100}%`,
                    background:`linear-gradient(90deg,#14B8A6,#2563EB,${frame.stageColor})` }} />
                  {STAGE_JUMPS.slice(1).filter(s => s.start < totalFrames).map((s, i) => (
                    <div key={i} style={{ position:'absolute', top:-2, width:3, height:12,
                      borderRadius:2, background:s.color, opacity:0.8,
                      left:`${(s.start / Math.max(1, totalFrames - 1)) * 100}%` }} />
                  ))}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between',
                marginTop:4, fontSize:9, color:'#475569' }}>
                {['0s','1s','2s','3s','4s'].map(t => <span key={t}>{t}</span>)}
              </div>
            </div>
            {/* Buttons */}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <button onClick={() => setFrameIdx(0)} style={ctrlBtn}>⏮</button>
              <button onClick={() => setFrameIdx(i => Math.max(0,i-5))} style={ctrlBtn}>‹‹</button>
              <button onClick={() => setPlaying(p => !p)} style={{
                flex:1, padding:'8px 0', borderRadius:10, border:'none', cursor:'pointer',
                fontSize:13, fontWeight:800,
                background: playing ? '#1E293B' : 'linear-gradient(135deg,#1E3A8A,#7C3AED)',
                color: playing ? '#94A3B8' : 'white',
              }}>{playing ? '⏸ Pause' : '▶ Play'}</button>
              <button onClick={() => setFrameIdx(i => Math.min(totalFrames-1,i+5))} style={ctrlBtn}>››</button>
              <button onClick={() => setFrameIdx(totalFrames-1)} style={ctrlBtn}>⏭</button>
              {[0.5,1,2].map(s => (
                <button key={s} onClick={() => setSpeed(s)} style={{
                  padding:'6px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700,
                  border:'1px solid',
                  borderColor: speed === s ? '#14B8A6' : '#334155',
                  background: speed === s ? 'rgba(20,184,166,0.15)' : '#1E293B',
                  color: speed === s ? '#14B8A6' : '#64748B',
                }}>×{s}</button>
              ))}
              <button onClick={() => setLooping(l => !l)} style={{
                padding:'6px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700,
                border:'1px solid',
                borderColor: looping ? '#2563EB' : '#334155',
                background: looping ? 'rgba(37,99,235,0.15)' : '#1E293B',
                color: looping ? '#2563EB' : '#64748B',
              }}>↺ Loop</button>
            </div>
          </div>
        </div>

        {/* ── Right: Event timeline + stage jumps ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Stage jump buttons */}
          <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB',
            padding:'14px 16px' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#1F2937', marginBottom:10 }}>
              Jump to Stage
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {STAGE_JUMPS.filter(s => s.label !== 'Recovery').map((s, i, arr) => {
                const active = frameIdx >= s.start
                  && (i === arr.length-1 || frameIdx < arr[i+1].start)
                return (
                  <button key={s.label} onClick={() => { setFrameIdx(s.start); setPlaying(true) }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                      borderRadius:10, cursor:'pointer', border:`1px solid ${s.color}${active?'':'30'}`,
                      background: active ? `${s.color}15` : 'transparent', textAlign:'left',
                      transition:'all 0.15s' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:s.color,
                      flexShrink:0, opacity: active ? 1 : 0.4,
                      boxShadow: active ? `0 0 6px ${s.color}` : 'none' }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700,
                        color: active ? s.color : '#94A3B8' }}>{s.label}</div>
                      <div style={{ fontSize:10, color:'#94A3B8', marginTop:1 }}>
                        Frame {s.start+1} · {(s.start*0.12).toFixed(1)}s
                      </div>
                    </div>
                    {active && <span style={{ fontSize:10, fontWeight:800, color:s.color }}>▶</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Event timeline */}
          <div style={{ background:'white', borderRadius:14, border:'1px solid #E5E7EB',
            padding:'14px 16px', flex:1 }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#1F2937', marginBottom:10 }}>
              Event Timeline
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {phasedEvents.map((ev, i) => {
                const reached = frameIdx >= ev.frameStart
                return (
                  <div key={i} onClick={() => { setFrameIdx(ev.frameStart); setPlaying(true) }}
                    style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                      padding:'7px 8px', borderRadius:9,
                      background: reached ? `${ev.color}08` : 'transparent',
                      transition:'background 0.2s' }}>
                    <div style={{ width:11, height:11, borderRadius:'50%', background:ev.color,
                      flexShrink:0, opacity: reached ? 1 : 0.3 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600,
                        color: reached ? '#1F2937' : '#94A3B8' }}>{ev.label}</div>
                    </div>
                    <div style={{ fontSize:11, color:'#94A3B8' }}>{ev.time}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ctrlBtn: React.CSSProperties = {
  padding:'8px 12px', borderRadius:9, border:'1px solid #334155',
  background:'#1E293B', color:'#94A3B8', cursor:'pointer', fontSize:13, fontWeight:700,
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ patient }: { patient: Patient }) {
  const sc = scoreColor(patient.riskScore)
  const history = PATIENT_HISTORY[patient.id] ?? []
  const totalAlerts    = history.filter(h => h.riskScore >= 71).length
  const highRiskEvents = history.filter(h => h.riskLevel === 'High Risk').length
  const modEvents      = history.filter(h => h.riskLevel === 'Moderate Risk').length

  const heatmap = [
    { part:'Head',        val:0.95 }, { part:'Neck',       val:0.92 },
    { part:'L.Shoulder',  val:0.88 }, { part:'R.Shoulder', val:0.87 },
    { part:'L.Elbow',     val:0.82 }, { part:'R.Elbow',    val:0.84 },
    { part:'L.Wrist',     val:0.76 }, { part:'R.Wrist',    val:0.78 },
    { part:'Torso',       val:0.94 }, { part:'L.Hip',      val:0.86 },
    { part:'R.Hip',       val:0.85 }, { part:'L.Knee',     val:0.80 },
    { part:'R.Knee',      val:0.81 }, { part:'L.Ankle',    val:0.72 },
    { part:'R.Ankle',     val:0.74 }, { part:'Spine',      val:0.90 },
  ]

  const heatColor = (v: number) => {
    const r = Math.round(239 * (1 - v) + 22 * v)
    const g = Math.round(68 * (1 - v) + 163 * v)
    const b = Math.round(68 * (1 - v) + 74 * v)
    return `rgb(${r},${g},${b})`
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {[
          { label:'Risk Score',       value:`${patient.riskScore}/100`, color:sc },
          { label:'Fall Risk Events', value:String(totalAlerts),        color:'#EF4444' },
          { label:'High Risk Events', value:String(highRiskEvents),     color:'#F97316' },
          { label:'Moderate Events',  value:String(modEvents),          color:'#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background:'white', border:'1px solid #E5E7EB',
            borderRadius:12, padding:'14px 16px', textAlign:'center',
            borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:24, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Heatmap */}
        <div style={{ background:'white', border:'1px solid #E5E7EB', borderRadius:14, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#111827', marginBottom:10 }}>
            Detection Confidence Heatmap
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5 }}>
            {heatmap.map(h => (
              <div key={h.part} style={{ padding:'6px 4px', borderRadius:7,
                background:heatColor(h.val), textAlign:'center' }}>
                <div style={{ fontSize:9, color:'white', fontWeight:700, opacity:0.9 }}>{h.part}</div>
                <div style={{ fontSize:11, color:'white', fontWeight:800 }}>
                  {Math.round(h.val*100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk trend */}
        <div style={{ background:'white', border:'1px solid #E5E7EB', borderRadius:14, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#111827', marginBottom:10 }}>
            Risk Score Trend (30s)
          </div>
          <MiniArea data={patient.trend} color={sc} width={260} height={80} />
          <div style={{ display:'flex', gap:12, marginTop:10, flexWrap:'wrap' }}>
            <div style={{ fontSize:11, color:'#6B7280' }}>
              Min: <b style={{ color:'#14B8A6' }}>{Math.min(...patient.trend)}</b>
            </div>
            <div style={{ fontSize:11, color:'#6B7280' }}>
              Max: <b style={{ color:'#EF4444' }}>{Math.max(...patient.trend)}</b>
            </div>
            <div style={{ fontSize:11, color:'#6B7280' }}>
              Avg: <b style={{ color:'#1F2937' }}>
                {Math.round(patient.trend.reduce((a,b)=>a+b,0)/patient.trend.length)}
              </b>
            </div>
            <div style={{ fontSize:11, color:'#6B7280' }}>
              Trend: <b style={{ color: patient.trendChange > 0 ? '#EF4444' : '#14B8A6' }}>
                {patient.trendChange > 0 ? '▲' : '▼'} {Math.abs(patient.trendChange)}
              </b>
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div style={{ background:'white', border:'1px solid #E5E7EB', borderRadius:14, padding:16 }}>
        <div style={{ fontSize:12, fontWeight:800, color:'#111827', marginBottom:12 }}>
          Key Insights
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {[
            { icon:'⚠️', label:'Risk Trend',          value: patient.trendChange > 0 ? 'Increasing' : 'Decreasing',   note:`${patient.trendChange > 0 ? '+' : ''}${patient.trendChange} over 30s`, color: patient.trendChange > 0 ? '#EF4444' : '#14B8A6' },
            { icon:'🦴', label:'Most Unstable Joint', value:'Lower Limbs', note:'Knee & ankle detected',              color:'#F97316' },
            { icon:'🎯', label:'Avg Confidence',      value:`${Math.round(patient.confidence*100)}%`, note:'Pose detection quality', color:'#3B82F6' },
          ].map(ins => (
            <div key={ins.label} style={{ padding:14, background:'#F9FAFB',
              borderRadius:12, border:'1px solid #F3F4F6' }}>
              <div style={{ fontSize:20, marginBottom:6 }}>{ins.icon}</div>
              <div style={{ fontSize:11, color:'#6B7280' }}>{ins.label}</div>
              <div style={{ fontSize:15, fontWeight:800, color:ins.color, marginTop:2 }}>{ins.value}</div>
              <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{ins.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
