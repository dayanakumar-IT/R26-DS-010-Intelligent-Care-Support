import { useState, useEffect, useRef } from 'react'
import type { FallTab, Patient } from '../../types'
import { useFallStore } from '../../store/useFallStore'
import { DonutChart, Sparkline, MiniArea } from '../Charts'
import { PatientDetailPanel } from '../PatientDetailPanel'

// ── Palette helpers ─────────────────────────────────────────────────────────
const riskColor = (l: string) => l === 'High Risk' ? '#EF4444' : l === 'Moderate Risk' ? '#F59E0B' : '#14B8A6'
const riskBg    = (l: string) => l === 'High Risk' ? 'rgba(239,68,68,0.08)' : l === 'Moderate Risk' ? 'rgba(245,158,11,0.08)' : 'rgba(20,184,166,0.08)'
const scoreColor = (s: number) => s >= 71 ? '#EF4444' : s >= 41 ? '#F59E0B' : '#14B8A6'
const statusDot  = (s: string) => s === 'Alert' ? '#EF4444' : s === 'Monitoring' ? '#F59E0B' : s === 'Recovery' ? '#2563EB' : '#14B8A6'

interface Props { onNavigate: (tab: FallTab) => void }

export function DashboardTab({ onNavigate }: Props) {
  const { patients, alerts } = useFallStore()
  const [selected, setSelected]     = useState<Patient | null>(null)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [alertIdx, setAlertIdx]     = useState(0)
  const [recentAlertIdx, setRecentAlertIdx] = useState(0)
  const [secsSinceUpdate, setSecsSinceUpdate] = useState(0)
  const [progPage, setProgPage]     = useState(1)   // user-controlled page
  const [progSecs, setProgSecs]     = useState(0)   // live countdown tick

  const low       = patients.filter(p => p.riskLevel === 'Low Risk').length
  const mod       = patients.filter(p => p.riskLevel === 'Moderate Risk').length
  const high      = patients.filter(p => p.riskLevel === 'High Risk').length
  const newAlerts = alerts.filter(a => a.status === 'New').length

  const criticalAlerts  = alerts.filter(a => a.riskLevel === 'High Risk' && a.status === 'New')
  const critical        = criticalAlerts.length > 0 ? criticalAlerts[alertIdx % criticalAlerts.length] : null
  const criticalPatient = critical ? (patients.find(p => p.id === critical.patientId) ?? null) : null

  useEffect(() => {
    if (criticalAlerts.length <= 1) return
    const t = setInterval(() => setAlertIdx(i => i + 1), 4000)
    return () => clearInterval(t)
  }, [criticalAlerts.length])

  const highAlerts = alerts.filter(a => a.riskLevel === 'High Risk')
  // Always cycle recent alerts every 4s (regardless of pool size)
  useEffect(() => {
    const t = setInterval(() => setRecentAlertIdx(i => i + 1), 4000)
    return () => clearInterval(t)
  }, [])

  // Seconds-since-update ticker for Risk Distribution "live" label
  useEffect(() => {
    setSecsSinceUpdate(0)
    const t = setInterval(() => setSecsSinceUpdate(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [low, mod, high])

  // Progressive Risk Indicator — countdown ticker + auto page-advance every 30s
  const ROTATION_SECS = 30
  useEffect(() => {
    const t = setInterval(() => setProgSecs(s => (s + 1) % ROTATION_SECS), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (progSecs === 0) setProgPage(p => p + 1)
  }, [progSecs])

  const donut = [
    { label: 'Low Risk',      value: low,  color: '#14B8A6' },
    { label: 'Moderate Risk', value: mod,  color: '#F59E0B' },
    { label: 'High Risk',     value: high, color: '#EF4444' },
  ]

  const pageSize   = 5
  const pageCount  = Math.ceil(patients.length / pageSize)
  const paginated  = patients.slice((page - 1) * pageSize, page * pageSize)

  // Progressive Risk — all patients sorted by score, user-paginated in groups of 6
  const PROG_SIZE   = 6
  const sortedPool  = [...patients].sort((a, b) => b.riskScore - a.riskScore)
  const totalGroups = Math.max(1, Math.ceil(sortedPool.length / PROG_SIZE))
  const safeProgPage  = ((progPage - 1) % totalGroups) + 1   // wraps 1..totalGroups
  const progRisk    = sortedPool.slice((safeProgPage - 1) * PROG_SIZE, safeProgPage * PROG_SIZE)
  const progCountdown = ROTATION_SECS - progSecs

  const ROOMS = [
    { name: 'Room 01', beds: 12, low: patients.filter(p => p.roomId === 'R01' && p.riskLevel === 'Low Risk').length, mod: patients.filter(p => p.roomId === 'R01' && p.riskLevel === 'Moderate Risk').length, high: patients.filter(p => p.roomId === 'R01' && p.riskLevel === 'High Risk').length, alerts: patients.filter(p => p.roomId === 'R01' && p.status === 'Alert').length },
    { name: 'Room 02', beds: 12, low: patients.filter(p => p.roomId === 'R02' && p.riskLevel === 'Low Risk').length, mod: patients.filter(p => p.roomId === 'R02' && p.riskLevel === 'Moderate Risk').length, high: patients.filter(p => p.roomId === 'R02' && p.riskLevel === 'High Risk').length, alerts: patients.filter(p => p.roomId === 'R02' && p.status === 'Alert').length },
  ]

  return (
    <div className="flex flex-col gap-4">

      {/* ── High-risk alert banner ─────────────────────────────────── */}
      {critical && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.25)' }}>
          <div className="w-2.5 h-2.5 rounded-full shrink-0 relative" style={{ background: '#EF4444', boxShadow: '0 0 10px #EF4444' }}>
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: '#EF4444', opacity: 0.5 }} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-black tracking-wider" style={{ color: '#EF4444' }}>⚠ HIGH RISK ALERT &nbsp;</span>
            <span className="text-sm font-semibold" style={{ color: '#1F2937' }}>{critical.patientName} ({critical.room} – {critical.bed})</span>
            <span className="text-xs ml-2" style={{ color: '#64748B' }}>
              · {critical.description}
              {criticalPatient && <> · Score: <b style={{ color: '#EF4444' }}>{criticalPatient.riskScore}/100</b></>}
            </span>
          </div>
          {criticalAlerts.length > 1 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
              {(alertIdx % criticalAlerts.length) + 1} / {criticalAlerts.length}
            </span>
          )}
          <button onClick={() => criticalPatient && setSelected(criticalPatient)}
            className="px-3 py-1.5 rounded-lg text-white text-xs font-bold cursor-pointer shrink-0"
            style={{ background: '#EF4444', border: 'none' }}>● View Live</button>
          <button onClick={() => onNavigate('event-replay')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0"
            style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'transparent', color: '#EF4444' }}>⇽ Replay</button>
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <StatCard label="Total Patients"  value={patients.length}  sub={`Across 2 Rooms`}         color="#1E3A8A" icon="👥" />
        <StatCard label="Low Risk"        value={low}              sub={`${((low/patients.length)*100).toFixed(1)}% of total`}  color="#14B8A6" icon="✅" />
        <StatCard label="Moderate Risk"   value={mod}              sub={`${((mod/patients.length)*100).toFixed(1)}% of total`}  color="#F59E0B" icon="⚠️" />
        <StatCard label="High Risk"       value={high}             sub={`${((high/patients.length)*100).toFixed(1)}% of total`} color="#EF4444" icon="🚨" />
        <StatCard label="Active Alerts"   value={newAlerts}        sub="Requires attention"        color="#2563EB" icon="🔔" pulse />
      </div>

      {/* ── Middle: Room / Donut / Alerts ─────────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>

        {/* Room overview */}
        <div className="bg-white rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid #E5E7EB' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(30,58,138,0.04),transparent)' }}>
            <div className="text-sm font-black" style={{ color: '#1F2937' }}>Room Overview</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: '#14B8A6' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#14B8A6' }} /> LIVE
            </div>
          </div>
          <div className="p-4 flex flex-col flex-1 gap-3">
            {/* Compact risk table */}
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {['Room','Beds','Low','Mod','High','Alerts'].map(h => (
                    <th key={h} className="pb-2 text-left font-bold tracking-wider text-[10px] uppercase" style={{ color: '#94A3B8', borderBottom: '1px solid #F3F4F6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROOMS.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td className="py-1.5 font-bold" style={{ color: '#1F2937' }}>{r.name}</td>
                    <td className="py-1.5" style={{ color: '#64748B' }}>{r.beds}</td>
                    <td className="py-1.5 font-bold" style={{ color: '#14B8A6' }}>{r.low}</td>
                    <td className="py-1.5 font-bold" style={{ color: '#F59E0B' }}>{r.mod}</td>
                    <td className="py-1.5 font-bold" style={{ color: '#EF4444' }}>{r.high}</td>
                    <td className="py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-black" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>{r.alerts}</span></td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid #E5E7EB' }}>
                  <td className="pt-1.5 text-[10px] font-black uppercase" style={{ color: '#1F2937' }}>Total</td>
                  <td className="pt-1.5 font-bold" style={{ color: '#1F2937' }}>{patients.length}</td>
                  <td className="pt-1.5 font-bold" style={{ color: '#14B8A6' }}>{low}</td>
                  <td className="pt-1.5 font-bold" style={{ color: '#F59E0B' }}>{mod}</td>
                  <td className="pt-1.5 font-bold" style={{ color: '#EF4444' }}>{high}</td>
                  <td className="pt-1.5 font-bold" style={{ color: '#EF4444' }}>{newAlerts}</td>
                </tr>
              </tbody>
            </table>

            {/* Occupancy bars */}
            <div className="pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: '#94A3B8' }}>Bed Occupancy</div>
              {ROOMS.map((r, i) => {
                const occupied = r.low + r.mod + r.high
                const pct = Math.round((occupied / r.beds) * 100)
                const highPct = Math.round((r.high / r.beds) * 100)
                const modPct  = Math.round((r.mod  / r.beds) * 100)
                const lowPct  = Math.round((r.low  / r.beds) * 100)
                return (
                  <div key={i} className="mb-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold" style={{ color: '#374151' }}>{r.name}</span>
                      <span className="text-[11px] font-bold" style={{ color: '#1E3A8A' }}>{occupied}/{r.beds} &nbsp;<span style={{ color: '#94A3B8', fontWeight: 400 }}>({pct}%)</span></span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: '#F3F4F6' }}>
                      <div style={{ width: `${highPct}%`, background: '#EF4444', transition: 'width 0.6s ease' }} />
                      <div style={{ width: `${modPct}%`,  background: '#F59E0B', transition: 'width 0.6s ease' }} />
                      <div style={{ width: `${lowPct}%`,  background: '#14B8A6', transition: 'width 0.6s ease' }} />
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px]" style={{ color: '#EF4444' }}>H:{r.high}</span>
                      <span className="text-[10px]" style={{ color: '#F59E0B' }}>M:{r.mod}</span>
                      <span className="text-[10px]" style={{ color: '#14B8A6' }}>L:{r.low}</span>
                      <span className="ml-auto text-[10px]" style={{ color: '#94A3B8' }}>{r.beds - occupied} free</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Alert intensity */}
            <div className="rounded-xl p-3 mt-auto" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: '#374151' }}>Active Alert Load</span>
                <span className="text-lg font-black" style={{ color: '#EF4444' }}>{newAlerts}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: '#F3F4F6' }}>
                <div style={{ width: `${Math.min((newAlerts / patients.length) * 100, 100)}%`, background: 'linear-gradient(90deg,#F59E0B,#EF4444)', borderRadius: 999, transition: 'width 0.6s ease', height: '100%' }} />
              </div>
            </div>

            <button onClick={() => onNavigate('room-overview')} className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer hover:bg-slate-50 transition-colors" style={{ border: '1px solid #E5E7EB', background: 'transparent', color: '#64748B' }}>
              View all rooms →
            </button>
          </div>
        </div>

        {/* Risk distribution donut */}
        <div className="bg-white rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid #E5E7EB' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(20,184,166,0.04),transparent)' }}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-black" style={{ color: '#1F2937' }}>Risk Distribution</div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: '#14B8A6' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#14B8A6' }} /> LIVE
              </div>
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
              All Patients · Updated {secsSinceUpdate === 0 ? 'just now' : `${secsSinceUpdate}s ago`}
            </div>
          </div>
          <div className="p-4 flex flex-col items-center gap-3 flex-1">
            <DonutChart key={`${low}-${mod}-${high}`} segments={donut} size={160} thickness={30} centerLabel={String(patients.length)} centerSub="Total" />
            <div className="w-full flex flex-col gap-2">
              {donut.map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 text-xs" style={{ color: '#64748B' }}>{s.label}</span>
                  <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
                  <span className="text-xs" style={{ color: '#94A3B8' }}>({patients.length > 0 ? ((s.value / patients.length) * 100).toFixed(1) : '0.0'}%)</span>
                </div>
              ))}
            </div>
            {/* Mini trend indicators */}
            <div className="w-full grid grid-cols-3 gap-2 pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
              {donut.map(s => (
                <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: `${s.color}0d`, border: `1px solid ${s.color}22` }}>
                  <div className="text-lg font-black leading-none" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px] mt-0.5 font-semibold" style={{ color: s.color }}>{s.label.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent high-risk alerts */}
        <div className="bg-white rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid #E5E7EB' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(239,68,68,0.04),transparent)' }}>
            <div>
              <div className="text-sm font-black" style={{ color: '#1F2937' }}>Recent High Risk Alerts</div>
              <div className="text-[10px] mt-0.5 font-medium" style={{ color: '#94A3B8' }}>
                {highAlerts.length} total · cycling every 4s
              </div>
            </div>
            <button onClick={() => onNavigate('alerts-risk')} className="text-xs font-bold cursor-pointer" style={{ background: 'none', border: 'none', color: '#2563EB' }}>View all</button>
          </div>
          <div className="flex-1">
            {highAlerts.length > 0 && Array.from({ length: Math.min(5, highAlerts.length) }, (_, i) =>
              highAlerts[(recentAlertIdx + i) % highAlerts.length]
            ).map((a, i) => {
              const isNewest = i === 0
              return (
                <div key={`${a.id}-${i}`}
                  className="flex items-start gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ borderBottom: '1px solid #F9FAFB', background: isNewest ? 'rgba(239,68,68,0.03)' : undefined }}
                  onClick={() => setSelected(patients.find(p => p.id === a.patientId) ?? null)}>
                  <span className="text-sm mt-0.5 shrink-0">🚨</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate" style={{ color: '#1F2937' }}>{a.patientName} ({a.room} – {a.bed})</span>
                      {a.status === 'New' && (
                        <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: '#EF4444', color: 'white' }}>NEW</span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{a.description}</div>
                  </div>
                  <div className="text-[10px] whitespace-nowrap shrink-0" style={{ color: '#94A3B8' }}>{a.time}</div>
                </div>
              )
            })}
            {highAlerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-2xl">✅</span>
                <span className="text-xs font-semibold" style={{ color: '#94A3B8' }}>No high risk alerts</span>
              </div>
            )}
          </div>
          {highAlerts.length > 0 && (
            <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(highAlerts.length, 8) }, (_, i) => (
                  <div key={i} className="rounded-full transition-all"
                    style={{ width: i === recentAlertIdx % highAlerts.length ? 16 : 6, height: 6, background: i === recentAlertIdx % highAlerts.length ? '#EF4444' : '#E5E7EB' }} />
                ))}
              </div>
              <span className="text-[10px]" style={{ color: '#94A3B8' }}>Auto-cycling</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Progressive Risk Indicator ─────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(37,99,235,0.04),transparent)' }}>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-sm font-black" style={{ color: '#1F2937' }}>Progressive Risk Indicator</span>
              <span className="text-xs font-normal ml-2" style={{ color: '#94A3B8' }}>
                Group {safeProgPage} of {totalGroups} · {sortedPool.length} patients monitored
              </span>
            </div>
            {/* Clickable page dots */}
            <div className="flex gap-1.5">
              {Array.from({ length: totalGroups }, (_, i) => (
                <button key={i} onClick={() => setProgPage(i + 1)}
                  className="rounded-full transition-all cursor-pointer"
                  style={{ width: i + 1 === safeProgPage ? 16 : 6, height: 6, background: i + 1 === safeProgPage ? '#2563EB' : '#D1D5DB', border: 'none', padding: 0 }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Countdown ring */}
            <div className="flex items-center gap-1.5">
              <svg width="22" height="22" viewBox="0 0 22 22">
                <circle cx="11" cy="11" r="9" fill="none" stroke="#E5E7EB" strokeWidth="2.5" />
                <circle cx="11" cy="11" r="9" fill="none" stroke="#2563EB" strokeWidth="2.5"
                  strokeDasharray={`${(progCountdown / ROTATION_SECS) * 56.5} 56.5`}
                  strokeLinecap="round" transform="rotate(-90 11 11)" />
              </svg>
              <span className="text-[11px] font-black tabular-nums" style={{ color: '#2563EB' }}>
                {progCountdown}s
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: '#EF4444' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#EF4444' }} /> LIVE
            </div>
          </div>
        </div>
        <div className="p-3 grid gap-2">
          {progRisk.map(p => {
            const rc = riskColor(p.riskLevel)
            const rising = p.trendChange > 0
            return (
              <div key={p.id}
                className="flex items-center gap-4 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                style={{ border: `1px solid ${rc}20`, borderLeft: `3px solid ${rc}`, background: `${rc}08` }}
                onClick={() => setSelected(p)}>

                {/* Patient */}
                <div style={{ minWidth: 155 }}>
                  <div className="text-[13px] font-black leading-tight" style={{ color: '#111827' }}>{p.name}</div>
                  <div className="text-[10px] mt-0.5 font-medium" style={{ color: '#9CA3AF' }}>{p.id} · {p.room} · {p.bed}</div>
                </div>

                {/* Risk badge */}
                <div style={{ minWidth: 110 }}>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                    style={{ background: `${rc}15`, color: rc, border: `1px solid ${rc}30` }}>
                    <span>{p.riskLevel === 'High Risk' ? '●' : p.riskLevel === 'Moderate Risk' ? '◉' : '○'}</span>
                    {p.riskLevel}
                  </span>
                </div>

                {/* Score + bar */}
                <div className="flex-1" style={{ minWidth: 150 }}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[10px] font-semibold" style={{ color: '#94A3B8' }}>Risk Score</span>
                    <span className="text-base font-black leading-none" style={{ color: rc }}>{p.riskScore}<span className="text-[10px] font-semibold" style={{ color: '#94A3B8' }}>/100</span></span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                    <div style={{
                      width: `${p.riskScore}%`, height: '100%', borderRadius: 999, transition: 'width 0.6s ease',
                      background: p.riskScore >= 71 ? 'linear-gradient(90deg,#F59E0B,#EF4444)' : p.riskScore >= 41 ? 'linear-gradient(90deg,#14B8A6,#F59E0B)' : '#14B8A6',
                    }} />
                  </div>
                </div>

                {/* Delta */}
                <div className="flex flex-col items-center" style={{ minWidth: 62 }}>
                  <div className="text-[9px] font-semibold mb-1" style={{ color: '#94A3B8' }}>Δ CHANGE</div>
                  <div className="px-2 py-0.5 rounded-lg text-sm font-black"
                    style={{ background: rising ? 'rgba(239,68,68,0.1)' : 'rgba(20,184,166,0.1)', color: rising ? '#EF4444' : '#14B8A6' }}>
                    {rising ? '▲' : '▼'} {Math.abs(p.trendChange)}
                  </div>
                </div>

                {/* Trend */}
                <div className="flex flex-col" style={{ minWidth: 96 }}>
                  <div className="text-[9px] font-semibold mb-1" style={{ color: '#94A3B8' }}>30s TREND</div>
                  <Sparkline data={p.trend} color={rc} width={96} height={30} filled />
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
          <span className="text-xs" style={{ color: '#94A3B8' }}>
            Showing patients {(safeProgPage - 1) * PROG_SIZE + 1}–{Math.min(safeProgPage * PROG_SIZE, sortedPool.length)} of {sortedPool.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setProgPage(p => Math.max(1, p - 1))}
              disabled={safeProgPage === 1}
              className="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              style={{ border: '1px solid #E5E7EB', background: 'white', color: safeProgPage === 1 ? '#D1D5DB' : '#374151' }}>
              ← Prev
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalGroups }, (_, i) => (
                <button key={i} onClick={() => setProgPage(i + 1)}
                  className="w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                  style={{ border: '1px solid', borderColor: i + 1 === safeProgPage ? '#2563EB' : '#E5E7EB', background: i + 1 === safeProgPage ? '#2563EB' : 'white', color: i + 1 === safeProgPage ? 'white' : '#64748B' }}>
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setProgPage(p => Math.min(totalGroups, p + 1))}
              disabled={safeProgPage === totalGroups}
              className="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              style={{ border: '1px solid #E5E7EB', background: 'white', color: safeProgPage === totalGroups ? '#D1D5DB' : '#374151' }}>
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ── Current Patient Status ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(30,58,138,0.04),transparent)' }}>
          <span className="text-sm font-black" style={{ color: '#1F2937' }}>Current Patient Status</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" style={{ background: 'rgba(20,184,166,0.1)', color: '#14B8A6' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: '#14B8A6' }} /> Live
          </span>
          <span className="text-xs ml-auto" style={{ color: '#94A3B8' }}>Showing {paginated.length} of {patients.length} patients · updates every 2.5s</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 800 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Patient ID', 'Name', 'Room', 'Bed', 'Posture', 'Risk Level', 'Score', 'Alert', 'Last Updated', 'Trend (30s)', 'Action'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#94A3B8', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(p => {
                const rc  = riskColor(p.riskLevel)
                const isAlert = p.status === 'Alert'
                return (
                  <tr key={p.id}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid #F9FAFB', background: isAlert ? 'rgba(239,68,68,0.025)' : undefined }}
                    onMouseEnter={e => (e.currentTarget.style.background = isAlert ? 'rgba(239,68,68,0.05)' : '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = isAlert ? 'rgba(239,68,68,0.025)' : 'transparent')}
                    onClick={() => setSelected(p)}>
                    <td className="px-3 py-2.5 font-black text-xs" style={{ color: '#1E3A8A' }}>{p.id}</td>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: '#1F2937' }}>{p.name}</td>
                    <td className="px-3 py-2.5" style={{ color: '#64748B' }}>{p.room}</td>
                    <td className="px-3 py-2.5" style={{ color: '#64748B' }}>{p.bed}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        background: p.posture === 'Walking' ? 'rgba(124,58,237,0.08)' : p.posture === 'Standing' ? 'rgba(37,99,235,0.08)' : p.posture === 'Sitting' ? 'rgba(245,158,11,0.08)' : 'rgba(20,184,166,0.08)',
                        color: p.posture === 'Walking' ? '#7C3AED' : p.posture === 'Standing' ? '#2563EB' : p.posture === 'Sitting' ? '#F59E0B' : '#14B8A6',
                      }}>
                        {p.posture === 'Walking' ? '🚶' : p.posture === 'Standing' ? '🧍' : p.posture === 'Sitting' ? '🪑' : '🛏'} {p.posture}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: riskBg(p.riskLevel), color: rc }}>{p.riskLevel}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black" style={{ color: scoreColor(p.riskScore) }}>{p.riskScore}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6', minWidth: 36 }}>
                          <div style={{ width: `${p.riskScore}%`, height: '100%', borderRadius: 999, background: rc, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {isAlert ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#EF4444' }} />
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>ALERT</span>
                        </div>
                      ) : p.status === 'Monitoring' ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />
                          <span className="text-[10px] font-semibold" style={{ color: '#F59E0B' }}>Watching</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#14B8A6' }} />
                          <span className="text-[10px] font-semibold" style={{ color: '#14B8A6' }}>Stable</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[11px]" style={{ color: '#94A3B8' }}>{p.lastUpdated}</td>
                    <td className="px-3 py-2.5">
                      <Sparkline data={p.trend} color={rc} width={72} height={22} />
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={e => { e.stopPropagation(); setSelected(p) }}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer"
                        style={{ border: '1px solid #E5E7EB', background: 'transparent', color: '#2563EB' }}>👁 View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid #F3F4F6' }}>
          <span className="text-xs" style={{ color: '#94A3B8' }}>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, patients.length)} of {patients.length} patients
          </span>
          <div className="flex gap-1.5">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className="w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                style={{ border: '1px solid', borderColor: page === n ? '#1E3A8A' : '#E5E7EB', background: page === n ? '#1E3A8A' : 'transparent', color: page === n ? 'white' : '#64748B' }}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <PatientDetailPanel patient={selected} onClose={() => setSelected(null)} onViewLive={p => setSelected(p)} />
      )}
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, pulse }: { label: string; value: number; sub: string; color: string; icon: string; pulse?: boolean }) {
  const [flash, setFlash]   = useState(false)
  const [delta, setDelta]   = useState(0)
  const prevRef             = useRef(value)

  useEffect(() => {
    if (prevRef.current === value) return
    const d = value - prevRef.current
    prevRef.current = value
    setDelta(d)
    setFlash(true)
    const t = setTimeout(() => { setFlash(false); setDelta(0) }, 1100)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div className="bg-white rounded-2xl px-4 py-3 relative overflow-hidden"
      style={{
        borderTop: `3px solid ${color}`,
        border: `1px solid ${flash ? color + '80' : '#E5E7EB'}`,
        boxShadow: flash ? `0 0 0 3px ${color}18, 0 2px 8px ${color}14` : undefined,
        transition: 'border-color 0.35s, box-shadow 0.35s',
      }}>
      {/* Flash overlay */}
      {flash && (
        <div className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ background: `${color}0b` }} />
      )}
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{label}</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-3xl font-black leading-none"
              style={{ color, display: 'inline-block', transform: flash ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.3s ease' }}>
              {value}
            </span>
            {delta !== 0 && flash && (
              <span className="text-xs font-black"
                style={{ color: delta > 0 ? '#EF4444' : '#14B8A6' }}>
                {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
              </span>
            )}
            {pulse && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />}
          </div>
          <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>{sub}</div>
        </div>
        <span className="text-2xl" style={{ opacity: flash ? 1 : 0.55, transition: 'opacity 0.3s' }}>{icon}</span>
      </div>
    </div>
  )
}
