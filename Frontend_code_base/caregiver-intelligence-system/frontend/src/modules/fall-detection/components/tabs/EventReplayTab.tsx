import { useState, useEffect, useRef } from 'react'
import { useFallStore } from '../../store/useFallStore'
import type { Patient } from '../../types'

const riskColor = (l: string) => l === 'High Risk' ? '#EF4444' : l === 'Moderate Risk' ? '#F59E0B' : '#14B8A6'
const riskBg    = (l: string) => l === 'High Risk' ? 'rgba(239,68,68,0.08)' : l === 'Moderate Risk' ? 'rgba(245,158,11,0.08)' : 'rgba(20,184,166,0.08)'
const scoreColor = (s: number) => s >= 71 ? '#EF4444' : s >= 41 ? '#F59E0B' : '#14B8A6'

// ─── Frame definition ────────────────────────────────────────────────────────
interface Frame {
  t: number          // ms
  tilt: number       // degrees, + = forward lean
  swayX: number      // px horizontal sway from center
  swayY: number      // px vertical bob
  risk: number       // 0-100
  confidence: number
  speed: number
  unstable: string[] // joint names with instability
  stage: string
  stageLabel: string
  stageColor: string
}

// 50 frames @ 100ms = 5 second clip showing progressive fall risk
const SCENARIO_FRAMES: Frame[] = [
  // Phase 1: Normal standing (0–0.8s)
  { t: 0,   tilt: 2,  swayX: 0,   swayY: 0,   risk: 30, confidence: 0.94, speed: 0.05, unstable: [],                        stage: 'normal',    stageLabel: 'Normal Standing',      stageColor: '#14B8A6' },
  { t: 100, tilt: 2,  swayX: 1,   swayY: 0,   risk: 31, confidence: 0.94, speed: 0.06, unstable: [],                        stage: 'normal',    stageLabel: 'Normal Standing',      stageColor: '#14B8A6' },
  { t: 200, tilt: 3,  swayX: -1,  swayY: 0,   risk: 31, confidence: 0.93, speed: 0.05, unstable: [],                        stage: 'normal',    stageLabel: 'Normal Standing',      stageColor: '#14B8A6' },
  { t: 300, tilt: 2,  swayX: 2,   swayY: 0,   risk: 32, confidence: 0.94, speed: 0.07, unstable: [],                        stage: 'normal',    stageLabel: 'Normal Standing',      stageColor: '#14B8A6' },
  { t: 400, tilt: 3,  swayX: -2,  swayY: 0,   risk: 33, confidence: 0.93, speed: 0.06, unstable: [],                        stage: 'normal',    stageLabel: 'Normal Standing',      stageColor: '#14B8A6' },
  { t: 500, tilt: 2,  swayX: 1,   swayY: -1,  risk: 33, confidence: 0.93, speed: 0.05, unstable: [],                        stage: 'normal',    stageLabel: 'Normal Standing',      stageColor: '#14B8A6' },
  { t: 600, tilt: 4,  swayX: -1,  swayY: 0,   risk: 35, confidence: 0.92, speed: 0.08, unstable: [],                        stage: 'normal',    stageLabel: 'Normal Standing',      stageColor: '#14B8A6' },
  { t: 700, tilt: 3,  swayX: 2,   swayY: 0,   risk: 35, confidence: 0.92, speed: 0.07, unstable: [],                        stage: 'normal',    stageLabel: 'Normal Standing',      stageColor: '#14B8A6' },
  { t: 800, tilt: 4,  swayX: -3,  swayY: -1,  risk: 36, confidence: 0.92, speed: 0.09, unstable: [],                        stage: 'normal',    stageLabel: 'Normal Standing',      stageColor: '#14B8A6' },
  // Phase 2: Early instability (0.9–1.8s)
  { t: 900,  tilt: 6,  swayX: 4,   swayY: -1, risk: 42, confidence: 0.90, speed: 0.14, unstable: ['lAnkle','rAnkle'],       stage: 'early',     stageLabel: 'Early Instability',    stageColor: '#F59E0B' },
  { t: 1000, tilt: 7,  swayX: -5,  swayY: -1, risk: 46, confidence: 0.89, speed: 0.16, unstable: ['lAnkle','rAnkle'],       stage: 'early',     stageLabel: 'Early Instability',    stageColor: '#F59E0B' },
  { t: 1100, tilt: 8,  swayX: 6,   swayY: -2, risk: 50, confidence: 0.88, speed: 0.19, unstable: ['lAnkle','rAnkle','lKnee'], stage: 'early',   stageLabel: 'Early Instability',    stageColor: '#F59E0B' },
  { t: 1200, tilt: 9,  swayX: -7,  swayY: -2, risk: 54, confidence: 0.87, speed: 0.22, unstable: ['lAnkle','rAnkle','lKnee','rKnee'], stage: 'early', stageLabel: 'Micro-Sway Detected', stageColor: '#F59E0B' },
  { t: 1300, tilt: 10, swayX: 8,   swayY: -3, risk: 57, confidence: 0.86, speed: 0.25, unstable: ['lKnee','rKnee','lAnkle','rAnkle'], stage: 'early', stageLabel: 'Micro-Sway Detected', stageColor: '#F59E0B' },
  { t: 1400, tilt: 9,  swayX: -8,  swayY: -2, risk: 55, confidence: 0.87, speed: 0.22, unstable: ['lKnee','rKnee'],         stage: 'early',     stageLabel: 'Balance Correction',   stageColor: '#F59E0B' },
  { t: 1500, tilt: 11, swayX: 9,   swayY: -3, risk: 60, confidence: 0.85, speed: 0.28, unstable: ['lKnee','rKnee','torso'], stage: 'early',     stageLabel: 'Balance Correction',   stageColor: '#F59E0B' },
  { t: 1600, tilt: 12, swayX: -10, swayY: -3, risk: 63, confidence: 0.84, speed: 0.30, unstable: ['lKnee','rKnee','torso','lHip'], stage: 'early', stageLabel: 'Instability Building', stageColor: '#F59E0B' },
  { t: 1700, tilt: 13, swayX: 10,  swayY: -4, risk: 66, confidence: 0.83, speed: 0.33, unstable: ['lKnee','rKnee','torso','lHip','rHip'], stage: 'early', stageLabel: 'Instability Building', stageColor: '#F59E0B' },
  { t: 1800, tilt: 14, swayX: -11, swayY: -4, risk: 68, confidence: 0.82, speed: 0.35, unstable: ['lKnee','rKnee','torso','lHip','rHip'], stage: 'early', stageLabel: 'Instability Building', stageColor: '#F59E0B' },
  // Phase 3: High risk (1.9–3.0s)
  { t: 1900, tilt: 16, swayX: 13,  swayY: -5, risk: 73, confidence: 0.80, speed: 0.40, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle'], stage: 'high', stageLabel: 'HIGH RISK DETECTED', stageColor: '#EF4444' },
  { t: 2000, tilt: 17, swayX: -14, swayY: -5, risk: 76, confidence: 0.78, speed: 0.43, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle'], stage: 'high', stageLabel: 'HIGH RISK DETECTED', stageColor: '#EF4444' },
  { t: 2100, tilt: 18, swayX: 15,  swayY: -6, risk: 79, confidence: 0.77, speed: 0.47, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle','lShoulder'], stage: 'high', stageLabel: 'Rapid Sway Increase', stageColor: '#EF4444' },
  { t: 2200, tilt: 20, swayX: -16, swayY: -6, risk: 82, confidence: 0.75, speed: 0.51, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle','lShoulder'], stage: 'high', stageLabel: 'Rapid Sway Increase', stageColor: '#EF4444' },
  { t: 2300, tilt: 21, swayX: 17,  swayY: -7, risk: 84, confidence: 0.74, speed: 0.54, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle','lShoulder','rShoulder'], stage: 'high', stageLabel: 'Balance Loss Imminent', stageColor: '#EF4444' },
  { t: 2400, tilt: 23, swayX: -18, swayY: -7, risk: 86, confidence: 0.72, speed: 0.58, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle','lShoulder','rShoulder'], stage: 'high', stageLabel: 'Balance Loss Imminent', stageColor: '#EF4444' },
  // Phase 4: Critical / near-fall (3.1–4.0s)
  { t: 2500, tilt: 26, swayX: 20,  swayY: -8, risk: 90, confidence: 0.70, speed: 0.65, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle','lShoulder','rShoulder','neck'], stage: 'critical', stageLabel: '⚠ NEAR-FALL EVENT', stageColor: '#EF4444' },
  { t: 2600, tilt: 28, swayX: -22, swayY: -9, risk: 93, confidence: 0.68, speed: 0.70, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle','lShoulder','rShoulder','neck'], stage: 'critical', stageLabel: '⚠ NEAR-FALL EVENT', stageColor: '#EF4444' },
  { t: 2700, tilt: 30, swayX: 24,  swayY: -10, risk: 95, confidence: 0.66, speed: 0.74, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle','lShoulder','rShoulder','neck'], stage: 'critical', stageLabel: 'Rapid Downward Motion', stageColor: '#EF4444' },
  { t: 2800, tilt: 28, swayX: -22, swayY: -8, risk: 93, confidence: 0.68, speed: 0.68, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle','lShoulder','rShoulder'], stage: 'critical', stageLabel: 'Rapid Downward Motion', stageColor: '#EF4444' },
  { t: 2900, tilt: 26, swayX: 20,  swayY: -7, risk: 92, confidence: 0.70, speed: 0.64, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle','lShoulder'], stage: 'critical', stageLabel: 'Balance Recovery Attempt', stageColor: '#EF4444' },
  { t: 3000, tilt: 24, swayX: -18, swayY: -6, risk: 89, confidence: 0.72, speed: 0.58, unstable: ['lKnee','rKnee','lHip','rHip','torso','lAnkle','rAnkle'], stage: 'critical', stageLabel: 'Balance Recovery Attempt', stageColor: '#EF4444' },
  // Phase 5: Recovery (4.1–5.0s)
  { t: 3100, tilt: 20, swayX: 14,  swayY: -5, risk: 84, confidence: 0.74, speed: 0.50, unstable: ['lKnee','rKnee','lHip','rHip','torso'], stage: 'recovery', stageLabel: 'Stabilising',           stageColor: '#F59E0B' },
  { t: 3200, tilt: 17, swayX: -11, swayY: -4, risk: 78, confidence: 0.78, speed: 0.44, unstable: ['lKnee','rKnee','torso'],              stage: 'recovery', stageLabel: 'Stabilising',           stageColor: '#F59E0B' },
  { t: 3300, tilt: 13, swayX: 8,   swayY: -3, risk: 71, confidence: 0.82, speed: 0.36, unstable: ['lKnee','rKnee'],                       stage: 'recovery', stageLabel: 'Partial Recovery',      stageColor: '#F59E0B' },
  { t: 3400, tilt: 10, swayX: -5,  swayY: -2, risk: 64, confidence: 0.86, speed: 0.28, unstable: ['lAnkle'],                              stage: 'recovery', stageLabel: 'Partial Recovery',      stageColor: '#F59E0B' },
  { t: 3500, tilt: 7,  swayX: 4,   swayY: -1, risk: 56, confidence: 0.89, speed: 0.20, unstable: [],                                      stage: 'recovery', stageLabel: 'Recovering',            stageColor: '#F59E0B' },
  { t: 3600, tilt: 5,  swayX: -2,  swayY: 0,  risk: 48, confidence: 0.91, speed: 0.14, unstable: [],                                      stage: 'recovery', stageLabel: 'Near Stable',           stageColor: '#14B8A6' },
  { t: 3700, tilt: 4,  swayX: 2,   swayY: 0,  risk: 42, confidence: 0.92, speed: 0.10, unstable: [],                                      stage: 'recovery', stageLabel: 'Near Stable',           stageColor: '#14B8A6' },
  { t: 3800, tilt: 3,  swayX: -1,  swayY: 0,  risk: 38, confidence: 0.93, speed: 0.07, unstable: [],                                      stage: 'recovery', stageLabel: 'Stabilised',            stageColor: '#14B8A6' },
  { t: 3900, tilt: 2,  swayX: 1,   swayY: 0,  risk: 34, confidence: 0.94, speed: 0.06, unstable: [],                                      stage: 'recovery', stageLabel: 'Stabilised',            stageColor: '#14B8A6' },
  { t: 4000, tilt: 2,  swayX: 0,   swayY: 0,  risk: 31, confidence: 0.94, speed: 0.05, unstable: [],                                      stage: 'normal',   stageLabel: 'Normal — Monitoring',  stageColor: '#14B8A6' },
]

// ─── Joint base positions (standing) ────────────────────────────────────────
const BASE_JOINTS: Record<string, [number, number]> = {
  head: [50, 10], neck: [50, 22],
  lShoulder: [34, 30], rShoulder: [66, 30],
  lElbow: [26, 46], rElbow: [74, 46],
  lWrist: [22, 60], rWrist: [78, 60],
  torso: [50, 52],
  lHip: [40, 62], rHip: [60, 62],
  lKnee: [38, 76], rKnee: [62, 76],
  lAnkle: [37, 92], rAnkle: [63, 92],
}
const BONES: [string, string][] = [
  ['head','neck'], ['neck','lShoulder'], ['neck','rShoulder'],
  ['lShoulder','lElbow'], ['lElbow','lWrist'],
  ['rShoulder','rElbow'], ['rElbow','rWrist'],
  ['neck','torso'], ['torso','lHip'], ['torso','rHip'],
  ['lHip','lKnee'], ['lKnee','lAnkle'],
  ['rHip','rKnee'], ['rKnee','rAnkle'],
]

function computeJoints(frame: Frame, noise: number) {
  const tiltRad = (frame.tilt * Math.PI) / 180
  const hip = { x: 50 + frame.swayX * 0.3, y: 52 }
  return Object.fromEntries(Object.entries(BASE_JOINTS).map(([name, [bx, by]]) => {
    const dx = bx - 50, dy = by - 52
    const rx = dx * Math.cos(tiltRad) - dy * Math.sin(tiltRad)
    const ry = dx * Math.sin(tiltRad) + dy * Math.cos(tiltRad)
    const jitter = (Math.random() - 0.5) * noise
    return [name, { x: hip.x + rx + jitter, y: hip.y + ry + frame.swayY * 0.2 + jitter }]
  }))
}

// ─── Joint heatmap (all joints with confidence colors) ───────────────────────
const ALL_JOINTS = Object.keys(BASE_JOINTS)
const JOINT_LABELS: Record<string, string> = {
  head: 'Head', neck: 'Neck', lShoulder: 'L.Shoulder', rShoulder: 'R.Shoulder',
  lElbow: 'L.Elbow', rElbow: 'R.Elbow', lWrist: 'L.Wrist', rWrist: 'R.Wrist',
  torso: 'Torso', lHip: 'L.Hip', rHip: 'R.Hip', lKnee: 'L.Knee', rKnee: 'R.Knee',
  lAnkle: 'L.Ankle', rAnkle: 'R.Ankle',
}

// ─── Main component ─────────────────────────────────────────────────────────
export function EventReplayTab() {
  const { patients, alerts } = useFallStore()
  const [riskFilter, setRiskFilter] = useState('All')
  const [roomFilter, setRoomFilter] = useState('All')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [frameIdx, setFrameIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [looping, setLooping] = useState(true)
  const [speed, setSpeed] = useState(1)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Events: high + moderate risk patients
  const events = patients.filter(p => p.riskLevel === 'High Risk' || p.riskLevel === 'Moderate Risk')
    .filter(p => riskFilter === 'All' || p.riskLevel === riskFilter)
    .filter(p => roomFilter === 'All' || p.room === roomFilter)

  const frame = SCENARIO_FRAMES[Math.min(frameIdx, SCENARIO_FRAMES.length - 1)]
  const noiseAmp = frame.stage === 'critical' ? 1.8 : frame.stage === 'high' ? 1.2 : frame.stage === 'early' ? 0.7 : 0.3
  const [joints, setJoints] = useState(() => computeJoints(frame, noiseAmp))

  // Advance frames during playback
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!playing) return
    timerRef.current = setInterval(() => {
      setFrameIdx(i => {
        if (i >= SCENARIO_FRAMES.length - 1) {
          if (looping) return 0
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, Math.round(120 / speed))
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, speed, looping])

  // Recompute joints per frame
  useEffect(() => {
    setJoints(computeJoints(frame, noiseAmp))
  }, [frameIdx])

  const total = events.length
  const highEvts = events.filter(e => e.riskLevel === 'High Risk').length
  const modEvts  = events.filter(e => e.riskLevel === 'Moderate Risk').length

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap" style={{ border: '1px solid #E5E7EB' }}>
        <span className="text-xs font-bold" style={{ color: '#64748B' }}>Risk:</span>
        {['All','High Risk','Moderate Risk'].map(o => (
          <button key={o} onClick={() => setRiskFilter(o)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            style={{ border: '1px solid', borderColor: riskFilter === o ? '#1E3A8A' : '#E5E7EB', background: riskFilter === o ? '#1E3A8A' : 'transparent', color: riskFilter === o ? 'white' : '#64748B' }}>{o}</button>
        ))}
        <div className="w-px h-5 bg-gray-200" />
        <span className="text-xs font-bold" style={{ color: '#64748B' }}>Room:</span>
        {['All','Room 01','Room 02'].map(o => (
          <button key={o} onClick={() => setRoomFilter(o)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            style={{ border: '1px solid', borderColor: roomFilter === o ? '#2563EB' : '#E5E7EB', background: roomFilter === o ? '#2563EB' : 'transparent', color: roomFilter === o ? 'white' : '#64748B' }}>{o}</button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: '#64748B' }}>
          <span>Total: <b style={{ color: '#1F2937' }}>{total}</b></span>
          <span style={{ color: '#EF4444' }}>High: <b>{highEvts}</b></span>
          <span style={{ color: '#F59E0B' }}>Moderate: <b>{modEvts}</b></span>
        </div>
      </div>

      {/* ── Main layout: Skeletal Replay + Patient list ─────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 380px' }}>

        {/* ── ST-GCN Skeletal Replay Viewer ─────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Viewer header */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(30,58,138,0.05),rgba(124,58,237,0.03))' }}>
              <div>
                <div className="text-sm font-black" style={{ color: '#1F2937' }}>
                  ST-GCN Skeletal Analysis Replay
                  {selectedPatient && <span className="ml-2 text-xs font-semibold" style={{ color: '#2563EB' }}>— {selectedPatient.name} ({selectedPatient.room}/{selectedPatient.bed})</span>}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  Edge AI · Privacy-Preserving · Skeletal Data Only (No Video) · 5-Second Capture
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED' }}>ST-GCN</span>
                <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(20,184,166,0.1)', color: '#14B8A6' }}>Edge Device</span>
              </div>
            </div>

            {/* Canvas + info split */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 200px' }}>
              {/* Skeleton canvas */}
              <div className="relative flex flex-col items-center p-6" style={{ background: '#0F172A', minHeight: 400 }}>
                {/* Stage badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: frame.stageColor, boxShadow: `0 0 8px ${frame.stageColor}` }}>
                    {frame.stage !== 'normal' && <div className="w-full h-full rounded-full animate-ping" style={{ background: frame.stageColor, opacity: 0.4 }} />}
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${frame.stageColor}20`, color: frame.stageColor }}>{frame.stageLabel}</span>
                </div>
                {/* Frame counter */}
                <div className="absolute top-4 right-4 text-xs" style={{ color: '#475569' }}>
                  Frame {frameIdx + 1}/{SCENARIO_FRAMES.length} · {(frame.t / 1000).toFixed(1)}s
                </div>

                {/* Skeleton SVG */}
                <svg width="220" height="280" viewBox="0 0 100 100" style={{ marginTop: 20 }}>
                  <defs>
                    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={frame.stageColor} stopOpacity="0.06" />
                      <stop offset="100%" stopColor={frame.stageColor} stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <rect x="0" y="0" width="100" height="100" fill="url(#bgGlow)" />

                  {/* Balance center indicator */}
                  <ellipse cx={50 + frame.swayX * 0.25} cy={96} rx={8} ry={2}
                    fill={frame.stageColor} opacity="0.25" />
                  <line x1={50} y1={96} x2={50 + frame.swayX * 0.25} y2={96}
                    stroke={frame.stageColor} strokeWidth="0.6" strokeDasharray="2 1" opacity="0.5" />

                  {/* Bones */}
                  {BONES.map(([a, b]) => {
                    const ja = joints[a], jb = joints[b]
                    if (!ja || !jb) return null
                    const isUnstableA = frame.unstable.includes(a)
                    const isUnstableB = frame.unstable.includes(b)
                    const boneColor = (isUnstableA || isUnstableB) ? frame.stageColor : '#2563EB'
                    return (
                      <line key={`${a}-${b}`} x1={ja.x} y1={ja.y} x2={jb.x} y2={jb.y}
                        stroke={boneColor} strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
                    )
                  })}

                  {/* Joints */}
                  {Object.entries(joints).map(([name, j]) => {
                    const isUnstable = frame.unstable.includes(name)
                    const isHead = name === 'head'
                    const jColor = isUnstable ? frame.stageColor : '#60A5FA'
                    return (
                      <g key={name}>
                        {isUnstable && <circle cx={j.x} cy={j.y} r={isHead ? 9 : 5} fill={jColor} opacity="0.2" />}
                        <circle cx={j.x} cy={j.y} r={isHead ? 6 : isUnstable ? 3.5 : 2.8}
                          fill={jColor} stroke="#0F172A" strokeWidth="1"
                          opacity={isUnstable ? 1 : 0.85} />
                      </g>
                    )
                  })}

                  {/* Sway vector arrow */}
                  {Math.abs(frame.swayX) > 3 && (() => {
                    const tipX = 50 + frame.swayX * 0.4
                    return (
                      <line x1={50} y1={52} x2={tipX} y2={52}
                        stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="3 2"
                        markerEnd="url(#arrow)" opacity="0.7" />
                    )
                  })()}
                  <defs>
                    <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill="#F59E0B" opacity="0.7" />
                    </marker>
                  </defs>
                </svg>

                {/* Body stats below skeleton */}
                <div className="grid gap-1.5 w-full mt-2" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                  {[
                    ['Tilt', `${frame.tilt}°`, frame.tilt > 15 ? '#EF4444' : frame.tilt > 8 ? '#F59E0B' : '#14B8A6'],
                    ['Sway', `${Math.abs(frame.swayX).toFixed(0)}px`, Math.abs(frame.swayX) > 15 ? '#EF4444' : Math.abs(frame.swayX) > 8 ? '#F59E0B' : '#14B8A6'],
                    ['Speed', `${frame.speed.toFixed(2)}m/s`, frame.speed > 0.5 ? '#EF4444' : '#14B8A6'],
                    ['Conf', `${Math.round(frame.confidence * 100)}%`, '#2563EB'],
                  ].map(([k, v, c]) => (
                    <div key={k as string} className="rounded-lg px-2 py-1.5 text-center" style={{ background: '#1E293B' }}>
                      <div className="text-[9px] font-semibold" style={{ color: '#64748B' }}>{k}</div>
                      <div className="text-sm font-black" style={{ color: c as string }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel: risk score + heatmap */}
              <div className="flex flex-col gap-0" style={{ borderLeft: '1px solid #1E293B', background: '#0F172A' }}>
                {/* Risk score */}
                <div className="p-4 text-center" style={{ borderBottom: '1px solid #1E293B' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#64748B' }}>Risk Score</div>
                  <div className="text-4xl font-black" style={{ color: scoreColor(frame.risk) }}>{frame.risk}</div>
                  <div className="text-xs" style={{ color: '#475569' }}>/100</div>
                  <div className="mt-1 text-xs font-bold px-2 py-0.5 rounded-full inline-block"
                    style={{ background: `${scoreColor(frame.risk)}18`, color: scoreColor(frame.risk) }}>
                    {frame.risk >= 71 ? 'High Risk' : frame.risk >= 41 ? 'Moderate' : 'Low Risk'}
                  </div>
                  {/* Mini risk bar */}
                  <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: '#1E293B' }}>
                    <div className="h-full rounded-full transition-all duration-200" style={{ width: `${frame.risk}%`, background: scoreColor(frame.risk) }} />
                  </div>
                </div>

                {/* Joint instability heatmap */}
                <div className="p-3 flex-1">
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Joint Instability</div>
                  <div className="flex flex-col gap-1">
                    {ALL_JOINTS.filter(j => j !== 'head').slice(0, 12).map(j => {
                      const isUnstable = frame.unstable.includes(j)
                      const stability = isUnstable ? Math.random() * 0.4 + 0.5 : Math.random() * 0.2 + 0.05
                      const barColor = isUnstable ? '#EF4444' : '#14B8A6'
                      return (
                        <div key={j} className="flex items-center gap-1.5">
                          <div className="text-[9px] w-16 shrink-0 text-right" style={{ color: isUnstable ? '#EF4444' : '#475569' }}>{JOINT_LABELS[j]}</div>
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1E293B' }}>
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${stability * 100}%`, background: barColor }} />
                          </div>
                          {isUnstable && <span className="text-[8px]" style={{ color: '#EF4444' }}>!</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Unstable count */}
                <div className="px-3 pb-3 text-center">
                  <span className="text-sm font-black" style={{ color: frame.unstable.length > 5 ? '#EF4444' : frame.unstable.length > 2 ? '#F59E0B' : '#14B8A6' }}>
                    {frame.unstable.length}
                  </span>
                  <span className="text-[10px] ml-1" style={{ color: '#64748B' }}>joints flagged</span>
                </div>
              </div>
            </div>

            {/* ── Playback controls ──────────────────────────────────── */}
            <div className="px-5 py-4" style={{ background: '#0F172A', borderTop: '1px solid #1E293B' }}>
              {/* Timeline */}
              <div className="relative mb-3">
                <div className="h-2 rounded-full cursor-pointer" style={{ background: '#1E293B' }}
                  onClick={e => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setFrameIdx(Math.round(((e.clientX - r.left) / r.width) * (SCENARIO_FRAMES.length - 1)))
                  }}>
                  {/* Filled progress */}
                  <div className="h-full rounded-full transition-all" style={{ width: `${(frameIdx / (SCENARIO_FRAMES.length - 1)) * 100}%`, background: `linear-gradient(90deg, #14B8A6, #2563EB, ${frame.stageColor})` }} />
                  {/* Stage markers */}
                  {[8, 17, 24, 30, 35].map((f, i) => (
                    <div key={i} className="absolute -top-0.5 w-1 h-3 rounded" style={{ left: `${(f / (SCENARIO_FRAMES.length - 1)) * 100}%`, background: ['#14B8A6','#F59E0B','#EF4444','#EF4444','#F59E0B'][i], opacity: 0.7 }} />
                  ))}
                </div>
                {/* Stage labels */}
                <div className="flex justify-between mt-1" style={{ fontSize: 8, color: '#475569' }}>
                  {['0s','1s','2s','3s','4s'].map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button onClick={() => setFrameIdx(0)} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer" style={{ border: '1px solid #334155', background: '#1E293B', color: '#94A3B8' }}>⏮</button>
                <button onClick={() => setFrameIdx(i => Math.max(0, i - 5))} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer" style={{ border: '1px solid #334155', background: '#1E293B', color: '#94A3B8' }}>‹‹</button>
                <button onClick={() => setPlaying(p => !p)} className="flex-1 py-2 rounded-lg text-sm font-black cursor-pointer" style={{ border: 'none', background: playing ? '#1E293B' : `linear-gradient(135deg,#1E3A8A,#7C3AED)`, color: playing ? '#94A3B8' : 'white' }}>
                  {playing ? '⏸ Pause' : '▶ Play'}
                </button>
                <button onClick={() => setFrameIdx(i => Math.min(SCENARIO_FRAMES.length - 1, i + 5))} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer" style={{ border: '1px solid #334155', background: '#1E293B', color: '#94A3B8' }}>››</button>
                <button onClick={() => setFrameIdx(SCENARIO_FRAMES.length - 1)} className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer" style={{ border: '1px solid #334155', background: '#1E293B', color: '#94A3B8' }}>⏭</button>
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-xs" style={{ color: '#64748B' }}>×</span>
                  {[0.5, 1, 2].map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className="px-2 py-1 rounded text-xs font-bold cursor-pointer"
                      style={{ border: '1px solid', borderColor: speed === s ? '#14B8A6' : '#334155', background: speed === s ? 'rgba(20,184,166,0.15)' : '#1E293B', color: speed === s ? '#14B8A6' : '#64748B' }}>{s}</button>
                  ))}
                </div>
                <button onClick={() => setLooping(l => !l)}
                  className="px-2 py-1 rounded text-xs font-bold cursor-pointer ml-1"
                  style={{ border: '1px solid', borderColor: looping ? '#2563EB' : '#334155', background: looping ? 'rgba(37,99,235,0.15)' : '#1E293B', color: looping ? '#2563EB' : '#64748B' }}>↺ Loop</button>
              </div>
            </div>
          </div>

          {/* ── ST-GCN Analysis Panel ────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E5E7EB' }}>
            <div className="text-sm font-black mb-4" style={{ color: '#1F2937' }}>
              ST-GCN Analysis · <span style={{ color: frame.stageColor }}>{frame.stageLabel}</span>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              {[
                { label: 'Body Tilt',        value: `${frame.tilt}°`,                   detail: frame.tilt > 20 ? 'Critical lean' : frame.tilt > 10 ? 'Moderate lean' : 'Within safe range', color: frame.tilt > 15 ? '#EF4444' : frame.tilt > 8 ? '#F59E0B' : '#14B8A6', icon: '📐' },
                { label: 'Sway Velocity',    value: `${Math.abs(frame.swayX) * 0.03 + 0.02}m/s`, detail: 'Lateral oscillation speed', color: Math.abs(frame.swayX) > 15 ? '#EF4444' : '#F59E0B', icon: '↔' },
                { label: 'Joint Instability', value: `${frame.unstable.length} joints`, detail: frame.unstable.length > 5 ? 'Multiple joints affected' : frame.unstable.length > 0 ? frame.unstable.slice(0,2).join(', ') : 'All stable', color: frame.unstable.length > 5 ? '#EF4444' : frame.unstable.length > 2 ? '#F59E0B' : '#14B8A6', icon: '🦴' },
                { label: 'Pose Confidence',  value: `${Math.round(frame.confidence * 100)}%`, detail: 'Edge device detection quality', color: frame.confidence > 0.85 ? '#14B8A6' : '#F59E0B', icon: '🎯' },
                { label: 'Movement Speed',   value: `${frame.speed.toFixed(2)} m/s`,    detail: frame.speed > 0.5 ? 'Fast movement detected' : 'Normal speed', color: frame.speed > 0.5 ? '#EF4444' : '#14B8A6', icon: '⚡' },
                { label: 'Risk Trajectory',  value: frameIdx > 5 ? `${SCENARIO_FRAMES[Math.max(0,frameIdx-5)].risk} → ${frame.risk}` : `—`, detail: frame.risk > SCENARIO_FRAMES[Math.max(0,frameIdx-1)].risk ? 'Escalating' : 'Stabilising', color: frame.risk > SCENARIO_FRAMES[Math.max(0,frameIdx-1)].risk ? '#EF4444' : '#14B8A6', icon: '📈' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{item.label}</span>
                  </div>
                  <div className="text-base font-black" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{item.detail}</div>
                </div>
              ))}
            </div>
            {/* Stage timeline */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #F3F4F6' }}>
              <div className="text-xs font-bold mb-2" style={{ color: '#64748B' }}>Event Progression</div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Normal',        start: 0,  end: 8,  color: '#14B8A6' },
                  { label: 'Early Signs',   start: 9,  end: 18, color: '#F59E0B' },
                  { label: 'High Risk',     start: 19, end: 25, color: '#EF4444' },
                  { label: 'Near-Fall',     start: 26, end: 30, color: '#EF4444' },
                  { label: 'Recovery',      start: 31, end: 39, color: '#F59E0B' },
                  { label: 'Stabilised',    start: 36, end: 39, color: '#14B8A6' },
                ].map((stage, i) => {
                  const active = frameIdx >= stage.start && frameIdx <= stage.end
                  return (
                    <button key={i} onClick={() => setFrameIdx(stage.start)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all"
                      style={{ border: `1px solid ${stage.color}${active ? '' : '40'}`, background: active ? `${stage.color}20` : 'transparent', color: active ? stage.color : '#94A3B8' }}>
                      {stage.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Patient event list ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(30,58,138,0.04),transparent)' }}>
              <div className="text-sm font-black" style={{ color: '#1F2937' }}>Recorded Events</div>
              <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{events.length} events · Click to analyse</div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 600 }}>
              {events.map(p => {
                const isSelected = selectedPatient?.id === p.id
                return (
                  <div key={p.id} onClick={() => { setSelectedPatient(p); setFrameIdx(0); setPlaying(true) }}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all"
                    style={{ borderBottom: '1px solid #F9FAFB', background: isSelected ? `${riskBg(p.riskLevel)}` : 'transparent', borderLeft: isSelected ? `3px solid ${riskColor(p.riskLevel)}` : '3px solid transparent' }}>
                    {/* Risk indicator */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0"
                      style={{ background: riskBg(p.riskLevel), color: riskColor(p.riskLevel), border: `1px solid ${riskColor(p.riskLevel)}40` }}>
                      {p.riskScore}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate" style={{ color: '#1F2937' }}>{p.name}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>{p.room} / {p.bed} · {p.lastUpdated}</div>
                      <div className="mt-1">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: riskBg(p.riskLevel), color: riskColor(p.riskLevel) }}>{p.riskLevel}</span>
                      </div>
                    </div>
                    <div className="text-xs font-black" style={{ color: riskColor(p.riskLevel) }}>
                      {isSelected ? '▶' : '○'}
                    </div>
                  </div>
                )
              })}
              {events.length === 0 && (
                <div className="p-8 text-center text-xs" style={{ color: '#94A3B8' }}>No events match the selected filters.</div>
              )}
            </div>
          </div>

          {/* System info */}
          <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E5E7EB' }}>
            <div className="text-xs font-black mb-3" style={{ color: '#1F2937' }}>System Architecture</div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Camera',         value: 'USB Camera 01',   color: '#14B8A6' },
                { label: 'Processing',     value: 'Edge Device (Local)', color: '#2563EB' },
                { label: 'AI Model',       value: 'ST-GCN v2.1',    color: '#7C3AED' },
                { label: 'Privacy',        value: 'No video stored', color: '#14B8A6' },
                { label: 'Latency',        value: '< 50ms',          color: '#2563EB' },
                { label: 'Frame Rate',     value: '25 FPS',          color: '#1E3A8A' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-xs py-1" style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <span style={{ color: '#94A3B8' }}>{item.label}</span>
                  <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
