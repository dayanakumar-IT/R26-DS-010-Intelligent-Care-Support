import React, { useEffect, useState, useCallback, useRef } from 'react'
import Icon from '../../../shared/components/Icon'
import type { IconName } from '../../../shared/components/Icon'
import StatCard from '../components/StatCard'
import RiskBadge from '../components/RiskBadge'
import { api } from '../api/client'
import type { Room, Patient, Alert, DashboardSummary, Caregiver } from '../api/client'
import styles from './Overview.module.css'

// ── Skeleton constants (from config/settings.py) ─────────────────────────────
const BONES: [number,number][] = [
  [0,1],[1,2],[1,3],[2,4],[3,5],[4,6],[5,7],
  [1,8],[1,9],[8,9],[8,10],[9,11],[10,12],[11,13],
]
const JOINT_COLORS = {
  NORMAL:   { bone:'#22c55e', joint:'#16a34a', head:'#15803d' },
  MODERATE: { bone:'#f59e0b', joint:'#d97706', head:'#b45309' },
  HIGH:     { bone:'#ef4444', joint:'#dc2626', head:'#b91c1c' },
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
interface TabDef { id: string; label: string; icon: IconName }
const TABS: TabDef[] = [
  { id: 'dashboard',    label: 'Dashboard',        icon: 'activity'    },
  { id: 'rooms',        label: 'Rooms',             icon: 'footprints'  },
  { id: 'patients',     label: 'Patients & Beds',   icon: 'users'       },
  { id: 'live',         label: 'Live Monitoring',   icon: 'eye'         },
  { id: 'alerts',       label: 'Alerts',            icon: 'warning'     },
  { id: 'replay',       label: 'Event Replay',      icon: 'heart-pulse' },
  { id: 'history',      label: 'History',           icon: 'trending-up' },
  { id: 'analytics',    label: 'Analytics',         icon: 'bar-chart-3' },
  { id: 'reports',      label: 'Reports',           icon: 'bar-chart-3' },
  { id: 'users',        label: 'Users & Roles',     icon: 'users'       },
  { id: 'config',       label: 'Camera Config',     icon: 'settings'    },
  { id: 'zoneconfig',   label: 'Zone Config',        icon: 'settings'    },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
function genderLabel(g: string | null) {
  if (g === 'M') return 'Male'
  if (g === 'F') return 'Female'
  if (g === 'Other') return 'Other'
  return '—'
}

// ── PANEL: Dashboard ──────────────────────────────────────────────────────────
function DashboardPanel({ summary, rooms, patients, alerts, loading }: {
  summary: DashboardSummary | null; rooms: Room[]; patients: Patient[]; alerts: Alert[]; loading: boolean
}) {
  // Derive risk counts from alerts directly — summary.patients_by_level only counts
  // patients with patient_id set in fall_events, which is often NULL in early demos.
  const highCount  = alerts.filter(a => a.risk_level === 'HIGH').length
  const modCount   = alerts.filter(a => a.risk_level === 'MODERATE').length
  const ackedToday = alerts.filter(a => a.acknowledged && new Date(a.timestamp).toDateString() === new Date().toDateString()).length
  const total      = alerts.length   // total events, not patients
  const unacked   = summary?.unacknowledged_alerts ?? alerts.filter(a => !a.acknowledged).length

  // Rooms live vs offline — donut input
  const liveRooms = rooms.filter(r => r.camera_src).length
  const offlineRooms = rooms.length - liveRooms

  // Risk score trend (last 12h, from alert timestamps) — sparkline input
  const now = Date.now()
  const hourBuckets = Array.from({ length: 12 }, (_, i) => {
    const start = now - (11 - i) * 3600_000
    const bucket = alerts.filter(a => {
      const t = new Date(a.timestamp).getTime()
      return t >= start && t < start + 3600_000
    })
    return bucket.length > 0 ? bucket.reduce((s, a) => s + a.risk_score, 0) / bucket.length : 0
  })

  return (
    <div>
      {/* KPI stat cards */}
      <div className={styles.kpiGrid}>
        <StatCard label="Total Alerts"   value={String(total || 0)}   sub={`${rooms.length} rooms · ${rooms.filter(r=>r.camera_src).length} live`} accent="blue"  />
        <StatCard label="Acked Today"    value={String(ackedToday)}   sub={ackedToday > 0 ? 'responded' : 'pending response'} accent="green" />
        <StatCard label="Moderate Risk"  value={String(modCount)}     sub={total ? `${Math.round(modCount/total*100)}% of events` : '0%'} accent="amber" />
        <StatCard label="High Risk"      value={String(highCount)}    sub={total ? `${Math.round(highCount/total*100)}% of events` : '0%'} accent="red"   />
        <StatCard label="Active Alerts"  value={String(unacked || 0)} sub="Unacknowledged"           accent="red"   />
      </div>

      {/* Chart-only overview — spacious, static, no lists/tables */}
      <div className={styles.dashChartsGrid}>
        <div className={styles.analyticCard2}>
          <div className={styles.analyticTitle}>Risk Distribution</div>
          {total > 0 ? (
            <div className={styles.donutWrap}>
              <DonutChart size={140} slices={[
                { label:'HIGH', val:highCount, color:'#ef4444' },
                { label:'MODERATE', val:modCount, color:'#f59e0b' },
              ]} />
              <div className={styles.donutLegend}>
                {[
                  { label:'High Risk', val:highCount, color:'#ef4444' },
                  { label:'Moderate', val:modCount, color:'#f59e0b' },
                ].map(s => (
                  <div key={s.label} className={styles.donutLegendRow}>
                    <span className={styles.donutDot} style={{background:s.color}} />
                    <span className={styles.donutLegendLabel}>{s.label}</span>
                    <span className={styles.donutLegendVal}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className={styles.empty} style={{padding:'32px 0'}}>No inference data yet</div>}
        </div>

        <div className={styles.analyticCard2}>
          <div className={styles.analyticTitle}>Camera Coverage</div>
          {rooms.length > 0 ? (
            <div className={styles.donutWrap}>
              <DonutChart size={140} slices={[
                { label:'Live', val:liveRooms, color:'#3b82f6' },
                { label:'Offline', val:offlineRooms, color:'#e2e8f0' },
              ]} />
              <div className={styles.donutLegend}>
                <div className={styles.donutLegendRow}>
                  <span className={styles.donutDot} style={{background:'#3b82f6'}} />
                  <span className={styles.donutLegendLabel}>Live</span>
                  <span className={styles.donutLegendVal}>{liveRooms}</span>
                </div>
                <div className={styles.donutLegendRow}>
                  <span className={styles.donutDot} style={{background:'#cbd5e1'}} />
                  <span className={styles.donutLegendLabel}>Offline</span>
                  <span className={styles.donutLegendVal}>{offlineRooms}</span>
                </div>
              </div>
            </div>
          ) : <div className={styles.empty} style={{padding:'32px 0'}}>No rooms configured</div>}
        </div>

        <div className={styles.analyticCard2}>
          <div className={styles.analyticTitle}>Average Risk Score — Last 12 Hours</div>
          <SparkLine data={hourBuckets} color="#ef4444" width={320} height={90} />
          <div className={styles.analyticSub}>Hourly mean risk score across all active alerts</div>
        </div>

        <div className={styles.analyticCard2}>
          <div className={styles.analyticTitle}>Alerts by Risk Level</div>
          <MiniBarChart height={100} items={[
            { label:'High', val:highCount, color:'#ef4444' },
            { label:'Moderate', val:modCount, color:'#f59e0b' },
          ]} />
        </div>
      </div>
    </div>
  )
}

// ── PANEL: Rooms ──────────────────────────────────────────────────────────────
function RoomsPanel({
  rooms, caregivers, loading, onAssignCaregiver,
}: {
  rooms: Room[]
  caregivers: Caregiver[]
  loading: boolean
  onAssignCaregiver: (roomCode: string, caregiverId: string) => void
}) {
  const [assigning,  setAssigning]  = useState<Record<string, boolean>>({})
  const [saved,      setSaved]      = useState<Record<string, boolean>>({})
  const [pending,    setPending]    = useState<Record<string, string>>({})   // roomCode → selected cgId
  const [search,     setSearch]     = useState('')
  const [wardFilter, setWardFilter] = useState('All')

  const cgMap  = Object.fromEntries(caregivers.map(c => [c.id, c]))
  const wards  = ['All', ...Array.from(new Set(rooms.map(r => r.ward ?? 'No ward')))]
  const filtered = rooms.filter(r => {
    const matchSearch = r.room_code.toLowerCase().includes(search.toLowerCase()) ||
      (r.ward ?? '').toLowerCase().includes(search.toLowerCase())
    const matchWard = wardFilter === 'All' || (r.ward ?? 'No ward') === wardFilter
    return matchSearch && matchWard
  })

  // key: roomCode for display state; but API needs numeric id
  const roomIdMap = Object.fromEntries(rooms.map(r => [r.room_code, String(r.id)]))

  const handleSave = async (roomCode: string) => {
    const cgId = pending[roomCode]
    if (!cgId) return
    setAssigning(a => ({ ...a, [roomCode]: true }))
    try {
      const numericId = roomIdMap[roomCode] ?? roomCode
      await onAssignCaregiver(numericId, cgId)   // ← pass numeric id to API
      setSaved(s => ({ ...s, [roomCode]: true }))
      setPending(p => { const n = { ...p }; delete n[roomCode]; return n })
      setTimeout(() => setSaved(s => ({ ...s, [roomCode]: false })), 2500)
    } finally {
      setAssigning(a => ({ ...a, [roomCode]: false }))
    }
  }

  if (loading && !rooms.length) return <div className={styles.empty}>Loading rooms…</div>
  if (!loading && !rooms.length) return <div className={styles.empty}>No rooms configured yet.</div>

  return (
    <div>
      {/* Toolbar */}
      <div className={styles.panelToolbar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            placeholder="Search rooms or wards…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filterChips}>
          {wards.map(w => (
            <button
              key={w}
              className={`${styles.chip} ${wardFilter === w ? styles.chipActive : ''}`}
              onClick={() => setWardFilter(w)}
            >{w}</button>
          ))}
        </div>
        <span className={styles.countLabel}>{filtered.length} of {rooms.length} rooms</span>
      </div>

      <div className={styles.roomGrid}>
        {filtered.map(r => {
          const cg = r.caregiver_id ? cgMap[r.caregiver_id] : null
          const hasPending = !!pending[r.room_code]
          return (
            <div key={r.id} className={styles.roomCard}>
              {/* Header */}
              <div className={styles.roomHeader}>
                <div>
                  <span className={styles.roomCode}>{r.room_code}</span>
                  <span className={styles.roomWardBadge}>{r.ward ?? 'No ward'}</span>
                </div>
                <span className={`${styles.camPill} ${r.camera_src ? styles.camOnline : styles.camOffline}`}>
                  {r.camera_src ? '● Live' : '○ Offline'}
                </span>
              </div>

              {/* Meta rows */}
              <div className={styles.roomMetaRow}>
                <span className={styles.metaLabel}>📷 Camera</span>
                <span className={styles.metaVal}>{r.camera_src ?? <em>Not configured</em>}</span>
              </div>
              <div className={styles.roomMetaRow}>
                <span className={styles.metaLabel}>👤 Caregiver</span>
                <span className={`${styles.metaVal} ${cg ? styles.cgAssigned : styles.cgUnassigned}`}>
                  {cg ? cg.display_name : 'Unassigned'}
                </span>
              </div>
              {cg && (
                <div className={styles.cgSubWard}>{cg.ward ?? ''}</div>
              )}
              <div className={styles.roomMetaRow}>
                <span className={styles.metaLabel}>🗺 Zone config</span>
                <span className={styles.metaVal}>{r.zone_config ? '✓ Configured' : 'None'}</span>
              </div>

              {/* Assign caregiver */}
              <div className={styles.assignRow}>
                <select
                  className={styles.assignSelect}
                  value={pending[r.room_code] ?? r.caregiver_id ?? ''}
                  onChange={e => setPending(p => ({ ...p, [r.room_code]: e.target.value }))}
                  disabled={assigning[r.room_code]}
                >
                  <option value="" disabled>
                    {caregivers.length === 0 ? 'No caregivers registered yet' : '— Select caregiver —'}
                  </option>
                  {caregivers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}{c.ward ? ` · ${c.ward}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  className={`${styles.saveBtn} ${saved[r.room_code] ? styles.saveBtnSaved : ''}`}
                  onClick={() => handleSave(r.room_code)}
                  disabled={!hasPending || assigning[r.room_code]}
                >
                  {assigning[r.room_code] ? '…' : saved[r.room_code] ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── PANEL: Patient Detail ─────────────────────────────────────────────────────
function PatientDetailPanel({ patient, rooms, alerts, onBack }: {
  patient: Patient; rooms: Room[]; alerts: Alert[]; onBack: () => void
}) {
  const [tab, setTab] = useState<'live'|'history'|'replay'|'analytics'>('live')
  const room = rooms.find(r => r.room_code === patient.room_id)
  const patAlerts = alerts.filter(a => String(a.patient_id) === String(patient.id)).slice(0, 30)
  const latest = patAlerts[0]

  // WebSocket for live data
  const [frame, setFrame] = useState<LiveFrame | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  useEffect(() => {
    if (!room?.room_code || !room.camera_src) return
    const ws = new WebSocket(`ws://localhost:8000/ws/live/${room.room_code}`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as any
        if (data.type === 'skeleton') {
          setFrame(f => f ? { ...f, skeleton: data.skeleton } : { skeleton: data.skeleton, risk_score: 0, risk_level: 'NORMAL', posture: '', zone: '', confidence: 0, key_factors: [] } as LiveFrame)
        } else {
          setFrame(data as LiveFrame)
        }
      } catch { /* */ }
    }
    return () => { ws.close() }
  }, [room?.room_code, room?.camera_src])

  const riskColor = (lvl?: string) =>
    lvl === 'HIGH' ? '#ef4444' : lvl === 'MODERATE' ? '#f59e0b' : '#22c55e'

  // Risk trend for sparkline (last 20 alerts)
  const riskPts = [...patAlerts].reverse().slice(0, 20).map(a => a.risk_score)
  const maxPt = Math.max(...riskPts, 1)

  return (
    <div>
      {/* Header */}
      <div className={styles.detailHeader}>
        <button className={styles.replayBackBtn} onClick={onBack}>←</button>
        <div className={styles.detailTitle}>Patient / Bed Details — {patient.patient_code}</div>
        <div style={{display:'flex',gap:6,marginLeft:'auto'}}>
          <button className={styles.detailNoteBtn}>Notes</button>
          {latest && !latest.acknowledged && (
            <button className={styles.detailAlertBtn}>🔔 Alert</button>
          )}
        </div>
      </div>

      {/* Top info row */}
      <div className={styles.detailInfoRow}>
        {/* Patient card */}
        <div className={styles.detailPatCard}>
          <div className={styles.detailAvatar}>
            <svg viewBox="0 0 40 40" width="40" height="40">
              <circle cx="20" cy="14" r="7" fill="#475569"/>
              <path d="M6 36 Q6 26 20 26 Q34 26 34 36" fill="#475569"/>
            </svg>
          </div>
          <div className={styles.detailPatInfo}>
            {[
              ['Patient ID', patient.patient_code],
              ['Room',       room ? `Room ${room.room_code.replace('ROOM_','')} — Bed 1` : 'Unassigned'],
              ['Gender',     patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender === 'Other' ? 'Other' : 'Not recorded'],
            ].map(([k,v]) => (
              <div key={k} className={styles.detailKv}>
                <span className={styles.detailKvKey}>{k}</span>
                <span className={styles.detailKvVal}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status card */}
        <div className={styles.detailStatusCard}>
          <div className={styles.detailStatusLabel}>Current Status</div>
          <div className={styles.detailStatusBadge} style={{
            background: latest?.risk_level === 'HIGH' ? 'rgba(239,68,68,0.15)' : latest?.risk_level === 'MODERATE' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
            color: riskColor(latest?.risk_level),
            borderColor: riskColor(latest?.risk_level),
          }}>
            {latest?.risk_level === 'HIGH' ? 'High Risk' : latest?.risk_level === 'MODERATE' ? 'Moderate Risk' : latest ? 'Normal' : 'No data'}
          </div>
          <div className={styles.detailScoreRow}>
            <div>
              <div style={{fontSize:11,color:'#94a3b8',marginBottom:2}}>Risk Score</div>
              <div style={{fontSize:28,fontWeight:900,color:riskColor(latest?.risk_level)}}>
                {latest ? `${Math.round(latest.risk_score * 100)}/100` : '—'}
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:'#94a3b8',marginBottom:2}}>Posture</div>
              <div style={{fontSize:15,fontWeight:700,color:'#e2e8f0'}}>{latest?.posture ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className={styles.detailTabs}>
        {(['live','history','replay','analytics'] as const).map(t => (
          <button key={t}
            className={`${styles.detailTabBtn} ${tab === t ? styles.detailTabActive : ''}`}
            onClick={() => setTab(t)}>
            {t === 'live' ? 'Live View' : t === 'history' ? 'History' : t === 'replay' ? '▶ Replay' : 'Analytics'}
          </button>
        ))}
      </div>

      {/* Live View tab */}
      {tab === 'live' && (
        <div className={styles.detailLiveCols}>
          {/* Live Skeleton */}
          <div className={styles.detailLiveCard}>
            <div className={styles.detailLiveTitle}>Live Skeleton</div>
            <div className={styles.detailSkeletonBox} style={{padding:0,overflow:'hidden',minHeight:160}}>
              {frame
                ? <SkeletonCanvas frame={frame} />
                : <SkeletonSVG riskLevel={(latest?.risk_level ?? 'NORMAL') as 'HIGH'|'MODERATE'|'NORMAL'} />
              }
            </div>
            <div className={styles.detailLiveFps}>
              ● LIVE · {frame ? '25 FPS' : room?.camera_src ? 'Connecting…' : 'No camera configured'}
            </div>
          </div>

          {/* Key Risk Factors */}
          <div className={styles.detailLiveCard}>
            <div className={styles.detailLiveTitle}>Why This Was Flagged</div>
            {(frame?.key_factors ?? latest?.key_factors ?? []).length > 0 ? (
              <div style={{marginTop:8}}>
                {(frame?.key_factors ?? latest?.key_factors ?? []).map((f, i) => (
                  <div key={i} className={styles.detailKfRow}>
                    <span className={styles.detailKfName}>{f}</span>
                    <span className={styles.detailKfZ} style={{
                      color: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#94a3b8'
                    }}>{i === 0 ? 'Main factor' : 'Contributing'}</span>
                  </div>
                ))}
                {/* Zone */}
                {frame?.zone && (
                  <div className={styles.detailKfRow}>
                    <span className={styles.detailKfName}>Location</span>
                    <span style={{fontSize:11,color:'#3b82f6'}}>{frame.zone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.empty} style={{marginTop:20}}>
                {room?.camera_src ? 'Waiting for live data…' : 'No camera configured for this room'}
              </div>
            )}
          </div>

          {/* Risk Trend */}
          <div className={styles.detailLiveCard}>
            <div className={styles.detailLiveTitle}>Risk Trend (1hr)</div>
            <div className={styles.historyTrendBox} style={{marginTop:8}}>
              <svg viewBox="0 0 200 60" width="100%" height="60" preserveAspectRatio="none">
                <line x1="0" y1="40" x2="200" y2="40" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4"/>
                <line x1="0" y1="20" x2="200" y2="20" stroke="#ef4444" strokeWidth="1" strokeDasharray="2"/>
                {riskPts.length > 1 && (
                  <polyline
                    points={riskPts.map((v,i) => `${(i/(riskPts.length-1))*198+1},${60-(v/maxPt)*56}`).join(' ')}
                    fill="none" stroke={riskColor(latest?.risk_level)} strokeWidth="2"/>
                )}
              </svg>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>— Moderate threshold</div>
            </div>
            {patAlerts.length === 0 && (
              <div className={styles.empty} style={{marginTop:12,fontSize:11}}>No alert history for this patient</div>
            )}
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className={styles.tableWrap} style={{marginTop:12}}>
          {patAlerts.length === 0
            ? <div className={styles.empty}>No alert history for {patient.patient_code}</div>
            : <table className={styles.table}>
                <thead><tr><th>Time</th><th>Risk</th><th>Score</th><th>Posture</th><th>Key Factors</th><th>Status</th></tr></thead>
                <tbody>
                  {patAlerts.map(a => (
                    <tr key={a.id} className={a.risk_level === 'HIGH' ? styles.rowHigh : a.risk_level === 'MODERATE' ? styles.rowMod : ''}>
                      <td className={styles.tdTime}>{fmtTime(a.timestamp)}</td>
                      <td><RiskBadge level={a.risk_level} /></td>
                      <td style={{fontWeight:700,color:riskColor(a.risk_level)}}>{Math.round(a.risk_score * 100)}</td>
                      <td>{a.posture ?? '—'}</td>
                      <td className={styles.tdFactors}>{(a.key_factors ?? []).slice(0,2).join(', ')||'—'}</td>
                      <td>{a.acknowledged ? <span className={styles.ackedPill}>Acked</span> : <span className={styles.unackedPill}>New</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}

      {/* Replay / Analytics tabs */}
      {(tab === 'replay' || tab === 'analytics') && (
        <div className={styles.empty} style={{marginTop:40,fontSize:13}}>
          {tab === 'replay' ? 'Select an alert in the Event Replay tab to view skeleton replay.' : 'See Analytics tab for system-wide charts.'}
        </div>
      )}
    </div>
  )
}

// ── PANEL: Patients & Beds ────────────────────────────────────────────────────
function PatientsPanel({ patients, rooms, alerts, loading, onSelectPatient }: {
  patients: Patient[]; rooms: Room[]; alerts: Alert[]; loading: boolean
  onSelectPatient: (p: Patient) => void
}) {
  const [search,        setSearch]        = useState('')
  const [genderFilter,  setGenderFilter]  = useState('All')
  const [roomFilter,    setRoomFilter]    = useState('All')

  if (loading && !patients.length) return <div className={styles.empty}>Loading patients…</div>
  if (!loading && !patients.length) return <div className={styles.empty}>No patients registered yet.</div>

  const roomCodes = ['All', ...Array.from(new Set(patients.map(p => p.room_id ?? 'Unassigned')))]
  const filtered = patients.filter(p => {
    const matchSearch = p.patient_code.toLowerCase().includes(search.toLowerCase())
    const matchGender = genderFilter === 'All' || p.gender === genderFilter
    const matchRoom   = roomFilter === 'All' || (p.room_id ?? 'Unassigned') === roomFilter
    return matchSearch && matchGender && matchRoom
  })

  return (
    <div>
      <div className={styles.panelToolbar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            placeholder="Search patient code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filterChips}>
          {(['All', 'F', 'M'] as const).map(g => (
            <button
              key={g}
              className={`${styles.chip} ${genderFilter === g ? styles.chipActive : ''}`}
              onClick={() => setGenderFilter(g)}
            >{g === 'F' ? 'Female' : g === 'M' ? 'Male' : 'All'}</button>
          ))}
        </div>
        <select
          className={styles.roomFilterSelect}
          value={roomFilter}
          onChange={e => setRoomFilter(e.target.value)}
        >
          {roomCodes.map(rc => <option key={rc} value={rc}>{rc === 'All' ? 'All Rooms' : rc}</option>)}
        </select>
        <span className={styles.countLabel}>{filtered.length} of {patients.length} patients</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Patient Code</th>
              <th>Gender</th>
              <th>Ward</th>
              <th>Assigned Room</th>
              <th>Registered</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const room = rooms.find(r => r.room_code === p.room_id)
              return (
                <tr key={p.id} style={{cursor:'pointer'}} onClick={() => onSelectPatient(p)}
                  title="Click to view patient details">
                  <td className={styles.tdIdx}>{i + 1}</td>
                  <td><span className={styles.tdCode}>{p.patient_code}</span></td>
                  <td>
                    <span className={`${styles.genderPill} ${p.gender === 'M' ? styles.genderM : styles.genderF}`}>
                      {genderLabel(p.gender)}
                    </span>
                  </td>
                  <td className={styles.tdWard}>{room?.ward ?? '—'}</td>
                  <td>{p.room_id ?? <span className={styles.tdMuted}>Unassigned</span>}</td>
                  <td className={styles.tdTime}>{fmtTime(p.created_at)}</td>
                  <td><span style={{fontSize:11,color:'#3b82f6'}}>→ Details</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── PANEL: Live Monitoring ────────────────────────────────────────────────────
// ── Skeleton Canvas renderer ──────────────────────────────────────────────────
interface LiveFrame {
  skeleton:    number[][]
  risk_score:  number
  risk_level:  'NORMAL' | 'MODERATE' | 'HIGH'  // raw instantaneous — for display (matches MJPEG)
  alert_level: 'NORMAL' | 'MODERATE' | 'HIGH'  // EMA-smoothed — for beep/alert decisions
  posture:     string
  zone:        string
  confidence:  number
  key_factors: string[]
  alert:      boolean
}

function SkeletonCanvas({ frame }: { frame: LiveFrame | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Resize canvas to match its CSS display size so it fills the container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth  || 420
      canvas.height = canvas.offsetHeight || 340
    })
    observer.observe(canvas)
    canvas.width  = canvas.offsetWidth  || 420
    canvas.height = canvas.offsetHeight || 340
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width  || 420
    const H = canvas.height || 340

    // Background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }

    if (!frame || !frame.skeleton?.length) {
      ctx.fillStyle = 'rgba(148,163,184,0.5)'
      ctx.font = '14px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for skeleton data…', W/2, H/2)
      return
    }

    const level = frame.risk_level ?? 'NORMAL'
    const colors = JOINT_COLORS[level] ?? JOINT_COLORS.NORMAL
    const joints = frame.skeleton  // [[x,y,z,v], ...]

    // Map normalized coords to canvas — MediaPipe x=right, y=down
    const px = (j: number) => joints[j]?.[0] * W ?? 0
    const py = (j: number) => joints[j]?.[1] * H ?? 0
    const vis = (j: number) => (joints[j]?.[3] ?? 0) > 0.3

    // Draw bones
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    BONES.forEach(([a, b]) => {
      if (!vis(a) || !vis(b)) return
      ctx.strokeStyle = colors.bone
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.moveTo(px(a), py(a))
      ctx.lineTo(px(b), py(b))
      ctx.stroke()
    })
    ctx.globalAlpha = 1

    // Draw joints
    joints.forEach((j, idx) => {
      if (!vis(idx)) return
      const x = j[0] * W, y = j[1] * H
      const r = idx === 0 ? 8 : 5   // head is bigger
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = idx === 0 ? colors.head : colors.joint
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })

    // Risk score bar (bottom)
    const score = Math.min(Math.max(frame.risk_score, 0), 100)
    const barY = H - 20, barH = 8, barW = W - 40
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.beginPath(); ctx.roundRect(20, barY, barW, barH, 4); ctx.fill()
    const grad = ctx.createLinearGradient(20, 0, 20 + barW, 0)
    grad.addColorStop(0, '#22c55e'); grad.addColorStop(0.5, '#f59e0b'); grad.addColorStop(1, '#ef4444')
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.roundRect(20, barY, barW * (score/100), barH, 4); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'
    ctx.fillText(`Risk: ${score}`, 20, barY - 4)
    ctx.textAlign = 'right'
    ctx.fillText(level, W - 20, barY - 4)

  }, [frame])

  return (
    <canvas
      ref={canvasRef}
      className={styles.skeletonCanvas}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

// ── PANEL: Live Monitoring ────────────────────────────────────────────────────
function LivePanel({ rooms, patients, alerts, onBeep, onReplay, onViewPatient }: {
  rooms: Room[]; patients: Patient[]; alerts: Alert[]; onBeep: (freq: number, ms?: number) => void
  onReplay: (alert: Alert) => void; onViewPatient: (patient: Patient) => void
}) {
  const activeRooms = rooms.filter(r => r.camera_src)
  const [selected,   setSelected]   = useState<Room | null>(() => activeRooms[0] ?? null)
  const [collapsed,  setCollapsed]  = useState(false)
  const [highOnly,   setHighOnly]   = useState(false)
  const [frame,      setFrame]      = useState<LiveFrame | null>(null)
  const [wsStatus,   setWsStatus]   = useState<'disconnected'|'connecting'|'connected'|'error'>('disconnected')
  const wsRef          = useRef<WebSocket | null>(null)
  const prevLevelRef   = useRef<string>('NORMAL')
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start continuous HIGH alarm (beeps every 3s while level stays HIGH)
  const startHighAlarm = () => {
    if (alarmIntervalRef.current) return   // already running
    onBeep(880, 300)                       // immediate first beep
    setTimeout(() => onBeep(880, 300), 400)
    setTimeout(() => onBeep(880, 300), 800)
    alarmIntervalRef.current = setInterval(() => {
      try { onBeep(880, 300); setTimeout(() => onBeep(880, 300), 400); setTimeout(() => onBeep(880, 300), 800) }
      catch { /* audio blocked */ }
    }, 3000)
  }
  const stopHighAlarm = () => {
    if (alarmIntervalRef.current) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null }
  }
  const unackedHigh = alerts.filter(a => !a.acknowledged && a.risk_level === 'HIGH')
  const highRoomIds = new Set(unackedHigh.map(a => String(a.room_id)))
  const visibleRooms = highOnly ? activeRooms.filter(r => highRoomIds.has(String(r.id))) : activeRooms

  // Auto-select first active room when rooms load (e.g. after camera is started)
  useEffect(() => {
    if (!selected && activeRooms.length > 0) {
      setSelected(activeRooms[0])
    }
  }, [activeRooms.length])

  useEffect(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    setFrame(null)
    if (!selected) { setWsStatus('disconnected'); return }
    setWsStatus('connecting')
    const ws = new WebSocket(`ws://localhost:8000/ws/live/${selected.room_code}`)
    wsRef.current = ws
    ws.onopen  = () => setWsStatus('connected')
    ws.onclose = () => setWsStatus('disconnected')
    ws.onerror = () => setWsStatus('error')
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as any
        if (data.type === 'skeleton') {
          // Lightweight per-frame skeleton update — preserve existing risk data
          setFrame(f => f ? { ...f, skeleton: data.skeleton } : { skeleton: data.skeleton, risk_score: 0, risk_level: 'NORMAL', posture: '', zone: '', confidence: 0, key_factors: [] } as LiveFrame)
        } else {
          // Set frame FIRST — skeleton must update even if beep throws
          setFrame(data as LiveFrame)
          const alertLevel = (data.alert_level ?? data.risk_level) as string
          const prev = prevLevelRef.current
          prevLevelRef.current = alertLevel
          try {
            if (alertLevel === 'HIGH') {
              // Continuous alarm while HIGH — start interval on entry, keep running
              startHighAlarm()
            } else {
              // Level dropped below HIGH — stop the continuous alarm
              stopHighAlarm()
              if (alertLevel === 'MODERATE' && prev !== 'MODERATE' && data.moderate_alert) {
                // Single beep on new MODERATE episode (backend gates via 120s cooldown)
                onBeep(660, 300)
              }
            }
          } catch { /* audio not available */ }
        }
      } catch { /* */ }
    }
    return () => { ws.close(); stopHighAlarm() }
  }, [selected])

  const riskColor = (lvl?: string) => lvl==='HIGH'?'#ef4444':lvl==='MODERATE'?'#f59e0b':'#22c55e'
  const riskBorder = (lvl?: string) => `2px solid ${riskColor(lvl)}`

  return (
    <div>
      {/* Header */}
      <div className={styles.liveTopbar}>
        <div className={styles.livePageTitle}>
          Live Monitoring <span style={{fontSize:11,fontWeight:400,color:'#22c55e'}}>● {activeRooms.length} cameras live · 25 FPS</span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <select
            className={styles.historySelect}
            value={selected?.id ?? ''}
            onChange={e => {
              const r = activeRooms.find(rm => String(rm.id) === e.target.value)
              if (r) { setSelected(r); setCollapsed(false) }
            }}
          >
            <option value="">All Rooms</option>
            {activeRooms.map(r => <option key={r.id} value={r.id}>{r.room_code}</option>)}
          </select>
          <button
            className={styles.ackBtn}
            onClick={() => setHighOnly(h => !h)}
            style={highOnly
              ? {background:'#ef4444',color:'#fff',border:'1px solid #ef4444'}
              : {background:'rgba(239,68,68,.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,.3)'}}
          >🔴 High Only</button>
        </div>
      </div>

      {/* Alert bar */}
      {unackedHigh.length > 0 && (
        <div className={styles.alertBannerHigh} style={{marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>🚨 HIGH RISK: {unackedHigh.length} unacknowledged HIGH alert{unackedHigh.length>1?'s':''} — Immediate attention needed</span>
          <button className={styles.ackBtn}>Acknowledge All</button>
        </div>
      )}

      {activeRooms.length === 0 ? (
        <div className={styles.livePrompt}>
          <Icon name="eye" size={40} color="#94a3b8" />
          <p>No cameras configured. Go to <strong>Camera Config</strong> tab to start one.</p>
        </div>
      ) : visibleRooms.length === 0 ? (
        <div className={styles.livePrompt}>
          <Icon name="eye" size={40} color="#94a3b8" />
          <p>No rooms currently at HIGH risk.</p>
        </div>
      ) : collapsed ? (
        <div className={styles.livePrompt} onClick={() => setCollapsed(false)} style={{cursor:'pointer'}}>
          <Icon name="eye" size={40} color="#94a3b8" />
          <p>Main view collapsed — click here, or pick a room below, to expand it again.</p>
        </div>
      ) : (
        <div style={{display:'flex',gap:10,marginBottom:10}}>
          {/* Zoomed main feed — selected room or first room */}
          {(() => {
            const main = selected ?? visibleRooms[0]!
            const mainAlerts = alerts.filter(a => !a.acknowledged && a.risk_level === 'HIGH' && String(a.room_id) === String(main.id)).slice(0,1)[0]
            const patientHere = patients.find(p => p.room_id === main.room_code)
            const lvl = frame?.risk_level ?? mainAlerts?.risk_level ?? 'NORMAL'
            return (
              <div style={{flex:2,background:'#334155',border:riskBorder(lvl),borderRadius:8,padding:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div>
                    <span style={{fontSize:12,fontWeight:800,color:'#f1f5f9'}}>{main.room_code} – Bed 1</span>
                    <span style={{fontSize:9,color:'#94a3b8',marginLeft:6}}>· {patients.find(p=>p.room_id===main.room_code)?.patient_code ?? 'No patient'}</span>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span className={styles.ackedPill} style={{
                      background: lvl==='HIGH'?'rgba(239,68,68,.2)':lvl==='MODERATE'?'rgba(245,158,11,.2)':'rgba(34,197,94,.2)',
                      color: riskColor(lvl), fontWeight:700, fontSize:9, padding:'3px 10px',
                    }}>{lvl} · {frame ? Math.round(frame.risk_score) : '—'}</span>
                    <button className={styles.ackBtn} onClick={()=>setCollapsed(true)}>⤡ Collapse</button>
                  </div>
                </div>
                {/* Skeleton screen — uses SkeletonCanvas for real joint positions */}
                <div style={{background:'#060d1a',borderRadius:6,height:280,position:'relative',marginBottom:8,overflow:'hidden'}}>
                  {frame
                    ? <SkeletonCanvas frame={frame} />
                    : <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}>
                        <SkeletonSVG riskLevel={lvl as 'HIGH'|'MODERATE'|'NORMAL'} />
                      </div>
                  }
                  <div style={{position:'absolute',top:6,left:6,fontSize:9,fontWeight:700,color:'#22c55e'}}>● LIVE</div>
                  <div style={{position:'absolute',bottom:6,right:8,fontSize:16,fontWeight:900,color:riskColor(lvl)}}>
                    {frame ? Math.round(frame.risk_score) : '—'}
                  </div>
                  <div style={{position:'absolute',top:6,right:8,fontSize:9,fontWeight:600,
                    color: wsStatus==='connected'?'#22c55e':wsStatus==='connecting'?'#f59e0b':'#94a3b8'}}>
                    ● {wsStatus.toUpperCase()}
                  </div>
                </div>
                {/* 4-col stats */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:8}}>
                  {[
                    {k:'Posture', v: frame?.posture ?? '—'},
                    {k:'Movement', v: frame?.risk_level==='HIGH'?'Unsteady':'Steady', c: frame?.risk_level==='HIGH'?'#ef4444':undefined},
                    {k:'Location', v: frame?.zone ?? '—', c:'#3b82f6'},
                    {k:'Certainty', v: frame ? `${(frame.confidence*100).toFixed(0)}%` : '—', c:'#22c55e'},
                  ].map(s => (
                    <div key={s.k} style={{textAlign:'center'}}>
                      <div style={{fontSize:9,color:'#94a3b8'}}>{s.k}</div>
                      <div style={{fontSize:10,fontWeight:700,color:s.c??'#f1f5f9'}}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {/* Actions */}
                <div style={{display:'flex',gap:6}}>
                  <button
                    className={styles.ackBtn} style={{flex:1}}
                    disabled={!mainAlerts?.r2_replay_key}
                    title={mainAlerts?.r2_replay_key ? 'View the recorded skeleton replay for this alert' : 'No replay recorded for this room yet'}
                    onClick={() => mainAlerts?.r2_replay_key && onReplay(mainAlerts)}
                  >▶ View Replay</button>
                  <button
                    className={styles.ackBtn} style={{flex:1}}
                    disabled={!patientHere}
                    title={patientHere ? 'Open this patient\'s full record' : 'No patient assigned to this room'}
                    onClick={() => patientHere && onViewPatient(patientHere)}
                  >📋 Patient Detail</button>
                </div>
              </div>
            )
          })()}

          {/* Thumbnail strip */}
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',marginBottom:2}}>Other Beds — click to expand</div>
            {visibleRooms.filter(r => r.id !== (selected ?? visibleRooms[0])?.id).slice(0,4).map(r => {
              const rAlert = alerts.filter(a => !a.acknowledged).find(a => String(a.room_id)===String(r.id))
              const lvl = rAlert?.risk_level ?? 'NORMAL'
              const borderColor = lvl==='HIGH'?'#ef4444':lvl==='MODERATE'?'#f59e0b':'#475569'
              return (
                <div key={r.id} onClick={() => { setSelected(r); setCollapsed(false) }}
                  style={{background:'#334155',border:`1px solid ${borderColor}`,borderRadius:6,padding:8,display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                  <div style={{background:'#060d1a',borderRadius:4,width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <SkeletonSVG riskLevel={lvl as 'HIGH'|'MODERATE'|'NORMAL'} />
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#f1f5f9'}}>{r.room_code}–Bed 1</div>
                    <div style={{fontSize:9,color:'#94a3b8'}}>{rAlert?.posture ?? 'Monitoring…'} · {r.ward ?? ''}</div>
                  </div>
                  <span style={{fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:10,
                    background: lvl==='HIGH'?'rgba(239,68,68,.2)':lvl==='MODERATE'?'rgba(245,158,11,.2)':'rgba(34,197,94,.2)',
                    color: riskColor(lvl)}}>
                    {lvl} {rAlert ? Math.round(rAlert.risk_score * 100) : ''}
                  </span>
                </div>
              )
            })}
            {rooms.filter(r => !r.camera_src).slice(0,2).map(r => (
              <div key={r.id} style={{background:'#334155',border:'1px solid #475569',borderRadius:6,padding:8,display:'flex',alignItems:'center',gap:8,opacity:.5}}>
                <div style={{background:'#060d1a',borderRadius:4,width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#64748b'}}>···</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#94a3b8'}}>{r.room_code}</div>
                  <div style={{fontSize:9,color:'#64748b'}}>No camera configured</div>
                </div>
              </div>
            ))}
            <div style={{fontSize:9,color:'#64748b',background:'#1e293b',borderRadius:6,padding:'5px 8px',border:'1px solid #334155'}}>
              💡 Click any thumbnail → expands to main view
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PANEL: Alerts ─────────────────────────────────────────────────────────────
function AlertsPanel({ alerts, loading, onAcknowledge, onReplay, rooms, caregivers }: {
  alerts: Alert[]; loading: boolean; onAcknowledge: (id: number) => void; onReplay: (alert: Alert) => void
  rooms: Room[]; caregivers: Caregiver[]
}) {
  const cgMap = Object.fromEntries(caregivers.map(c => [c.id, c.display_name]))
  const roomCgMap = Object.fromEntries(rooms.map(r => [String(r.id), r.caregiver_id ? (cgMap[r.caregiver_id] ?? '—') : '—']))

  const [filter, setFilter] = useState<'all'|'unacked'|'high'|'moderate'>('all')
  const [roomFilter, setRoomFilter] = useState<string>('active')  // 'active' = camera rooms only, 'all' = everything
  const activeRoomIds = new Set(rooms.filter(r => r.camera_src).map(r => String(r.id)))
  const roomFiltered = roomFilter === 'active' && activeRoomIds.size > 0
    ? alerts.filter(a => a.room_id == null || activeRoomIds.has(String(a.room_id)))
    : alerts
  const shown = filter === 'unacked'  ? roomFiltered.filter(a => !a.acknowledged)
    : filter === 'high'     ? roomFiltered.filter(a => a.risk_level === 'HIGH')
    : filter === 'moderate' ? roomFiltered.filter(a => a.risk_level === 'MODERATE')
    : roomFiltered

  const highCount = roomFiltered.filter(a => a.risk_level === 'HIGH').length
  const modCount  = roomFiltered.filter(a => a.risk_level === 'MODERATE').length
  const unackCount = roomFiltered.filter(a => !a.acknowledged).length

  if (loading && !alerts.length) return <div className={styles.empty}>Loading alerts…</div>
  return (
    <div>
      {/* Toolbar — matches wireframe */}
      <div className={styles.alertsToolbar}>
        <div className={styles.alertsFilterGroup}>
          {([
            { key:'all',      label:`All (${roomFiltered.length})` },
            { key:'high',     label:`High (${highCount})`,     color:'#ef4444' },
            { key:'moderate', label:`Moderate (${modCount})`,  color:'#f59e0b' },
            { key:'unacked',  label:'Unacked only' },
          ] as {key:string;label:string;color?:string}[]).map(f => (
            <button key={f.key}
              className={`${styles.alertFilterBtn} ${filter === f.key ? styles.alertFilterActive : ''}`}
              style={filter !== f.key && f.color ? {color:f.color} : undefined}
              onClick={() => setFilter(f.key as typeof filter)}>
              {f.label}
            </button>
          ))}
        </div>
        <button
          className={styles.ackBtn}
          style={roomFilter === 'active'
            ? {background:'rgba(59,130,246,.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,.3)'}
            : {color:'#94a3b8'}}
          onClick={() => setRoomFilter(f => f === 'active' ? 'all' : 'active')}
          title="Toggle between active camera rooms only vs all rooms"
        >
          {roomFilter === 'active' ? '📷 Active rooms only' : '🌐 All rooms'}
        </button>
        <button className={styles.exportBtn2} onClick={() => {
          const csv = 'id,time,risk,score,posture,key_factors,status\n' +
            alerts.map(a => `${a.id},"${fmtTime(a.timestamp)}",${a.risk_level},${Math.round(a.risk_score)},"${a.posture??''}","${(a.key_factors??[]).join('; ')}",${a.acknowledged?'Acked':'Pending'}`).join('\n')
          const url = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
          const el = document.createElement('a'); el.href=url; el.download='alerts.csv'; el.click()
        }}>⬇ Export</button>
      </div>

      {unackCount > 0 && (
        <div className={styles.alertBannerHigh}>
          🚨 {unackCount} unacknowledged alert{unackCount > 1 ? 's' : ''} — requires attention
        </div>
      )}

      {shown.length === 0
        ? <div className={styles.empty}>{filter === 'unacked' ? '✓ All alerts acknowledged' : 'No alerts'}</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Risk</th>
                  <th>Score</th>
                  <th>Posture</th>
                  <th>Key Factors</th>
                  <th>Status</th>
                  <th>Caregiver</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(a => (
                  <tr key={a.id} className={a.risk_level === 'HIGH' ? styles.rowHigh : a.risk_level === 'MODERATE' ? styles.rowMod : ''}>
                    <td className={styles.tdTime}>{fmtTime(a.timestamp)}</td>
                    <td><RiskBadge level={a.risk_level} /></td>
                    <td className={styles.tdScore} style={{color: a.risk_level==='HIGH'?'#ef4444':a.risk_level==='MODERATE'?'#f59e0b':'#22c55e', fontWeight:700}}>
                      {Math.round(a.risk_score * 100)}
                    </td>
                    <td>{a.posture ?? '—'}</td>
                    <td className={styles.tdFactors}>{(a.key_factors ?? []).slice(0, 2).join(', ') || '—'}</td>
                    <td>
                      {a.acknowledged
                        ? <span className={styles.ackedPill}>Acked</span>
                        : <span className={styles.unackedPill}>New</span>}
                    </td>
                    <td className={styles.tdTime}>{a.ack_by ? a.ack_by : (roomCgMap[String(a.room_id)] ?? '—')}</td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        {!a.acknowledged && (
                          <button className={styles.ackBtn} onClick={() => onAcknowledge(a.id)}>
                            ✓ Ack
                          </button>
                        )}
                        {(a.risk_level === 'HIGH' || a.risk_level === 'MODERATE')
                          ? <button className={styles.replayLink} onClick={() => onReplay(a)}>▶ Replay</button>
                          : <span style={{fontSize:11,color:'#94a3b8'}}>—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.tablePager}>
              Showing {shown.length} of {alerts.length} alerts
            </div>
          </div>
        )}
    </div>
  )
}

// ── Replay Player component ────────────────────────────────────────────────────
function ReplayPlayer({ alertId, riskLevel, riskScore }: {
  alertId: number; riskLevel: 'HIGH'|'MODERATE'|'NORMAL'; riskScore: number
}) {
  const [frames, setFrames] = useState<any[]>([])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setLoading(true); setFrames([]); setIdx(0); setPlaying(false)
    fetch(`http://localhost:8000/api/events/${alertId}/replay`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.frames) { setFrames(d.frames); setPlaying(true) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [alertId])

  useEffect(() => {
    if (!playing || frames.length === 0) { if (intervalRef.current) clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => {
      setIdx(i => { const n = i + 1; if (n >= frames.length) { setPlaying(false); return 0 } return n })
    }, 100)   // ~10fps replay
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, frames.length])

  const currentFrame = frames[idx]
  const liveFrame = currentFrame ? {
    skeleton: currentFrame.skeleton, risk_score: riskScore, risk_level: riskLevel,
    posture: '', zone: '', confidence: 0, key_factors: []
  } as any : null

  const colorOf = (l: string) => l === 'HIGH' ? '#ef4444' : l === 'MODERATE' ? '#f59e0b' : '#22c55e'

  return (
    <div>
      <div style={{background:'#060d1a',borderRadius:6,height:200,position:'relative',overflow:'hidden',marginBottom:8}}>
        {loading ? <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#64748b',fontSize:12}}>Loading replay…</div>
         : frames.length === 0 ? <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#64748b',fontSize:12}}>No replay saved — skeleton replay is captured only while the backend is running live</div>
         : <SkeletonCanvas frame={liveFrame} />}
        <div style={{position:'absolute',top:6,left:8,fontSize:9,fontWeight:700,color: playing?'#22c55e':'#94a3b8'}}>
          {playing ? '● PLAYING' : '● PAUSED'}
        </div>
        <div style={{position:'absolute',bottom:6,right:10,fontSize:16,fontWeight:900,color:colorOf(riskLevel)}}>
          {Math.round(riskScore)}
        </div>
      </div>
      {/* Controls */}
      <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
        <button className={styles.ackBtn} onClick={() => { setIdx(0); setPlaying(true) }}>⏮</button>
        <button className={styles.ackBtn} onClick={() => setPlaying(p => !p)}>{playing ? '⏸' : '▶'}</button>
        <button className={styles.ackBtn} onClick={() => { setIdx(frames.length - 1); setPlaying(false) }}>⏭</button>
        <div style={{flex:1,height:4,background:'#1e293b',borderRadius:2,cursor:'pointer'}} onClick={(e) => {
          const rect = (e.target as HTMLElement).getBoundingClientRect()
          const pct = (e.clientX - rect.left) / rect.width
          setIdx(Math.floor(pct * frames.length))
        }}>
          <div style={{height:'100%',background:colorOf(riskLevel),borderRadius:2,width:`${frames.length ? (idx/frames.length)*100 : 0}%`}} />
        </div>
        <span style={{fontSize:10,color:'#94a3b8',whiteSpace:'nowrap'}}>{idx+1}/{frames.length || '—'}</span>
      </div>
    </div>
  )
}

// ── PANEL: Event Replay ───────────────────────────────────────────────────────

// Skeleton SVG — 14-joint, colour by risk
function SkeletonSVG({ riskLevel }: { riskLevel: 'HIGH'|'MODERATE'|'NORMAL' }) {
  const c = riskLevel === 'HIGH' ? '#ef4444' : riskLevel === 'MODERATE' ? '#f59e0b' : '#22c55e'
  return (
    <svg viewBox="0 0 50 85" width="70" height="120">
      <circle cx="25" cy="8" r="5" fill="none" stroke="#facc15" strokeWidth="1.5"/>
      <line x1="25" y1="13" x2="28" y2="40" stroke="#60a5fa" strokeWidth="1.5"/>
      <line x1="25" y1="18" x2="8"  y2="30" stroke="#60a5fa" strokeWidth="1.5"/>
      <line x1="25" y1="18" x2="42" y2="28" stroke="#60a5fa" strokeWidth="1.5"/>
      <line x1="8"  y1="30" x2="5"  y2="44" stroke={c} strokeWidth="1.5"/>
      <line x1="42" y1="28" x2="45" y2="42" stroke={c} strokeWidth="1.5"/>
      <line x1="28" y1="40" x2="20" y2="62" stroke={c} strokeWidth="1.5"/>
      <line x1="28" y1="40" x2="34" y2="62" stroke={c} strokeWidth="1.5"/>
      <line x1="20" y1="62" x2="17" y2="80" stroke={c} strokeWidth="1.5"/>
      <line x1="34" y1="62" x2="36" y2="80" stroke={c} strokeWidth="1.5"/>
    </svg>
  )
}

function ReplayPanel({ alerts, initialAlert, onAcknowledge }: { alerts: Alert[]; initialAlert?: Alert | null; onAcknowledge: (id: number) => void }) {
  const [selected, setSelected]       = useState<Alert | null>(initialAlert ?? null)

  // Jump to the alert passed in from the Alerts tab's "Replay" action
  useEffect(() => {
    if (initialAlert) { setSelected(initialAlert) }
  }, [initialAlert])

  const replayAlerts = alerts.filter(a => a.risk_level === 'HIGH' || a.risk_level === 'MODERATE')

  return (
    <div>
      <div className={styles.replayWrap}>
          {/* Left — alert list */}
          <div className={styles.replayLeft}>
            <div className={styles.replaySection}>
              <div className={styles.replaySectionTitle}>Alert Replays</div>
              <p className={styles.replaySectionSub}>5-second skeleton-only clip saved per HIGH alert. Raw video never stored.</p>
            </div>
            {alerts.length === 0
              ? <div className={styles.empty}>No alerts recorded yet.</div>
              : alerts.slice(0, 30).map(a => (
                <button key={a.id}
                  className={`${styles.replayItem} ${selected?.id === a.id ? styles.replayItemActive : ''}`}
                  onClick={() => setSelected(a)}
                >
                  <RiskBadge level={a.risk_level} />
                  <div style={{flex:1,textAlign:'left'}}>
                    <div className={styles.replayTime}>{fmtTime(a.timestamp)}</div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>Score: {Math.round(a.risk_score * 100)} · {a.posture ?? '—'}</div>
                  </div>
                  {a.r2_replay_key && <span style={{fontSize:10,color:'#3b82f6'}}>▶</span>}
                </button>
              ))
            }
          </div>

          {/* Right — replay viewer, matches wireframe exactly */}
          <div className={styles.replayRight}>
            {!selected
              ? <div className={styles.livePrompt}>
                  <Icon name="heart-pulse" size={40} color="#94a3b8" />
                  <p>Select an alert from the list to view skeleton replay</p>
                </div>
              : (
                <div>
                  {/* Header */}
                  <div className={styles.replayDetailHeader}>
                    <button className={styles.replayBackBtn} onClick={() => setSelected(null)}>← Back</button>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700}}>Event Replay — Alert #{selected.id}</div>
                      <div style={{fontSize:11,color:'#64748b',display:'flex',gap:12,marginTop:2,flexWrap:'wrap'}}>
                        <span>📅 {fmtTime(selected.timestamp)}</span>
                        <span><RiskBadge level={selected.risk_level} /> Score {Math.round(selected.risk_score * 100)}</span>
                        {selected.posture && <span>🧍 {selected.posture}</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      {!selected.acknowledged && (
                        <button className={styles.ackBtn} onClick={() => {
                          onAcknowledge(selected.id)
                          setSelected(s => s ? { ...s, acknowledged: true } : s)
                        }}>✓ Acknowledge</button>
                      )}
                    </div>
                  </div>

                  {/* Two-column: skeleton player + metadata */}
                  <div className={styles.replayTwoCols}>
                    {/* Skeleton player card */}
                    <div className={styles.replayPlayerCard}>
                      <div className={styles.replayPlayerTitle}>
                        Skeleton Replay
                        <span className={styles.replayLiveDot}>● Privacy-preserving</span>
                      </div>
                      <ReplayPlayer alertId={selected.id} riskLevel={selected.risk_level as 'HIGH'|'MODERATE'|'NORMAL'} riskScore={selected.risk_score} />
                    </div>

                    {/* Right metadata column */}
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {/* Risk score */}
                      <div className={styles.replayMetaCard}>
                        <div className={styles.replayMetaTitle}>Risk Score at Alert</div>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
                          <div style={{flex:1,height:10,background:'#f1f5f9',borderRadius:5,overflow:'hidden'}}>
                            <div style={{
                              width:`${Math.round(selected.risk_score*100)}%`, height:'100%', borderRadius:5,
                              background: selected.risk_level==='HIGH' ? '#ef4444' : '#f59e0b',
                            }}/>
                          </div>
                          <span style={{fontWeight:800,fontSize:16,color:selected.risk_level==='HIGH'?'#ef4444':'#f59e0b'}}>
                            {Math.round(selected.risk_score*100)}
                          </span>
                        </div>
                      </div>

                      {/* Frame observations */}
                      <div className={styles.replayMetaCard}>
                        <div className={styles.replayMetaTitle}>Details</div>
                        {[
                          { key:'Posture',    val: selected.posture ?? '—',  high: false },
                          { key:'Risk Level', val: selected.risk_level==='HIGH' ? 'High Risk' : 'Moderate Risk', high: selected.risk_level==='HIGH' },
                          { key:'Score',      val: `${Math.round(selected.risk_score * 100)}/100`, high: selected.risk_score > 0.65 },
                        ].map(row => (
                          <div key={row.key} className={styles.replayKvRow}>
                            <span className={styles.replayKvKey}>{row.key}</span>
                            <span className={styles.replayKvVal} style={{color:row.high?'#ef4444':'inherit'}}>{row.val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Tags / key factors */}
                      <div className={styles.replayMetaCard}>
                        <div className={styles.replayMetaTitle}>Risk Tags</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
                          {(selected.key_factors ?? []).length > 0
                            ? (selected.key_factors ?? []).map((f,i) => <span key={i} className={styles.replayTag}>{f}</span>)
                            : <span style={{fontSize:11,color:'#94a3b8'}}>No key factors recorded</span>
                          }
                          <span className={styles.replayTag}>{selected.risk_level}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
          </div>
        </div>
    </div>
  )
}

// ── PANEL: History ────────────────────────────────────────────────────────────
function HistoryPanel({ alerts, loading, patients, rooms, caregivers }: { alerts: Alert[]; loading: boolean; patients: Patient[]; rooms: Room[]; caregivers: Caregiver[] }) {
  const cgMap = Object.fromEntries(caregivers.map(c => [c.id, c.display_name]))
  const roomCgMap = Object.fromEntries(rooms.map(r => [String(r.id), r.caregiver_id ? (cgMap[r.caregiver_id] ?? '—') : '—']))
  const [patientFilter, setPatientFilter] = useState('all')

  if (loading && !alerts.length) return <div className={styles.empty}>Loading…</div>

  const patientCode = (id: number | null) => patients.find(p => p.id === id)?.patient_code ?? (id != null ? `#${id}` : '—')
  const patientIds = Array.from(new Set(alerts.map(a => a.patient_id).filter((id): id is number => id != null)))
  const shown = patientFilter === 'all' ? alerts : alerts.filter(a => String(a.patient_id) === patientFilter)

  // Risk over time — last 20 alerts as scores
  const riskPts = [...shown].reverse().slice(0, 20).map(a => Math.round(a.risk_score * 100))

  // Bar chart — last 7 days event counts
  const now = new Date()
  const days = Array.from({length:7}, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i))
    return d.toDateString()
  })
  const dayCounts = days.map(d => alerts.filter(a => new Date(a.timestamp).toDateString() === d).length)
  const maxDay = Math.max(...dayCounts, 1)

  return (
    <div>
      {/* Filters row — matches wireframe */}
      <div className={styles.historyFilterBar}>
        <select className={styles.historySelect}
          value={patientFilter} onChange={e => setPatientFilter(e.target.value)}>
          <option value="all">All Patients</option>
          {patientIds.map(id => <option key={id} value={String(id)}>{patientCode(id)}</option>)}
        </select>
        <button className={styles.exportBtn2} onClick={() => {
          const csv = 'time,risk,score,posture,key_factors,status\n' +
            shown.map(a => `"${fmtTime(a.timestamp)}",${a.risk_level},${Math.round(a.risk_score)},"${a.posture??''}","${(a.key_factors??[]).join('; ')}",${a.acknowledged?'Acked':'Pending'}`).join('\n')
          const url = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
          const el = document.createElement('a'); el.href=url; el.download='history.csv'; el.click()
        }}>⬇ Export CSV</button>
      </div>

      {/* Two charts — matches wireframe */}
      <div className={styles.historyCharts}>
        <div className={styles.historyChartCard}>
          <div className={styles.historyChartTitle}>Risk Level Over Time</div>
          <div className={styles.historyTrendBox}>
            <svg viewBox="0 0 300 70" width="100%" height="70" preserveAspectRatio="none">
              <line x1="0" y1="47" x2="300" y2="47" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4"/>
              <line x1="0" y1="23" x2="300" y2="23" stroke="#ef4444" strokeWidth="1" strokeDasharray="2"/>
              {riskPts.length > 1 && (
                <polyline
                  points={riskPts.map((v,i) => `${(i/(riskPts.length-1))*298+1},${70-(v/100)*68}`).join(' ')}
                  fill="none" stroke="#ef4444" strokeWidth="2"/>
              )}
            </svg>
            <div style={{display:'flex',gap:12,fontSize:10,color:'#94a3b8',marginTop:2}}>
              <span style={{color:'#f59e0b'}}>— Moderate (40)</span>
              <span style={{color:'#ef4444'}}>— High (70)</span>
            </div>
          </div>
        </div>

        <div className={styles.historyChartCard}>
          <div className={styles.historyChartTitle}>Risk Events Count (7 days)</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:4,height:90,paddingBottom:4}}>
            {dayCounts.map((cnt, i) => {
              const d = new Date(days[i]!)
              const dayLabel = d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })
              return (
                <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <div style={{
                    background: cnt > 3 ? '#ef4444' : cnt > 1 ? '#f59e0b' : '#22c55e',
                    borderRadius:'2px 2px 0 0', width:'100%',
                    height: `${Math.max((cnt/maxDay)*70, 4)}px`,
                    minHeight:4
                  }}/>
                  <div style={{fontSize:8,color:'#94a3b8',whiteSpace:'nowrap'}}>{dayLabel}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Event log table — matches wireframe */}
      <div className={styles.historyTableCard}>
        <div className={styles.historyChartTitle} style={{marginBottom:8}}>Event Log</div>
        {shown.length === 0
          ? <div className={styles.empty}>No events recorded yet</div>
          : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Patient</th>
                    <th>Risk</th>
                    <th>Score</th>
                    <th>Posture</th>
                    <th>Key Factors</th>
                    <th>Caregiver</th>
                    <th>Status</th>
                    <th>Replay</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 50).map(a => (
                    <tr key={a.id} className={a.risk_level === 'HIGH' ? styles.rowHigh : a.risk_level === 'MODERATE' ? styles.rowMod : ''}>
                      <td className={styles.tdTime}>{fmtTime(a.timestamp)}</td>
                      <td>{patientCode(a.patient_id)}</td>
                      <td><RiskBadge level={a.risk_level} /></td>
                      <td style={{fontWeight:700, color:a.risk_level==='HIGH'?'#ef4444':a.risk_level==='MODERATE'?'#f59e0b':'#22c55e'}}>
                        {Math.round(a.risk_score * 100)}
                      </td>
                      <td>{a.posture ?? '—'}</td>
                      <td className={styles.tdFactors}>{(a.key_factors ?? []).slice(0,2).join(', ') || '—'}</td>
                      <td className={styles.tdTime}>{a.room_id ? (roomCgMap[String(a.room_id)] ?? '—') : '—'}</td>
                      <td>
                        {a.acknowledged
                          ? <span className={styles.ackedPill}>Acked</span>
                          : <span className={styles.unackedPill}>Pending</span>}
                      </td>
                      <td>
                        {(a.risk_level === 'HIGH' || a.risk_level === 'MODERATE')
                          ? <span className={styles.replayLink}>▶</span>
                          : <span style={{color:'#94a3b8'}}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length > 50 && (
                <div className={styles.tablePager}>Showing 50 of {shown.length} events</div>
              )}
            </div>
          )
        }
      </div>
    </div>
  )
}

// ── Analytics SVG mini-chart helpers ─────────────────────────────────────────
function SparkLine({ data, color, height=60, width=260 }: { data: number[]; color: string; height?: number; width?: number }) {
  if (data.length < 2) return <svg width={width} height={height}><text x="10" y="30" fill="#64748b" fontSize="12">No data yet</text></svg>
  const max = Math.max(...data, 0.01)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2
    const y = height - 4 - (v / max) * (height - 8)
    return `${x},${y}`
  }).join(' ')
  const areaClose = ` ${(data.length-1)/(data.length-1)*(width-4)+2},${height-2} 2,${height-2}`
  return (
    <svg width={width} height={height} style={{overflow:'visible'}}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={pts + areaClose} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Last point dot */}
      {data.length > 0 && (() => {
        const last = data[data.length-1]
        const x = width - 2
        const y = height - 4 - (last / max) * (height - 8)
        return <circle cx={x} cy={y} r="4" fill={color} stroke="#0f172a" strokeWidth="1.5" />
      })()}
    </svg>
  )
}

function DonutChart({ slices, size=120 }: { slices: {label:string;val:number;color:string}[]; size?: number }) {
  const total = slices.reduce((s,x) => s + x.val, 0) || 1
  let angle = -Math.PI / 2
  const r = size * 0.38; const cx = size/2; const cy = size/2
  const paths = slices.map(s => {
    const a0 = angle
    const sweep = (s.val / total) * 2 * Math.PI
    angle += sweep
    if (sweep < 0.01) return null
    const x1 = cx + r * Math.cos(a0), y1 = cy + r * Math.sin(a0)
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    return <path key={s.label} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`} fill={s.color} />
  })
  return (
    <svg width={size} height={size} style={{overflow:'visible'}}>
      <circle cx={cx} cy={cy} r={r} fill="#f1f5f9" />
      {paths}
      <circle cx={cx} cy={cy} r={r*0.58} fill="#fff" />
      <text x={cx} y={cy+5} textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="800">{total}</text>
    </svg>
  )
}

function MiniBarChart({ items, height=90 }: { items: {label:string; val:number; color:string}[]; height?: number }) {
  const max = Math.max(...items.map(i => i.val), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:14, height, paddingTop:4 }}>
      {items.map(i => (
        <div key={i.label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', justifyContent:'flex-end', gap:6 }}>
          <span style={{ fontSize:13, fontWeight:800, color:i.color }}>{i.val}</span>
          <div style={{
            width:'100%', maxWidth:44, borderRadius:'6px 6px 0 0',
            background: i.val > 0 ? i.color : '#f1f5f9',
            height: `${Math.max((i.val/max)*(height-40), 4)}px`,
            transition:'height 0.3s',
          }} />
          <span style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:0.3 }}>{i.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── PANEL: Analytics ─────────────────────────────────────────────────────────
function AnalyticsPanel({ summary, alerts, patients, rooms }: {
  summary: DashboardSummary | null; alerts: Alert[]; patients: Patient[]; rooms: Room[]
}) {
  const [period, setPeriod] = useState<'7'|'30'|'90'>('7')
  const now = Date.now()
  const periodAlerts = alerts.filter(a => now - new Date(a.timestamp).getTime() <= Number(period) * 86_400_000)
  const highCount  = periodAlerts.filter(a => a.risk_level === 'HIGH').length
  const modCount   = periodAlerts.filter(a => a.risk_level === 'MODERATE').length
  const ackedCount = periodAlerts.filter(a => a.acknowledged).length
  const ackedPct   = periodAlerts.length > 0 ? Math.round((ackedCount/periodAlerts.length)*100) : 0

  // Average time-to-acknowledge, computed from real ack timestamps (not a placeholder)
  const responseTimes = periodAlerts
    .filter(a => a.acknowledged && a.ack_at)
    .map(a => (new Date(a.ack_at!).getTime() - new Date(a.timestamp).getTime()) / 1000)
    .filter(s => s >= 0)
  const avgResponseS = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((s,x) => s+x, 0) / responseTimes.length)
    : null
  const avgResponseLabel = avgResponseS === null ? '—'
    : avgResponseS < 60 ? `${avgResponseS}s`
    : `${Math.round(avgResponseS/60)}m`

  // Hourly bars — last 11 hours
  const hourBuckets = Array.from({length:11}, (_, i) => {
    const start = now - (10-i)*3600_000
    return alerts.filter(a => { const t=new Date(a.timestamp).getTime(); return t>=start && t<start+3600_000 }).length
  })
  const maxHr = Math.max(...hourBuckets, 1)
  const hourLabels = Array.from({length:11}, (_, i) => {
    const h = new Date(now - (10-i)*3600_000).getHours()
    return `${h}:00`
  })

  // Zone breakdown from key_factors
  const zoneCounts: Record<string,number> = {}
  periodAlerts.forEach(a => (a.key_factors??[]).forEach(f => { zoneCounts[f]=(zoneCounts[f]??0)+1 }))

  // Top patients by avg score (risk_score is stored 0..1 — compare on that scale)
  const patScores: Record<string, number[]> = {}
  periodAlerts.forEach(a => {
    if (!a.patient_id) return
    const k = String(a.patient_id)
    if (!patScores[k]) patScores[k] = []
    patScores[k].push(a.risk_score)
  })
  const topPats = Object.entries(patScores).map(([pid, scores]) => ({
    pid,
    avg: scores.reduce((s,x)=>s+x,0)/scores.length,
    high: scores.filter(s=>s>=0.50).length,
    mod: scores.filter(s=>s>=0.25&&s<0.50).length,
  })).sort((a,b)=>b.avg-a.avg).slice(0,5)

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:17,fontWeight:800,color:'#0f172a'}}>Analytics</div>
        <div style={{display:'flex',gap:4}}>
          {(['7','30','90'] as const).map(p => (
            <button key={p} className={period===p ? styles.alertFilterActive : styles.alertFilterBtn}
              style={{padding:'4px 12px',borderRadius:6,fontSize:11}} onClick={()=>setPeriod(p)}>
              {p} Days
            </button>
          ))}
        </div>
      </div>

      {/* 4-col KPI */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
        {[
          {label:'Total Alerts',      val:periodAlerts.length, sub:`in last ${period} days`,   c:'#60a5fa'},
          {label:'Avg Response Time', val:avgResponseLabel,    sub:responseTimes.length ? 'time to acknowledge' : 'no acknowledged alerts yet', c:avgResponseS !== null ? '#22c55e' : '#64748b'},
          {label:'High Risk Share',   val:`${periodAlerts.length?Math.round(highCount/periodAlerts.length*100):0}%`, sub:'of alerts in period', c:'#ef4444'},
          {label:'Acknowledged',      val:`${ackedCount}/${periodAlerts.length}`, sub:`${ackedPct}% responded to`, c:'#22c55e'},
        ].map(k => (
          <div key={k.label} className={styles.dashKpiCard}>
            <div className={styles.dashKpiLabel}>{k.label}</div>
            <div className={styles.dashKpiVal} style={{color:k.c}}>{k.val}</div>
            <div className={styles.dashKpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        {/* Alert Volume by Hour */}
        <div className={styles.analyticCard2}>
          <div className={styles.analyticTitle}>Alert Volume by Hour (Today)</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:3,height:80,paddingBottom:18}}>
            {hourBuckets.map((n,i) => (
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1,height:'100%',justifyContent:'flex-end'}}>
                <div style={{
                  background: n>2?'#ef4444':n>0?'#f59e0b':'#334155',
                  borderRadius:'2px 2px 0 0', width:'100%',
                  height:`${Math.max((n/maxHr)*56,3)}px`, minHeight:3,
                }} title={`${hourLabels[i]}: ${n} alerts`} />
                <div style={{fontSize:7,color:'#64748b',whiteSpace:'nowrap',transform:'rotate(-45deg)',transformOrigin:'top center',marginTop:2}}>{hourLabels[i]}</div>
              </div>
            ))}
          </div>
          {hourBuckets.every(n => n === 0) && <div style={{fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:4}}>No alerts in the last 11 hours</div>}
        </div>

        {/* Risk by Zone */}
        <div className={styles.analyticCard2}>
          <div className={styles.analyticTitle}>Risk by Zone / Key Factor</div>
          {Object.keys(zoneCounts).length === 0
            ? <div style={{fontSize:11,color:'#94a3b8',marginTop:16}}>No zone data yet — run inference to populate</div>
            : Object.entries(zoneCounts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([z,cnt]) => (
              <div key={z} className={styles.replayKvRow}>
                <span className={styles.replayKvKey}>{z}</span>
                <span className={styles.replayKvVal} style={{color:'#f59e0b'}}>{cnt} events</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Top 5 highest-risk patients */}
      <div className={styles.analyticCard2}>
        <div className={styles.analyticTitle}>Top Highest-Risk Patients ({period}-day avg)</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Rank</th><th>Patient ID</th><th>Room</th><th>Avg Score</th><th>HIGH Events</th><th>MOD Events</th></tr>
            </thead>
            <tbody>
              {topPats.length === 0
                ? <tr><td colSpan={6} style={{textAlign:'center',color:'#94a3b8'}}>No alert data yet</td></tr>
                : topPats.map((p, i) => {
                  const pat = patients.find(pt => String(pt.id) === p.pid)
                  return (
                    <tr key={p.pid}>
                      <td style={{fontWeight:700}}>{i+1}</td>
                      <td style={{color:'#60a5fa',fontWeight:600}}>{pat?.patient_code ?? p.pid}</td>
                      <td>{pat?.room_id ?? '—'}</td>
                      <td style={{fontWeight:700,color:p.avg>=0.50?'#ef4444':'#f59e0b'}}>{Math.round(p.avg*100)}</td>
                      <td style={{color:'#ef4444',fontWeight:600}}>{p.high}</td>
                      <td style={{color:'#f59e0b'}}>{p.mod}</td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── PANEL: Reports ────────────────────────────────────────────────────────────
function ReportsPanel({ alerts, patients, rooms }: { alerts: Alert[]; patients: Patient[]; rooms: Room[] }) {
  const [exported, setExported] = useState<string|null>(null)

  const exportCSV = (type: 'alerts'|'patients'|'summary') => {
    let csv = ''
    if (type === 'alerts') {
      csv = 'id,timestamp,risk_level,risk_score,posture,key_factors,acknowledged,ack_by\n'
      csv += alerts.map(a =>
        `${a.id},"${a.timestamp}",${a.risk_level},${a.risk_score},"${a.posture ?? ''}","${(a.key_factors??[]).join('; ')}",${a.acknowledged},"${a.ack_by ?? ''}"`
      ).join('\n')
    } else if (type === 'patients') {
      csv = 'patient_code,gender,room_id\n'
      csv += patients.map(p => `${p.patient_code},${p.gender ?? ''},${p.room_id ?? ''}`).join('\n')
    } else {
      const high = alerts.filter(a => a.risk_level === 'HIGH').length
      const mod  = alerts.filter(a => a.risk_level === 'MODERATE').length
      const ack  = alerts.filter(a => a.acknowledged).length
      csv = `Report Generated,${new Date().toISOString()}\nTotal Alerts,${alerts.length}\nHIGH Alerts,${high}\nMODERATE Alerts,${mod}\nAcknowledged,${ack}\nAck Rate,${alerts.length ? Math.round(ack/alerts.length*100) : 0}%\nTotal Patients,${patients.length}\nTotal Rooms,${rooms.length}`
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `sentry_${type}_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    setExported(type); setTimeout(() => setExported(null), 3000)
  }

  const exportJSON = () => {
    const payload = {
      generated: new Date().toISOString(),
      system: 'SENTRY — Edge Fall Risk Detection',
      model: 'ST-GCN + Biomechanical Feature Classifier + Late Fusion Network',
      summary: {
        total_alerts: alerts.length,
        high_alerts: alerts.filter(a => a.risk_level === 'HIGH').length,
        moderate_alerts: alerts.filter(a => a.risk_level === 'MODERATE').length,
        acknowledged: alerts.filter(a => a.acknowledged).length,
        patients: patients.length,
        rooms: rooms.length,
      },
      alerts,
      patients,
      rooms: rooms.map(r => ({ room_code: r.room_code, ward: r.ward, camera_src: r.camera_src ? '[configured]' : null })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `sentry_full_report_${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(url)
    setExported('json'); setTimeout(() => setExported(null), 3000)
  }

  // Session stats
  const highCount  = alerts.filter(a => a.risk_level === 'HIGH').length
  const modCount   = alerts.filter(a => a.risk_level === 'MODERATE').length
  const ackedCount = alerts.filter(a => a.acknowledged).length
  const ackedPct   = alerts.length ? Math.round(ackedCount / alerts.length * 100) : 0
  const liveRooms  = rooms.filter(r => r.camera_src).length
  const responseTimes = alerts
    .filter(a => a.acknowledged && a.ack_at && a.timestamp)
    .map(a => (new Date(a.ack_at!).getTime() - new Date(a.timestamp).getTime()) / 60000)
  const avgResponseMin = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((s,v) => s+v, 0) / responseTimes.length)
    : null

  const kpis = [
    { label:'Total Alerts',  val: alerts.length,                              accent:'#60a5fa' },
    { label:'HIGH Risk',     val: highCount,                                  accent:'#ef4444' },
    { label:'MODERATE Risk', val: modCount,                                   accent:'#f59e0b' },
    { label:'Acknowledged',  val: `${ackedCount} (${ackedPct}%)`,             accent:'#22c55e' },
    { label:'Avg Response',  val: avgResponseMin != null ? `${avgResponseMin} min` : '—', accent:'#a78bfa' },
    { label:'Live Cameras',  val: `${liveRooms}/${rooms.length}`,             accent:'#38bdf8' },
    { label:'Patients',      val: patients.length,                            accent:'#fb923c' },
    { label:'Session Date',  val: new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}), accent:'#94a3b8' },
  ]

  return (
    <div className={styles.reportsWrap}>
      <div className={styles.reportHeader}>
        <div>
          <div className={styles.configTitle}>📋 Session Report</div>
          <p className={styles.configSub}>
            Export fall alert history, patient register, and system summary. All data is anonymised — patient codes only, no personally identifiable information.
          </p>
        </div>
        <div className={styles.reportMeta}>
          <span>Generated: {new Date().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</span>
          <span>SENTRY Fall Risk Detection</span>
        </div>
      </div>

      {/* Summary card */}
      <div className={styles.reportSummaryCard}>
        <div className={styles.reportSummaryTitle}>Session Summary</div>
        <div className={styles.reportStatsRow}>
          {kpis.map(s => (
            <div key={s.label} className={styles.reportStat}>
              <div className={styles.reportStatVal} style={{color:s.accent}}>{s.val}</div>
              <div className={styles.reportStatLabel}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className={styles.reportModelInfo}>
          <span className={styles.techBadge}>Full-body movement tracking</span>
          <span className={styles.techBadge}>No video stored</span>
          <span className={styles.techBadge}>Runs on-site</span>
        </div>
      </div>

      {/* Export options */}
      <div className={styles.exportGrid}>
        {[
          { type:'alerts' as const, title:'Alert History', desc:`${alerts.length} fall alerts with risk scores, postures, key factors, and acknowledgement timestamps.`, icon:'⚠️' },
          { type:'patients' as const, title:'Patient Register', desc:`${patients.length} patients with anonymised codes, gender, and room assignments.`, icon:'👤' },
          { type:'summary' as const, title:'Session Summary', desc:'High-level statistics: alert counts, acknowledgement rate, coverage metrics.', icon:'📊' },
        ].map(item => (
          <div key={item.type} className={styles.exportCard}>
            <div className={styles.exportCardIcon}>{item.icon}</div>
            <div className={styles.exportCardTitle}>{item.title}</div>
            <p className={styles.exportCardDesc}>{item.desc}</p>
            <button
              className={`${styles.exportBtn} ${exported === item.type ? styles.exportBtnDone : ''}`}
              onClick={() => exportCSV(item.type)}
            >
              {exported === item.type ? '✓ Downloaded' : '↓ Export CSV'}
            </button>
          </div>
        ))}
        <div className={styles.exportCard}>
          <div className={styles.exportCardIcon}>🗂️</div>
          <div className={styles.exportCardTitle}>Full Report (JSON)</div>
          <p className={styles.exportCardDesc}>Complete dataset — alerts, patients, rooms — as structured JSON for research analysis or import into other tools.</p>
          <button
            className={`${styles.exportBtn} ${exported === 'json' ? styles.exportBtnDone : ''}`}
            onClick={exportJSON}
          >
            {exported === 'json' ? '✓ Downloaded' : '↓ Export JSON'}
          </button>
        </div>
      </div>

      <div className={styles.reportFooter}>
        <p>⚠️ This report is intended for clinical supervision purposes only. All patient data uses anonymised codes — no names, faces, or personal details are ever stored.</p>
        <p style={{marginTop:4}}>SENTRY · Automatic Fall Risk Monitoring</p>
      </div>
    </div>
  )
}

// ── PANEL: Users & Roles ──────────────────────────────────────────────────────
function UsersPanel({ caregivers, rooms }: { caregivers: Caregiver[]; rooms: Room[] }) {
  const cgRooms: Record<string, string[]> = {}
  for (const r of rooms) {
    if (r.caregiver_id) {
      if (!cgRooms[r.caregiver_id]) cgRooms[r.caregiver_id] = []
      cgRooms[r.caregiver_id].push(r.room_code)
    }
  }
  const GRAD_COLORS = [
    'linear-gradient(135deg,#3b82f6,#818cf8)',
    'linear-gradient(135deg,#22c55e,#0d9488)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#a855f7,#ec4899)',
  ]
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
        <div>
          <div style={{fontSize:17,fontWeight:800,color:'#0f172a'}}>Caregiver Room Assignments</div>
          <p style={{fontSize:11,color:'#64748b',marginTop:4}}>Each caregiver's mobile app shows only their assigned rooms and receives alerts for those rooms only. To change an assignment, go to the <strong>Rooms</strong> tab.</p>
        </div>
        <span className={styles.pulseTag}>Overview only</span>
      </div>
      {caregivers.length === 0
        ? <div className={styles.empty}>No caregivers registered yet.</div>
        : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {caregivers.map((cg, idx) => {
              const assigned = cgRooms[cg.id] ?? []
              return (
                <div key={cg.id} className={styles.assignCard}>
                  <div className={styles.assignAvatar} style={{background: GRAD_COLORS[idx % GRAD_COLORS.length]}}>
                    {cg.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1}}>
                    <div className={styles.assignName}>{cg.display_name}</div>
                    <div className={styles.assignRole}>{cg.ward ? `Ward: ${cg.ward}` : 'No ward assigned'}</div>
                    <div className={styles.assignRooms}>
                      {assigned.length > 0
                        ? assigned.map(rc => <span key={rc} className={styles.assignRoomTag}>{rc}</span>)
                        : <span style={{fontSize:11,color:'#94a3b8',fontStyle:'italic'}}>No rooms assigned</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
      <div style={{marginTop:12,padding:'10px 12px',background:'rgba(59,130,246,.06)',border:'1px solid rgba(59,130,246,.2)',borderRadius:8,fontSize:10,color:'#64748b'}}>
        <strong style={{color:'#3b82f6'}}>ℹ How it works:</strong> When a room is assigned to a caregiver (from the Rooms tab), their mobile app automatically shows only that patient and sends them alerts for that room.
      </div>
    </div>
  )
}

// ── PANEL: Config ─────────────────────────────────────────────────────────────
function ConfigPanel({ rooms, patients, onRefresh, alerts }: { rooms: Room[]; patients: Patient[]; onRefresh: () => void; alerts: Alert[] }) {
  const [replayStatus, setReplayStatus] = React.useState<{count:number;total_frames:number;alert_ids:number[]} | null>(null)
  const [clearing, setClearing] = React.useState(false)
  const [cleared,  setCleared]  = React.useState(false)

  const fetchReplayStatus = () =>
    fetch('http://localhost:8000/api/replay/status').then(r => r.ok ? r.json() : null).then(d => { if (d) setReplayStatus(d) }).catch(() => {})

  React.useEffect(() => {
    fetchReplayStatus()
    const t = setInterval(fetchReplayStatus, 15_000)
    return () => clearInterval(t)
  }, [])

  const handleClearDemo = async () => {
    if (!window.confirm('Clear ALL alerts from the database? Use this before a viva demo to start fresh.')) return
    setClearing(true)
    try {
      await fetch('http://localhost:8000/api/alerts/clear-demo', { method: 'DELETE' })
      setCleared(true); setTimeout(() => setCleared(false), 3000)
      fetchReplayStatus()
      onRefresh()
    } catch { } finally { setClearing(false) }
  }
  const [selRoom,    setSelRoom]    = useState('')
  const [camSource,  setCamSource]  = useState('0')
  const [selPatient, setSelPatient] = useState('')
  const [starting,   setStarting]   = useState(false)
  const [camStatus,  setCamStatus]  = useState<Record<string, 'starting'|'started'|'error'>>({})

  const patientsInRoom = patients.filter(p => p.room_id === selRoom)

  const handleStartCamera = async () => {
    if (!selRoom || !camSource) return
    setStarting(true)
    setCamStatus(s => ({ ...s, [selRoom]: 'starting' }))
    try {
      const res = await fetch(`http://localhost:8000/api/rooms/${selRoom}/camera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: camSource, patient_id: selPatient || 'P001' }),
      })
      if (!res.ok) throw new Error()
      setCamStatus(s => ({ ...s, [selRoom]: 'started' }))
      onRefresh()
    } catch {
      setCamStatus(s => ({ ...s, [selRoom]: 'error' }))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div>
      <div className={styles.configSection}>
        <div className={styles.configTitle}>📷 Camera Setup</div>
        <p className={styles.configSub}>
          Connect a camera to a room. Monitoring starts immediately once the camera is connected.
        </p>

        <div className={styles.camSetupCard}>
          <div className={styles.camStep}>
            <div className={styles.camStepNum}>1</div>
            <div className={styles.camStepBody}>
              <label className={styles.camLabel}>Select Room</label>
              <select className={styles.camSelect} value={selRoom}
                onChange={e => { setSelRoom(e.target.value); setSelPatient('') }}>
                <option value="">— Choose a room —</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.room_code}>
                    {r.room_code} · {r.ward ?? 'No ward'}{r.camera_src ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.camStep}>
            <div className={styles.camStepNum}>2</div>
            <div className={styles.camStepBody}>
              <label className={styles.camLabel}>Camera Source</label>
              <div className={styles.camSourceRow}>
                <input className={styles.camInput} value={camSource}
                  onChange={e => setCamSource(e.target.value)} placeholder="0" />
                {['0','1'].map(v => (
                  <button key={v}
                    className={`${styles.camHintBtn} ${camSource === v ? styles.camHintActive : ''}`}
                    onClick={() => setCamSource(v)}>Webcam {v}</button>
                ))}
              </div>
              <p className={styles.camNote}>
                <code>0</code> = built-in / first USB webcam · <code>1</code> = second USB · <code>rtsp://…</code> = IP camera
              </p>
            </div>
          </div>

          <div className={styles.camStep}>
            <div className={styles.camStepNum}>3</div>
            <div className={styles.camStepBody}>
              <label className={styles.camLabel}>Patient Being Monitored</label>
              <select className={styles.camSelect} value={selPatient}
                onChange={e => setSelPatient(e.target.value)} disabled={!selRoom}>
                <option value="">— Select patient —</option>
                {(patientsInRoom.length > 0 ? patientsInRoom : patients).map(p => (
                  <option key={p.id} value={p.patient_code}>
                    {p.patient_code} · {p.gender === 'M' ? 'Male' : 'Female'} · {p.room_id ?? '—'}
                  </option>
                ))}
              </select>
              {selRoom && patientsInRoom.length === 0 &&
                <p className={styles.camNote}>No patients in {selRoom} — showing all.</p>}
            </div>
          </div>

          <div className={styles.camStartRow}>
            <button
              className={`${styles.camStartBtn}
                ${camStatus[selRoom] === 'started' ? styles.camStarted : ''}
                ${camStatus[selRoom] === 'error'   ? styles.camError   : ''}`}
              onClick={handleStartCamera}
              disabled={!selRoom || !camSource || starting}
            >
              {starting ? '⏳ Starting…'
                : camStatus[selRoom] === 'started' ? '✓ Started — go to Live Monitoring tab'
                : camStatus[selRoom] === 'error'   ? '✗ Failed — check the camera number above'
                : '▶ Start Camera & Monitoring'}
            </button>
          </div>
        </div>

        <div className={styles.camStatusTable}>
          <div className={styles.camStatusHeader}>Current Camera Status</div>
          {rooms.map(r => (
            <div key={r.id} className={styles.configRow}>
              <div>
                <div className={styles.configRoomCode}>{r.room_code}</div>
                <div className={styles.configRoomWard}>{r.ward ?? 'No ward'}</div>
              </div>
              <div className={styles.configCamVal}>
                {r.camera_src
                  ? <span className={styles.camOnlineText}>● {r.camera_src}</span>
                  : <span className={styles.camOfflineText}>○ Not configured</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.configSection}>
        <div className={styles.configTitle}>Risk Thresholds</div>
        <div className={styles.thresholdGrid}>
          <div className={styles.thresholdRow}>
            <RiskBadge level="HIGH" />
            <span className={styles.thresholdVal}>Score 50 and above</span>
            <span className={styles.thresholdDesc}>Caregiver alerted immediately, replay clip saved</span>
          </div>
          <div className={styles.thresholdRow}>
            <RiskBadge level="MODERATE" />
            <span className={styles.thresholdVal}>Score 25–49</span>
            <span className={styles.thresholdDesc}>Caregiver notified once, logged for review</span>
          </div>
          <div className={styles.thresholdRow}>
            <RiskBadge level="NORMAL" />
            <span className={styles.thresholdVal}>Score below 25</span>
            <span className={styles.thresholdDesc}>No alert — routine activity</span>
          </div>
        </div>
      </div>

      <div className={styles.configSection}>
        <div className={styles.configTitle}>System Status</div>
        <div className={styles.storageGrid}>
          <div className={styles.storageCard}>
            <div className={styles.storageLabel}>Patient & Room Records</div>
            <div className={styles.storageVal} style={{color:'#22c55e'}}>● Connected</div>
            <div className={styles.storageSub}>Patients, rooms, and alert history are being saved</div>
          </div>
          <div className={styles.storageCard}>
            <div className={styles.storageLabel}>Alert Replay Clips</div>
            <div className={styles.storageVal} style={{color: replayStatus && replayStatus.count > 0 ? '#22c55e' : '#94a3b8'}}>
              {replayStatus === null ? 'Checking…' : replayStatus.count === 0 ? 'None yet' : `${replayStatus.count} saved`}
            </div>
            <div className={styles.storageSub}>
              {replayStatus && replayStatus.count > 0
                ? 'Available for HIGH alerts — view them from the Alerts or Event Replay tab'
                : 'A short skeleton-only clip is saved automatically whenever a HIGH alert fires'}
            </div>
          </div>
        </div>
      </div>

      {/* Demo reset — clear all alerts before viva */}
      <div className={styles.configSection} style={{borderTop:'2px solid #fef08a',background:'#fefce8'}}>
        <div className={styles.configTitle} style={{color:'#92400e'}}>🎓 Demo Reset</div>
        <p style={{fontSize:11,color:'#78350f',marginBottom:10}}>
          Clear all alerts from the database before a viva or demo so the dashboard starts fresh with real detections only.
          This removes all existing alert records and replay clips — use right before your demonstration.
        </p>
        <button
          onClick={handleClearDemo}
          disabled={clearing}
          style={{
            padding:'8px 18px', borderRadius:6, border:'1px solid #d97706',
            background: cleared ? '#22c55e' : '#f59e0b', color:'#fff',
            fontWeight:700, fontSize:12, cursor:'pointer',
          }}
        >
          {clearing ? 'Clearing…' : cleared ? '✓ Cleared — dashboard is fresh' : '🗑 Clear All Alerts for Demo'}
        </button>
      </div>
    </div>
  )
}

// ── PANEL: Zone Config ────────────────────────────────────────────────────────
// Preset polygon layouts — normalised [0,1] image coordinates
// Each zone is a convex quad [TL, TR, BR, BL]
const ZONE_PRESETS: Record<string, Record<string, number[][]>> = {
  'Standard Hospital Room': {
    BED:     [[0.03,0.03],[0.45,0.03],[0.45,0.52],[0.03,0.52]],
    CHAIR:   [[0.55,0.05],[0.97,0.05],[0.97,0.52],[0.55,0.52]],
    WALKING: [[0.03,0.56],[0.97,0.56],[0.97,0.97],[0.03,0.97]],
  },
  'Single Bed (Bed dominant)': {
    BED:     [[0.03,0.03],[0.60,0.03],[0.60,0.60],[0.03,0.60]],
    CHAIR:   [[0.65,0.05],[0.97,0.05],[0.97,0.45],[0.65,0.45]],
    WALKING: [[0.03,0.65],[0.97,0.65],[0.97,0.97],[0.03,0.97]],
  },
  'Full Walking (Rehab Ward)': {
    BED:     [[0.03,0.03],[0.35,0.03],[0.35,0.45],[0.03,0.45]],
    CHAIR:   [[0.40,0.05],[0.60,0.05],[0.60,0.45],[0.40,0.45]],
    WALKING: [[0.03,0.50],[0.97,0.50],[0.97,0.97],[0.03,0.97]],
  },
}

function ZoneConfigPanel({ rooms }: { rooms: Room[] }) {
  const [selRoom,  setSelRoom]  = useState(rooms[0]?.room_code ?? '')
  const [saved,    setSaved]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [demoZone, setDemoZone] = useState<string|null>(null)   // simulated patient position for live preview
  const [preset,   setPreset]   = useState('Standard Hospital Room')
  const [zones, setZones] = useState<Record<string, number[][]>>(
    ZONE_PRESETS['Standard Hospital Room']!
  )

  // Load zone polygons from DB when room changes
  useEffect(() => {
    if (!selRoom) return
    const room = rooms.find(r => r.room_code === selRoom)
    const cfg = room?.zone_config
    if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
      const c = cfg as Record<string, unknown>
      // If it has polygon arrays (array of arrays), use it; else fall back to preset
      if (Array.isArray(c.BED)) {
        setZones(c as unknown as Record<string, number[][]>)
        return
      }
    }
    setZones(ZONE_PRESETS[preset] ?? ZONE_PRESETS['Standard Hospital Room']!)
  }, [selRoom, rooms, preset])

  const handleSave = async () => {
    setSaving(true)
    try {
      const room = rooms.find(r => r.room_code === selRoom)
      if (!room) return
      await fetch(`http://localhost:8000/api/rooms/${room.id}/zones`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch { /* */ } finally { setSaving(false) }
  }

  const ZONE_DEFS = [
    { key: 'BED',     icon: '🛏', color: '#3b82f6', label: 'Bed Zone',
      why: 'Getting in/out of bed is a high-risk transition. The engine applies +0.08–+0.20 depending on posture.' },
    { key: 'CHAIR',   icon: '🪑', color: '#f59e0b', label: 'Chair Zone',
      why: 'Sit-to-stand and lateral lean in a chair are common fall precursors. Modifier: +0.05–+0.20.' },
    { key: 'WALKING', icon: '🚶', color: '#22c55e', label: 'Walking Zone',
      why: 'Open corridor — the ST-GCN model already handles slip/trip patterns. Zone modifier = 0.' },
  ] as const

  // Simulate the risk calculation with the active demo zone
  // Modifiers match context_engine.py _zone_risk_modifier (TRANSITION posture assumed for demo)
  const DEMO_DELTA: Record<string, number> = { BED: 0.15, CHAIR: 0.12, WALKING: 0.0 }
  const baseScore = 0.38   // example Late Fusion score before zone modifier
  const delta = demoZone != null ? (DEMO_DELTA[demoZone] ?? 0) : 0
  const finalScore = Math.min(Math.max(baseScore + delta, 0), 1)
  const finalLevel = finalScore >= 0.50 ? 'HIGH' : finalScore >= 0.25 ? 'MODERATE' : 'NORMAL'
  const levelColor = finalLevel === 'HIGH' ? '#ef4444' : finalLevel === 'MODERATE' ? '#f59e0b' : '#22c55e'

  // Map polygon to CSS % for visual preview (TL corner → box size from range)
  function polyToCSS(poly: number[][]): React.CSSProperties {
    const xs = poly.map(p => p[0]!); const ys = poly.map(p => p[1]!)
    const minX = Math.min(...xs); const maxX = Math.max(...xs)
    const minY = Math.min(...ys); const maxY = Math.max(...ys)
    return { left:`${minX*100}%`, top:`${minY*100}%`, width:`${(maxX-minX)*100}%`, height:`${(maxY-minY)*100}%` }
  }

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <div>
          <div style={{fontSize:17,fontWeight:800,color:'#0f172a'}}>Zone Configuration</div>
          <p style={{fontSize:11,color:'#64748b',marginTop:2}}>
            Divides the room into areas (Bed, Chair, Walking). When the patient is detected in a zone,
            the system adds a small risk modifier (δ) to the fusion score — making zone-aware decisions
            without any extra sensors.
          </p>
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0,marginLeft:16,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <select className={styles.historySelect} value={selRoom} onChange={e => setSelRoom(e.target.value)}>
            {rooms.map(r => <option key={r.id} value={r.room_code}>{r.room_code}{r.camera_src ? ' ● live' : ''}</option>)}
          </select>
          <select className={styles.historySelect} value={preset} onChange={e => { setPreset(e.target.value); setZones(ZONE_PRESETS[e.target.value]!) }}>
            {Object.keys(ZONE_PRESETS).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? '…' : saved ? '✓ Saved to DB' : 'Save Zone Layout'}
          </button>
        </div>
      </div>

      {/* How it works — step flow */}
      <div style={{display:'flex',gap:0,marginBottom:14,border:'1px solid #e2e8f0',borderRadius:8,overflow:'hidden'}}>
        {[
          { n:'1', title:'Camera detects patient',    body:'MediaPipe extracts 14 joints every frame. Hip midpoint = patient position.',  color:'#3b82f6' },
          { n:'2', title:'Zone membership check',     body:'Context engine checks which zone the hip midpoint falls inside.',             color:'#8b5cf6' },
          { n:'3', title:'δ modifier applied',        body:'The zone\'s δ is added to the Late Fusion score before threshold check.',     color:'#f59e0b' },
          { n:'4', title:'Risk level decided',        body:'Score ≥ 0.50 = HIGH alert. Score ≥ 0.25 = MODERATE. Below = NORMAL.',       color:'#22c55e' },
        ].map((s, i) => (
          <div key={s.n} style={{flex:1,padding:'10px 12px',background:'#f8fafc',borderRight: i<3 ? '1px solid #e2e8f0' : undefined}}>
            <div style={{fontSize:11,fontWeight:800,color:s.color,marginBottom:4}}>Step {s.n} — {s.title}</div>
            <div style={{fontSize:10,color:'#64748b',lineHeight:1.5}}>{s.body}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

        {/* LEFT — zone diagram + live preview */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'#475569',marginBottom:6}}>
            Room Layout — click a zone to simulate patient position
          </div>
          <div style={{position:'relative',background:'#f1f5f9',border:'2px solid #cbd5e1',borderRadius:8,height:210,overflow:'hidden',cursor:'pointer'}}>
            {/* Door */}
            <div style={{position:'absolute',top:8,right:10,fontSize:20}}>🚪</div>
            <div style={{position:'absolute',top:6,right:32,fontSize:9,color:'#94a3b8'}}>Door</div>

            {/* Zones — clickable, sized from polygon coordinates */}
            {ZONE_DEFS.map(z => {
              const poly = zones[z.key]
              if (!poly) return null
              const css = polyToCSS(poly)
              return (
                <div
                  key={z.key}
                  onClick={() => setDemoZone(d => d === z.key ? null : z.key)}
                  style={{
                    position:'absolute', ...css,
                    border: `2px ${demoZone === z.key ? 'solid' : 'dashed'} ${z.color}`,
                    borderRadius:6,
                    background: demoZone === z.key ? `${z.color}22` : `${z.color}0d`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    flexDirection:'column', gap:1, cursor:'pointer',
                    transition:'all .2s',
                    boxShadow: demoZone === z.key ? `0 0 0 3px ${z.color}44` : undefined,
                  }}>
                  <span style={{fontSize:demoZone === z.key ? 22 : 16}}>{z.icon}</span>
                  <span style={{fontSize:8,fontWeight:800,color:z.color}}>{z.key}</span>
                  <span style={{fontSize:8,color:z.color,fontWeight:700}}>δ = +{DEMO_DELTA[z.key]?.toFixed(2) ?? '0.00'}</span>
                </div>
              )
            })}

            {/* Patient dot — center of the selected zone polygon */}
            {demoZone && (() => {
              const poly = zones[demoZone]
              if (!poly) return null
              const cx = poly.reduce((s,p) => s + p[0]!, 0) / poly.length
              const cy = poly.reduce((s,p) => s + p[1]!, 0) / poly.length
              return <div style={{
                position:'absolute', left:`calc(${cx*100}% - 6px)`, top:`calc(${cy*100}% - 6px)`,
                width:12, height:12, borderRadius:'50%',
                background:'#ef4444', boxShadow:'0 0 0 5px rgba(239,68,68,.35)',
                transition:'all .3s', pointerEvents:'none',
              }} title="Patient hip midpoint (demo)" />
            })()}

            {/* No zone selected hint */}
            {!demoZone && (
              <div style={{position:'absolute',bottom:8,left:0,right:0,textAlign:'center',fontSize:9,color:'#94a3b8'}}>
                ↑ Click any zone to simulate patient position
              </div>
            )}
          </div>

          {/* Live calculation preview */}
          <div style={{marginTop:8,padding:'10px 12px',background:'#0f172a',borderRadius:8,border:'1px solid #1e293b'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',marginBottom:6}}>Live Risk Calculation Preview</div>
            <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{textAlign:'center',padding:'4px 8px',background:'#1e293b',borderRadius:6}}>
                <div style={{fontSize:9,color:'#64748b'}}>Base score</div>
                <div style={{fontSize:15,fontWeight:800,color:'#f1f5f9'}}>{baseScore.toFixed(2)}</div>
              </div>
              <div style={{fontSize:16,color:'#475569'}}>+</div>
              <div style={{textAlign:'center',padding:'4px 8px',background:'#1e293b',borderRadius:6}}>
                <div style={{fontSize:9,color:'#64748b'}}>Zone δ</div>
                <div style={{fontSize:15,fontWeight:800,color: demoZone ? (delta>=0?'#f59e0b':'#22c55e') : '#475569'}}>
                  {demoZone ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : '0.00'}
                </div>
              </div>
              <div style={{fontSize:16,color:'#475569'}}>=</div>
              <div style={{textAlign:'center',padding:'4px 8px',background:'#1e293b',borderRadius:6,flex:1}}>
                <div style={{fontSize:9,color:'#64748b'}}>Final score</div>
                <div style={{fontSize:15,fontWeight:800,color:levelColor}}>{finalScore.toFixed(2)}</div>
              </div>
              <div style={{padding:'6px 12px',borderRadius:6,background:levelColor+'22',border:`1px solid ${levelColor}55`,fontWeight:800,fontSize:12,color:levelColor}}>
                {finalLevel}
              </div>
            </div>
            <div style={{fontSize:9,color:'#475569',marginTop:6}}>
              {demoZone
                ? `Patient detected in ${demoZone} zone → δ = ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} → final score ${finalScore.toFixed(2)} → ${finalLevel}`
                : 'Click a zone above to see how the modifier changes the risk level in real time'}
            </div>
          </div>
        </div>

        {/* RIGHT — editable δ per zone + explanation */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{fontSize:11,fontWeight:700,color:'#475569',marginBottom:2}}>
            Configure δ values per zone — saved to Supabase, applied immediately
          </div>

          {ZONE_DEFS.map(z => {
            const d = DEMO_DELTA[z.key] ?? 0
            const ex = Math.min(Math.max(0.38 + d, 0), 1)
            const exLevel = ex >= 0.50 ? 'HIGH' : ex >= 0.25 ? 'MODERATE' : 'NORMAL'
            return (
              <div key={z.key} style={{
                padding:'10px 12px', borderRadius:8,
                border: `1px solid ${demoZone === z.key ? z.color : '#e2e8f0'}`,
                background: demoZone === z.key ? `${z.color}08` : '#fff',
                transition:'all .2s',
              }}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:18}}>{z.icon}</span>
                  <span style={{fontWeight:700,fontSize:12,color:z.color}}>{z.label}</span>
                  <span style={{marginLeft:'auto',fontSize:11,fontWeight:800,color:z.color,
                    padding:'2px 8px',borderRadius:4,background:`${z.color}18`,border:`1px solid ${z.color}44`}}>
                    δ = +{d.toFixed(2)} (TRANSITION)
                  </span>
                </div>
                <div style={{fontSize:10,color:'#64748b',lineHeight:1.5,marginBottom:4}}>{z.why}</div>
                <div style={{fontSize:9,color:'#94a3b8'}}>
                  Example: base 0.38 + {d.toFixed(2)} = <strong style={{color:z.color}}>{ex.toFixed(2)}</strong>
                  {' '}→ <strong style={{color:z.color}}>{exLevel}</strong>
                  {' | '}The δ is determined by zone + posture in the Context Engine (see <code style={{fontSize:8}}>context_engine.py</code>).
                </div>
              </div>
            )
          })}

          <div style={{padding:'10px 12px',background:'rgba(99,102,241,.06)',border:'1px solid rgba(99,102,241,.2)',borderRadius:8,fontSize:10,color:'#475569',lineHeight:1.6}}>
            <div style={{fontWeight:700,color:'#6366f1',marginBottom:4}}>🔬 What happens at runtime</div>
            <div>1. Every inference window (~100ms), MediaPipe outputs 14 joint positions.</div>
            <div>2. The <strong>hip midpoint</strong> = average of L-hip and R-hip (x, y coordinates, 0–1 normalised).</div>
            <div>3. ContextEngine checks if that point falls inside the BED, CHAIR, or WALKING polygon bounding box.</div>
            <div>4. Matching zone's δ is added to the Late Fusion score before the τ_low / τ_high threshold check.</div>
            <div style={{marginTop:4,color:'#94a3b8'}}>Zone config is stored in <code style={{background:'#e2e8f0',padding:'1px 4px',borderRadius:3}}>rooms.zone_config</code> (Supabase JSONB). Clicking Save pushes it via <code style={{background:'#e2e8f0',padding:'1px 4px',borderRadius:3}}>PUT /api/rooms/&#123;id&#125;/zones</code> and the running inference engine reloads it instantly.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Overview() {
  const [activeTab,       setActiveTab]       = useState(TABS[0]!.id)
  const [replayTarget,    setReplayTarget]    = useState<Alert | null>(null)
  const [summary,         setSummary]         = useState<DashboardSummary | null>(null)
  const [rooms,           setRooms]           = useState<Room[]>([])
  const [patients,        setPatients]        = useState<Patient[]>([])
  const [alerts,          setAlerts]          = useState<Alert[]>([])
  const [caregivers,      setCaregivers]      = useState<Caregiver[]>([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState<string | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [soundOn,         setSoundOn]          = useState(true)

  // ── Audio alerts — HIGH repeats until acknowledged, MODERATE beeps once ──
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const soundOnRef       = useRef(soundOn)
  useEffect(() => { soundOnRef.current = soundOn }, [soundOn])

  const playBeep = useCallback((freq: number, duration = 200) => {
    if (!soundOnRef.current) return
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext
        audioCtxRef.current = new Ctx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') void ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration / 1000 + 0.03)
    } catch { /* autoplay blocked until first user interaction — harmless */ }
  }, [])

  const loadAll = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true)
      setError(null)
      const [sum, rm, pt, al, cgs] = await Promise.all([
        api.getDashboard(), api.getRooms(), api.getPatients(), api.getAlerts(),
        api.getCaregivers(),
      ])
      setSummary(sum)
      // Only replace data if we got non-empty results (avoid blanking on transient timeout)
      if (rm.length > 0) setRooms(rm)
      if (pt.length > 0) setPatients(pt)
      setAlerts(al)
      if (cgs.length > 0) setCaregivers(cgs)
    } catch {
      setError('Cannot reach backend — make sure uvicorn is running on port 8000.')
    } finally { setLoading(false) }
  }, [])

  // Unlock AudioContext on first user interaction (browser autoplay policy)
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext
        audioCtxRef.current = new Ctx()
      }
      if (audioCtxRef.current.state === 'suspended') void audioCtxRef.current.resume()
    }
    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => { void loadAll(true) }, [loadAll])
  useEffect(() => {
    // Background refresh — no spinner, don't blank existing data
    const t = setInterval(() => { void loadAll(false) }, 15_000)
    return () => clearInterval(t)
  }, [loadAll])

  const handleAcknowledge = async (id: number) => {
    await api.acknowledgeAlert(id)
    void loadAll()
  }

  const handleAssignCaregiver = async (roomCode: string, caregiverId: string) => {
    await api.assignCaregiver(roomCode, caregiverId)
    void loadAll()
  }

  const unackedCount = alerts.filter(a => !a.acknowledged).length

  // Alert audio — only fire for alerts created in the last 90 seconds that we haven't seen yet.
  // HIGH: 3 beeps immediately, then repeat every 12s max 2 more times, then stop.
  // MODERATE: 1 beep once. Never beep for old/pre-existing alerts.
  const seenAlertAudioRef = useRef<Set<number>>(new Set())
  const highRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const TWO_MIN = 90_000
    const now = Date.now()
    let newHigh = false
    alerts.forEach(a => {
      if (seenAlertAudioRef.current.has(a.id)) return
      const age = now - new Date(a.timestamp).getTime()
      if (age > TWO_MIN) { seenAlertAudioRef.current.add(a.id); return }  // too old, mark seen but don't beep
      seenAlertAudioRef.current.add(a.id)
      if (a.risk_level === 'HIGH') { newHigh = true }
      else if (a.risk_level === 'MODERATE') { playBeep(660, 240) }
    })
    if (newHigh) {
      if (highRepeatRef.current) clearInterval(highRepeatRef.current)
      // 3 rapid beeps
      playBeep(880, 260)
      setTimeout(() => playBeep(880, 260), 400)
      setTimeout(() => playBeep(880, 260), 800)
      // repeat twice more at 10s intervals then stop
      let count = 0
      highRepeatRef.current = setInterval(() => {
        playBeep(880, 260)
        setTimeout(() => playBeep(880, 260), 300)
        count++
        if (count >= 2 && highRepeatRef.current) { clearInterval(highRepeatRef.current); highRepeatRef.current = null }
      }, 10_000)
    }
    return () => { /* cleanup handled by next effect run */ }
  }, [alerts, playBeep])

  return (
    <div>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>SENTRY · Fall Risk Detection</h1>
          <p className={styles.pageSub}>Automatic fall risk monitoring using camera-based movement tracking</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button
            className={styles.refreshBtn}
            onClick={() => setSoundOn(s => !s)}
            title={soundOn ? 'Mute alert sounds' : 'Unmute alert sounds'}
            style={!soundOn ? {color:'#ef4444', borderColor:'#fecaca', background:'#fef2f2'} : undefined}
          >
            {soundOn ? '🔊 Sound On' : '🔇 Muted'}
          </button>
          <button className={styles.refreshBtn} onClick={() => void loadAll()}>↻ Refresh</button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <Icon name="warning" size={16} /> {error}
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabRow} role="tablist" aria-label="Fall Detection views">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab(tab.id); setSelectedPatient(null) }}
          >
            <Icon name={tab.icon} size={15} />
            <span>{tab.label}</span>
            {tab.id === 'alerts' && unackedCount > 0 && (
              <span className={styles.tabBadge}>{unackedCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className={styles.panel} role="tabpanel">
        {activeTab === 'dashboard' && <DashboardPanel summary={summary} rooms={rooms} patients={patients} alerts={alerts} loading={loading} />}
        {activeTab === 'rooms'     && <RoomsPanel rooms={rooms} caregivers={caregivers} loading={loading} onAssignCaregiver={handleAssignCaregiver} />}
        {activeTab === 'patients'  && !selectedPatient && (
          <PatientsPanel patients={patients} rooms={rooms} alerts={alerts} loading={loading}
            onSelectPatient={p => setSelectedPatient(p)} />
        )}
        {activeTab === 'patients'  && selectedPatient && (
          <PatientDetailPanel patient={selectedPatient} rooms={rooms} alerts={alerts}
            onBack={() => setSelectedPatient(null)} />
        )}
        {activeTab === 'live'      && (
          <LivePanel
            rooms={rooms} patients={patients} alerts={alerts} onBeep={playBeep}
            onReplay={(a) => { setReplayTarget(a); setActiveTab('replay') }}
            onViewPatient={(p) => { setSelectedPatient(p); setActiveTab('patients') }}
          />
        )}
        {activeTab === 'alerts'    && (
          <AlertsPanel
            alerts={alerts} loading={loading} onAcknowledge={handleAcknowledge}
            onReplay={(a) => { setReplayTarget(a); setActiveTab('replay') }}
            rooms={rooms} caregivers={caregivers}
          />
        )}
        {activeTab === 'replay'    && <ReplayPanel alerts={alerts} initialAlert={replayTarget} onAcknowledge={handleAcknowledge} />}
        {activeTab === 'history'   && <HistoryPanel alerts={alerts} loading={loading} patients={patients} rooms={rooms} caregivers={caregivers} />}
        {activeTab === 'analytics' && <AnalyticsPanel summary={summary} alerts={alerts} patients={patients} rooms={rooms} />}
        {activeTab === 'reports'   && <ReportsPanel alerts={alerts} patients={patients} rooms={rooms} />}
        {activeTab === 'users'     && <UsersPanel caregivers={caregivers} rooms={rooms} />}
        {activeTab === 'config'    && <ConfigPanel rooms={rooms} patients={patients} onRefresh={loadAll} alerts={alerts} />}
        {activeTab === 'zoneconfig' && <ZoneConfigPanel rooms={rooms} />}
      </div>
    </div>
  )
}
