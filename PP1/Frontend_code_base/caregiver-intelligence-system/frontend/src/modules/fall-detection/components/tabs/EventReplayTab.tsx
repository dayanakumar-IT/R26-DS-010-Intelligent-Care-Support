import { useState, useEffect, useRef, useMemo } from 'react'
import { useFallStore } from '../../store/useFallStore'
import { PATIENT_HISTORY } from '../../data/mockData'
import type { Patient } from '../../types'
import {
  getPatientScenario, computeJoints, BONES, STAGE_JUMPS,
  SCENARIO_CATEGORIES, SCENARIO_COLORS, SCENARIO_ICONS,
  type Frame,
} from '../../utils/skeletonScenarios'

const riskColor  = (l: string) => l === 'High Risk' ? '#EF4444' : l === 'Moderate Risk' ? '#F59E0B' : '#14B8A6'
const scoreColor = (s: number) => s >= 71 ? '#EF4444' : s >= 41 ? '#F59E0B' : '#14B8A6'

// ─── Event record built from PATIENT_HISTORY ─────────────────────────────────
interface EventRecord {
  id:            string
  patient:       Patient
  description:   string
  riskLevel:     string
  riskScore:     number
  time:          string
  date:          string
  duration:      string
  category:      string
  categoryColor: string
  icon:          string
  scenarioId:    number
}

const DATES = ['06-05-2026', '05-05-2026', '04-05-2026']

const JOINT_GROUPS = [
  { name: 'Head/Neck', joints: ['neck'],                 min: 10, max: 60 },
  { name: 'Shoulders', joints: ['lShoulder','rShoulder'],min:  8, max: 65 },
  { name: 'Trunk',     joints: ['torso'],                min: 12, max: 70 },
  { name: 'Hips',      joints: ['lHip','rHip'],          min: 14, max: 72 },
  { name: 'Knees',     joints: ['lKnee','rKnee'],        min: 10, max: 78 },
  { name: 'Ankles',    joints: ['lAnkle','rAnkle'],      min:  8, max: 82 },
]

const CONTRIB: Record<string, string[]> = {
  'Bed Event':           ['Morning rise instability', 'Sleep inertia effect', 'Bed edge proximity', 'Low initial detection confidence'],
  'Chair Transfer':      ['Knee flexion weakness', 'Hip joint instability', 'Armrest dependency', 'Centre of gravity shift'],
  'Walking Instability': ['Irregular stride length', 'Foot drop detected', 'Arm swing asymmetry', 'Gait pattern deviation'],
  'Standing Imbalance':  ['Prolonged static loading', 'Postural sway exceeds limit', 'Hip abductor weakness', 'Trunk control deficit'],
  'Sudden Onset':        ['No prior warning signs', 'Rapid acceleration detected', 'Neuromuscular coordination failure', 'Vestibular disturbance'],
  'Night / Confusion':   ['Reduced visual input (night)', 'Disorientation detected', 'Irregular movement path', 'Slow reaction time'],
}

// Maps joint names to JOINT_GROUPS index for heatmap coloring.
const JOINT_GROUP_IDX: Record<string, number> = {
  head: 0, neck: 0,
  lShoulder: 1, rShoulder: 1, lElbow: 1, rElbow: 1, lWrist: 1, rWrist: 1,
  torso: 2,
  lHip: 3, rHip: 3,
  lKnee: 4, rKnee: 4,
  lAnkle: 5, rAnkle: 5,
}

// Interpolates green (#10B981) → amber (#F59E0B) → red (#EF4444) by instability %.
function heatColor(pct: number): string {
  const t = Math.min(1, Math.max(0, (pct - 8) / 74))
  if (t < 0.5) {
    const f = t * 2
    return `rgb(${Math.round(16 + f * 229)},${Math.round(185 - f * 27)},${Math.round(129 - f * 118)})`
  }
  const f = (t - 0.5) * 2
  return `rgb(${Math.round(245 - f * 6)},${Math.round(158 - f * 90)},${Math.round(11 + f * 57)})`
}

// ─── Shared skeleton renderer ─────────────────────────────────────────────────
// heatPctMap: when provided, each joint/bone is coloured by its instability %.
function SkeletonSVG({ frame, joints, width, height, heatPctMap }: {
  frame: Frame
  joints: Record<string, { x: number; y: number }>
  width: number; height: number
  heatPctMap?: Record<string, number>
}) {
  const jc  = (name: string) =>
    heatPctMap ? heatColor(heatPctMap[name] ?? 10) : (frame.unstable.includes(name) ? frame.stageColor : '#4B5563')
  const bc  = (a: string, b: string) =>
    heatPctMap
      ? heatColor(Math.max(heatPctMap[a] ?? 10, heatPctMap[b] ?? 10))
      : frame.stageColor
  const bop = (a: string, b: string) =>
    heatPctMap ? 0.88 : (frame.unstable.includes(a) || frame.unstable.includes(b) ? 0.95 : 0.35)

  return (
    <svg width={width} height={height} viewBox="0 0 100 100">
      <defs>
        <radialGradient id="sGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={frame.stageColor} stopOpacity="0.12" />
          <stop offset="100%" stopColor={frame.stageColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill="url(#sGlow)" />
      <ellipse cx={50 + frame.swayX * 0.25} cy={96} rx={8} ry={2} fill={frame.stageColor} opacity="0.18" />
      {BONES.map(([a, b]) => {
        const ja = joints[a], jb = joints[b]
        if (!ja || !jb) return null
        return (
          <line key={`${a}-${b}`} x1={ja.x} y1={ja.y} x2={jb.x} y2={jb.y}
            stroke={bc(a, b)} strokeWidth="2.4" strokeLinecap="round" opacity={bop(a, b)} />
        )
      })}
      {Object.entries(joints).map(([name, j]) => {
        const unstable = frame.unstable.includes(name)
        const isHead   = name === 'head'
        const col      = jc(name)
        const glow     = heatPctMap || unstable
        return (
          <g key={name}>
            {glow && <circle cx={j.x} cy={j.y} r={isHead ? 9 : 5} fill={col} opacity="0.22" />}
            <circle cx={j.x} cy={j.y} r={isHead ? 6.5 : (glow ? 3.8 : 2.6)}
              fill={col} stroke="#0A0F1A" strokeWidth="1" opacity={glow ? 1 : 0.72} />
          </g>
        )
      })}
      {Math.abs(frame.swayX) > 3 && (
        <line x1={50} y1={52} x2={50 + frame.swayX * 0.4} y2={52}
          stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 2" opacity="0.55" />
      )}
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function EventReplayTab() {
  const { patients } = useFallStore()

  // ── Filters ──────────────────────────────────────────────────────────────
  const [riskFilter,    setRiskFilter]    = useState('All')
  const [roomFilter,    setRoomFilter]    = useState('All')
  const [patientSearch, setPatientSearch] = useState('')

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalEvent, setModalEvent] = useState<EventRecord | null>(null)

  // ── Skeleton animation (modal) ────────────────────────────────────────────
  const [frameIdx,     setFrameIdx]     = useState(0)
  const [playing,      setPlaying]      = useState(false)
  const [speed,        setSpeed]        = useState(1)
  const [heatmapMode,  setHeatmapMode]  = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const scenario = useMemo(
    () => getPatientScenario(modalEvent?.patient.id ?? 'P001', modalEvent?.patient.posture),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modalEvent?.patient.id, modalEvent?.patient.posture],
  )
  const { frames: currentFrames, category, categoryColor } = scenario

  // No Recovery — cap at frame 29 (Near-Fall is the last shown stage)
  const totalFrames = Math.min(currentFrames.length, 30)

  // Start animation at the stage that matches the event's risk level so different
  // severity events immediately look different when the modal opens.
  const { loopStart, loopEnd } = useMemo(() => {
    const r = modalEvent?.riskLevel ?? 'Low Risk'
    if (r === 'High Risk')     return { loopStart: 17, loopEnd: 29 }
    if (r === 'Moderate Risk') return { loopStart: 8,  loopEnd: 16 }
    return                            { loopStart: 0,  loopEnd: 7  }
  }, [modalEvent?.riskLevel])

  const frame    = currentFrames[Math.min(frameIdx, totalFrames - 1)]
  const noiseAmp = frame.stage === 'critical' ? 1.8 : frame.stage === 'high' ? 1.2 : 0.5
  const [joints, setJoints] = useState(() => computeJoints(frame, noiseAmp))

  // Esc closes modal
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, []) // eslint-disable-line

  // Reset to risk-appropriate start frame when a new event is opened
  useEffect(() => {
    setFrameIdx(loopStart)
    setPlaying(!!modalEvent)
    if (!modalEvent && timerRef.current) clearInterval(timerRef.current)
  }, [modalEvent?.patient.id, loopStart]) // eslint-disable-line

  // Animation ticker — loops within loopStart..loopEnd (risk-appropriate zone)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!playing) return
    timerRef.current = setInterval(
      () => setFrameIdx(i => (i >= loopEnd ? loopStart : i + 1)),
      Math.round(120 / speed),
    )
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, speed, loopStart, loopEnd])

  useEffect(() => { setJoints(computeJoints(frame, noiseAmp)) }, [frameIdx]) // eslint-disable-line

  function closeModal() { setModalEvent(null); setPlaying(false); setHeatmapMode(false) }

  // ── Build event list from PATIENT_HISTORY ─────────────────────────────────
  const allEvents = useMemo<EventRecord[]>(() => {
    const out: EventRecord[] = []
    patients.forEach(p => {
      const ps      = getPatientScenario(p.id, p.posture)
      const history = PATIENT_HISTORY[p.id]
      if (history) {
        history.forEach((h, idx) => {
          out.push({
            id:            `${p.id}-H${idx}`,
            patient:       p,
            description:   h.event,
            riskLevel:     h.riskLevel,
            riskScore:     h.riskScore,
            time:          h.time,
            date:          DATES[Math.min(Math.floor(idx / 2), 2)],
            duration:      h.duration,
            category:      ps.category,
            categoryColor: ps.categoryColor,
            icon:          ps.icon,
            scenarioId:    ps.scenarioId,
          })
        })
      } else {
        out.push({
          id:            `${p.id}-0`,
          patient:       p,
          description:   ps.situation,
          riskLevel:     p.riskLevel,
          riskScore:     p.riskScore,
          time:          p.lastUpdated,
          date:          DATES[0],
          duration:      '00:05',
          category:      ps.category,
          categoryColor: ps.categoryColor,
          icon:          ps.icon,
          scenarioId:    ps.scenarioId,
        })
      }
    })
    // Interleave risk groups so High / Moderate / Low events are mixed throughout the list.
    // Within each group events are ordered by risk score desc.
    const byRisk = (l: string) => out.filter(e => e.riskLevel === l).sort((a, b) => b.riskScore - a.riskScore)
    const high = byRisk('High Risk')
    const mod  = byRisk('Moderate Risk')
    const low  = byRisk('Low Risk')
    const mixed: EventRecord[] = []
    const maxLen = Math.max(high.length, mod.length, low.length)
    for (let i = 0; i < maxLen; i++) {
      if (high[i]) mixed.push(high[i])
      if (mod[i])  mixed.push(mod[i])
      if (low[i])  mixed.push(low[i])
    }
    return mixed
  }, [patients])

  const filtered = useMemo(() => allEvents.filter(e => {
    if (riskFilter !== 'All' && e.riskLevel !== riskFilter) return false
    if (roomFilter !== 'All' && e.patient.room !== roomFilter) return false
    if (patientSearch) {
      const q = patientSearch.toLowerCase()
      return e.patient.name.toLowerCase().includes(q) || e.patient.id.toLowerCase().includes(q)
    }
    return true
  }), [allEvents, riskFilter, roomFilter, patientSearch])

  const highCt = filtered.filter(e => e.riskLevel === 'High Risk').length
  const modCt  = filtered.filter(e => e.riskLevel === 'Moderate Risk').length
  const lowCt  = filtered.filter(e => e.riskLevel === 'Low Risk').length

  // No Recovery shown in the modal — only Normal → Early → High → Near-Fall
  const displayedStages = STAGE_JUMPS.filter(s => s.label !== 'Recovery')

  const stageIdx = Math.max(0, STAGE_JUMPS.findIndex((s, i) =>
    frameIdx >= s.start && (i === STAGE_JUMPS.length - 1 || frameIdx < STAGE_JUMPS[i + 1].start),
  ))
  // Risk boost: at frame.risk=73 (HIGH) even "stable" joints show amber, not green.
  // Scales from 0 at risk=30 to ~49 at risk=100, lifting the minimum instability display.
  const riskBoost = Math.max(0, (frame.risk - 30) / 70) * 49
  const groupInstability = JOINT_GROUPS.map(g => {
    const unstableCt = g.joints.filter(j => frame.unstable.includes(j)).length
    const frac       = unstableCt / g.joints.length
    const base       = g.min + frac * (g.max - g.min)
    return { ...g, pct: Math.min(g.max, Math.round(base + riskBoost * (1 - frac))) }
  })

  // Per-joint instability % — fed to SkeletonSVG when heatmap mode is active.
  const heatPctMap: Record<string, number> | undefined = heatmapMode
    ? Object.fromEntries(
        Object.keys(joints).map(n => [n, groupInstability[JOINT_GROUP_IDX[n] ?? 0]?.pct ?? 10])
      )
    : undefined

  // ── Category legend pills ─────────────────────────────────────────────────
  const categories = SCENARIO_CATEGORIES.map((c, i) => ({ label: c, color: SCENARIO_COLORS[i], icon: SCENARIO_ICONS[i] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, flexWrap: 'wrap' }}>

        {/* Patient search */}
        <div style={{ position: 'relative', minWidth: 210 }}>
          <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
            placeholder="Search Patient ID / Name…"
            style={{ padding: '7px 12px 7px 30px', borderRadius: 8, border: '1px solid #E5E7EB',
              fontSize: 12, color: '#111827', background: '#F9FAFB', outline: 'none', width: 210 }} />
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: 13 }}>🔍</span>
        </div>

        <div style={{ width: 1, height: 20, background: '#E5E7EB', flexShrink: 0 }} />

        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Risk:</span>
        {['All', 'High Risk', 'Moderate Risk', 'Low Risk'].map(o => (
          <button key={o} onClick={() => setRiskFilter(o)}
            style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              borderColor: riskFilter === o ? '#1E3A8A' : '#E5E7EB',
              background:  riskFilter === o ? '#1E3A8A' : 'transparent',
              color:       riskFilter === o ? 'white'   : '#64748B' }}>
            {o}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: '#E5E7EB', flexShrink: 0 }} />

        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Room:</span>
        {['All', 'Room 01', 'Room 02'].map(o => (
          <button key={o} onClick={() => setRoomFilter(o)}
            style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              borderColor: roomFilter === o ? '#2563EB' : '#E5E7EB',
              background:  roomFilter === o ? '#2563EB' : 'transparent',
              color:       roomFilter === o ? 'white'   : '#64748B' }}>
            {o}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12 }}>
          <span style={{ color: '#64748B' }}>Total: <b style={{ color: '#1F2937' }}>{filtered.length}</b></span>
          <span style={{ color: '#EF4444' }}>High: <b>{highCt}</b></span>
          <span style={{ color: '#F59E0B' }}>Moderate: <b>{modCt}</b></span>
          <span style={{ color: '#14B8A6' }}>Low: <b>{lowCt}</b></span>
        </div>
      </div>

      {/* ── Category legend ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {categories.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 8, background: `${c.color}12`, border: `1px solid ${c.color}25` }}>
            <span style={{ fontSize: 12 }}>{c.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: c.color }}>{c.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8', alignSelf: 'center' }}>
          Click any event card to launch skeletal replay →
        </div>
      </div>

      {/* ── Event grid ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {filtered.map(evt => {
          const rc = riskColor(evt.riskLevel)
          return (
            <div key={evt.id} onClick={() => { setModalEvent(evt); setFrameIdx(0); setSpeed(1) }}
              style={{ background: 'white', border: `1px solid #E5E7EB`, borderLeft: `3px solid ${rc}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.1)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* Risk score badge */}
                <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, marginTop: 1,
                  background: `${rc}12`, border: `1px solid ${rc}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 14, color: rc }}>
                  {evt.riskScore}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#111827' }}>{evt.patient.name}</span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>{evt.patient.id}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.45, marginBottom: 8 }}>
                    {evt.description}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      background: `${rc}12`, color: rc }}>{evt.riskLevel}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      background: `${evt.categoryColor}12`, color: evt.categoryColor }}>
                      {evt.icon} {evt.category}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B7280' }}>
                    <span>{evt.patient.room} · {evt.patient.bed}</span>
                    <span>{evt.time} · {evt.date}</span>
                  </div>
                </div>

                <span style={{ fontSize: 16, color: '#D1D5DB', marginTop: 2, flexShrink: 0 }}>▶</span>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 52, textAlign: 'center', fontSize: 13, color: '#9CA3AF',
            background: 'white', border: '1px solid #E5E7EB', borderRadius: 12 }}>
            No events match the selected filters.
          </div>
        )}
      </div>

      {/* ── Replay modal ─────────────────────────────────────────────────── */}
      {modalEvent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>

          {/* Backdrop */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={closeModal} />

          {/* Modal card */}
          <div style={{ position: 'relative', width: 820, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto',
            borderRadius: 20, background: 'white', boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }}>

            {/* ── Dark skeleton section ──────────────────────────────────── */}
            <div style={{ background: '#0D1117', borderRadius: '20px 20px 0 0', padding: '18px 22px 20px' }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
                    {modalEvent.time} &nbsp;|&nbsp; {modalEvent.date}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 6,
                      background: 'rgba(124,58,237,0.22)', color: '#A78BFA' }}>ST-GCN</span>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 6,
                      background: 'rgba(20,184,166,0.18)', color: '#14B8A6' }}>Edge AI</span>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 6,
                      background: `${categoryColor}22`, color: categoryColor }}>
                      {modalEvent.icon} {category}
                    </span>
                  </div>
                </div>
                <button onClick={closeModal}
                  style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #334155',
                    background: '#1E293B', color: '#94A3B8', fontSize: 22, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    flexShrink: 0 }}>
                  ×
                </button>
              </div>

              {/* Skeleton canvas */}
              <div style={{ position: 'relative', background: '#0A0F1A', borderRadius: 14, overflow: 'hidden',
                display: 'flex', justifyContent: 'center', minHeight: 320 }}>

                {/* Corner markers */}
                {(['top-left','top-right','bottom-left','bottom-right'] as const).map(pos => {
                  const isTop  = pos.startsWith('top')
                  const isLeft = pos.endsWith('left')
                  return (
                    <div key={pos} style={{
                      position: 'absolute',
                      [isTop ? 'top' : 'bottom']: 10,
                      [isLeft ? 'left' : 'right']: 10,
                      width: 18, height: 18,
                      borderTop:    isTop    ? `2px solid ${frame.stageColor}70` : 'none',
                      borderBottom: !isTop   ? `2px solid ${frame.stageColor}70` : 'none',
                      borderLeft:   isLeft   ? `2px solid ${frame.stageColor}70` : 'none',
                      borderRight:  !isLeft  ? `2px solid ${frame.stageColor}70` : 'none',
                    }} />
                  )
                })}

                {/* Stage badge */}
                <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 6, zIndex: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: frame.stageColor,
                    boxShadow: `0 0 10px ${frame.stageColor}` }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: frame.stageColor,
                    padding: '2px 8px', borderRadius: 5, background: `${frame.stageColor}20` }}>
                    {frame.stageLabel}
                  </span>
                </div>

                {/* Risk score — bottom-left (heatmap button occupies top-right) */}
                <div style={{ position: 'absolute', bottom: 48, left: 14, textAlign: 'left', zIndex: 2 }}>
                  <div style={{ fontSize: 34, fontWeight: 950, color: scoreColor(frame.risk), lineHeight: 1 }}>{frame.risk}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: scoreColor(frame.risk), letterSpacing: '0.1em' }}>
                    {frame.risk >= 71 ? 'HIGH' : frame.risk >= 41 ? 'MED' : 'LOW'}
                  </div>
                </div>

                <SkeletonSVG frame={frame} joints={joints} width={280} height={300} heatPctMap={heatPctMap} />

                {/* Heatmap toggle button */}
                <button onClick={() => setHeatmapMode(m => !m)}
                  style={{
                    position: 'absolute', top: 12, right: 14, zIndex: 3,
                    padding: '4px 11px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 800,
                    border: `1px solid ${heatmapMode ? '#10B981' : '#334155'}`,
                    background: heatmapMode ? 'rgba(16,185,129,0.18)' : 'rgba(30,41,59,0.85)',
                    color: heatmapMode ? '#10B981' : '#64748B',
                    letterSpacing: '0.04em', backdropFilter: 'blur(2px)',
                  }}>
                  🌡 {heatmapMode ? 'HEAT ON' : 'HEATMAP'}
                </button>

                {/* Heatmap legend — shown when heatmap mode is active */}
                {heatmapMode && (
                  <div style={{ position: 'absolute', right: 14, bottom: 48, zIndex: 3,
                    display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 8, color: '#64748B', textAlign: 'right',
                      fontWeight: 700, letterSpacing: '0.06em', marginBottom: 2 }}>INSTABILITY</div>
                    {[['High', '#EF4444'], ['Med', '#F59E0B'], ['Low', '#10B981']] .map(([label, col]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: col }}>{label}</span>
                        <div style={{ width: 18, height: 4, borderRadius: 2, background: col }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Event label */}
                <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 7,
                    background: `${categoryColor}28`, color: categoryColor, border: `1px solid ${categoryColor}38`,
                    whiteSpace: 'nowrap' }}>
                    {modalEvent.description.length > 45
                      ? modalEvent.description.slice(0, 43) + '…'
                      : modalEvent.description}
                  </span>
                </div>
              </div>

              {/* Phase steps — Recovery excluded; animation stops at Near-Fall */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 14, overflowX: 'auto', paddingBottom: 2 }}>
                {displayedStages.map((s, di) => {
                  const origIdx = STAGE_JUMPS.indexOf(s)
                  const active  = stageIdx === origIdx
                  const past    = origIdx < stageIdx
                  return (
                    <div key={origIdx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => { setFrameIdx(s.start); setPlaying(true) }}
                        style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid', fontSize: 10,
                          fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                          borderColor: active ? '#2563EB' : past ? `${s.color}70` : '#334155',
                          background:  active ? '#2563EB' : past ? `${s.color}15` : 'transparent',
                          color:       active ? 'white'   : past ? s.color : '#64748B' }}>
                        {di + 1}. {s.label}
                      </button>
                      {di < displayedStages.length - 1 && (
                        <div style={{ width: 18, height: 1, background: '#334155', flexShrink: 0 }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Playback controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <button onClick={() => { setFrameIdx(loopStart); setPlaying(true) }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #334155',
                    background: '#1E293B', color: '#94A3B8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ⏮ Restart
                </button>
                <button onClick={() => setPlaying(p => !p)}
                  style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none',
                    background: playing ? '#374151' : 'linear-gradient(135deg,#1E3A8A,#7C3AED)',
                    color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                  {playing ? '⏸ Pause' : '▶ Play'}
                </button>
                <button onClick={() => setFrameIdx(i => Math.min(loopEnd, i + 8))}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #334155',
                    background: '#1E293B', color: '#94A3B8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ⏭ Skip
                </button>
                <div style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #334155',
                  background: '#1E293B', color: '#94A3B8', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {(frame.t / 1000).toFixed(1)}s / {(currentFrames[Math.min(totalFrames - 1, currentFrames.length - 1)].t / 1000).toFixed(1)}s
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0.5, 1, 2].map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      style={{ padding: '7px 9px', borderRadius: 7, border: '1px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        borderColor: speed === s ? '#14B8A6' : '#334155',
                        background:  speed === s ? 'rgba(20,184,166,0.15)' : '#1E293B',
                        color:       speed === s ? '#14B8A6' : '#64748B' }}>
                      ×{s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── White info section ─────────────────────────────────────── */}
            <div style={{ padding: '18px 22px 22px' }}>

              {/* Metadata cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Event Type', value: category,                                                                    icon: '🎯' },
                  { label: 'Duration',   value: modalEvent.duration,                                                         icon: '⏱' },
                  { label: 'Phase',      value: `${Math.min(stageIdx + 1, 4)}/4 · ${STAGE_JUMPS[stageIdx]?.label ?? '—'}`, icon: '📍' },
                  { label: 'Room / Bed', value: `${modalEvent.patient.room} · ${modalEvent.patient.bed}`,                   icon: '🛏' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', marginBottom: 4,
                      display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <span>{item.icon}</span>{item.label}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Instability heatmap */}
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#1F2937' }}>
                    Instability Heatmap &amp; Contributing Factors
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF' }}>ST-GCN Analysis · Edge AI</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr 200px' }}>
                  {/* Mini skeleton diagram */}
                  <div style={{ padding: '14px 8px 14px 12px', borderRight: '1px solid #F3F4F6',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
                      letterSpacing: '0.06em', marginBottom: 4 }}>Joint Risk</div>
                    <svg width="66" height="102" viewBox="0 0 33 51">
                      <line x1="16" y1="9"  x2="16" y2="27" stroke="#E5E7EB" strokeWidth="1.2" />
                      <line x1="16" y1="13" x2="9"  y2="20" stroke="#E5E7EB" strokeWidth="1.2" />
                      <line x1="16" y1="13" x2="23" y2="20" stroke="#E5E7EB" strokeWidth="1.2" />
                      <line x1="16" y1="27" x2="11" y2="38" stroke="#E5E7EB" strokeWidth="1.2" />
                      <line x1="16" y1="27" x2="21" y2="38" stroke="#E5E7EB" strokeWidth="1.2" />
                      <line x1="11" y1="38" x2="10" y2="49" stroke="#E5E7EB" strokeWidth="1.2" />
                      <line x1="21" y1="38" x2="22" y2="49" stroke="#E5E7EB" strokeWidth="1.2" />
                      <circle cx="16" cy="5"  r="4"   fill="none" stroke="#E5E7EB" strokeWidth="1.2" />
                      {/* joint dots */}
                      <circle cx="16" cy="5"  r="2.2" fill={frame.unstable.includes('neck')                                                  ? '#EF4444' : '#10B981'} />
                      <circle cx="9"  cy="13" r="2"   fill={frame.unstable.some(j => ['lShoulder','rShoulder'].includes(j))                  ? '#EF4444' : '#10B981'} />
                      <circle cx="23" cy="13" r="2"   fill={frame.unstable.some(j => ['lShoulder','rShoulder'].includes(j))                  ? '#EF4444' : '#10B981'} />
                      <circle cx="16" cy="21" r="2"   fill={frame.unstable.includes('torso')                                                  ? '#EF4444' : '#10B981'} />
                      <circle cx="11" cy="27" r="2"   fill={frame.unstable.some(j => ['lHip','rHip'].includes(j))                            ? '#EF4444' : '#10B981'} />
                      <circle cx="21" cy="27" r="2"   fill={frame.unstable.some(j => ['lHip','rHip'].includes(j))                            ? '#EF4444' : '#10B981'} />
                      <circle cx="10" cy="38" r="2"   fill={frame.unstable.some(j => ['lKnee','rKnee'].includes(j))                          ? '#EF4444' : '#10B981'} />
                      <circle cx="22" cy="38" r="2"   fill={frame.unstable.some(j => ['lKnee','rKnee'].includes(j))                          ? '#EF4444' : '#10B981'} />
                      <circle cx="10" cy="49" r="2"   fill={frame.unstable.some(j => ['lAnkle','rAnkle'].includes(j))                        ? '#EF4444' : '#10B981'} />
                      <circle cx="22" cy="49" r="2"   fill={frame.unstable.some(j => ['lAnkle','rAnkle'].includes(j))                        ? '#EF4444' : '#10B981'} />
                    </svg>
                  </div>

                  {/* Instability bars */}
                  <div style={{ padding: '14px' }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
                      letterSpacing: '0.06em', marginBottom: 10 }}>Joint Instability Index</div>
                    {groupInstability.map(g => (
                      <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                        <div style={{ width: 68, fontSize: 10, fontWeight: 600, color: '#374151', textAlign: 'right', flexShrink: 0 }}>{g.name}</div>
                        <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${g.pct}%`, background: '#10B981', borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ width: 32, fontSize: 10, fontWeight: 700, color: '#374151' }}>{g.pct}%</div>
                      </div>
                    ))}
                  </div>

                  {/* Contributing factors */}
                  <div style={{ padding: '14px', borderLeft: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
                      letterSpacing: '0.06em', marginBottom: 10 }}>Contributing Factors</div>
                    {(CONTRIB[category] ?? []).map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 8 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: categoryColor,
                          marginTop: 4, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.35 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
