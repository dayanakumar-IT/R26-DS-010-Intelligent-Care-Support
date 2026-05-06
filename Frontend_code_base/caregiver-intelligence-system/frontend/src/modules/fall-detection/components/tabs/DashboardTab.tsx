import { useState } from 'react'
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
  const [selected, setSelected]   = useState<Patient | null>(null)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')

  const low      = patients.filter(p => p.riskLevel === 'Low Risk').length
  const mod      = patients.filter(p => p.riskLevel === 'Moderate Risk').length
  const high     = patients.filter(p => p.riskLevel === 'High Risk').length
  const newAlerts = alerts.filter(a => a.status === 'New').length
  const critical  = patients.find(p => p.riskLevel === 'High Risk' && p.status === 'Alert')

  const donut = [
    { label: 'Low Risk',      value: low,  color: '#14B8A6' },
    { label: 'Moderate Risk', value: mod,  color: '#F59E0B' },
    { label: 'High Risk',     value: high, color: '#EF4444' },
  ]

  const filtered   = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()))
  const pageSize   = 5
  const pageCount  = Math.ceil(filtered.length / pageSize)
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)
  const progRisk   = patients.filter(p => p.trendChange > 5).sort((a, b) => b.riskScore - a.riskScore).slice(0, 6)

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
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#EF4444', boxShadow: '0 0 10px #EF4444' }}>
            <div className="w-full h-full rounded-full animate-ping" style={{ background: '#EF4444', opacity: 0.5 }} />
          </div>
          <div className="flex-1">
            <span className="text-xs font-black tracking-wider" style={{ color: '#EF4444' }}>⚠ HIGH RISK ALERT &nbsp;</span>
            <span className="text-sm font-semibold" style={{ color: '#1F2937' }}>{critical.name} ({critical.room} – {critical.bed})</span>
            <span className="text-xs ml-2" style={{ color: '#64748B' }}>Risk increasing rapidly · Score: <b style={{ color: '#EF4444' }}>{critical.riskScore}/100</b></span>
          </div>
          <button onClick={() => setSelected(critical)}
            className="px-3 py-1.5 rounded-lg text-white text-xs font-bold cursor-pointer"
            style={{ background: '#EF4444', border: 'none' }}>View Live</button>
          <button onClick={() => onNavigate('event-replay')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
            style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'transparent', color: '#EF4444' }}>Replay</button>
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
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <div className="px-4 py-3 text-sm font-black" style={{ color: '#1F2937', borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(30,58,138,0.04),transparent)' }}>Room Overview</div>
          <div className="p-4">
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
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: '#F9FAFB' }}>
                    <td className="py-2 font-bold" style={{ color: '#1F2937' }}>{r.name}</td>
                    <td className="py-2" style={{ color: '#64748B' }}>{r.beds}</td>
                    <td className="py-2 font-bold" style={{ color: '#14B8A6' }}>{r.low}</td>
                    <td className="py-2 font-bold" style={{ color: '#F59E0B' }}>{r.mod}</td>
                    <td className="py-2 font-bold" style={{ color: '#EF4444' }}>{r.high}</td>
                    <td className="py-2"><span className="px-1.5 py-0.5 rounded text-[10px] font-black" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>{r.alerts}</span></td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid #E5E7EB' }}>
                  <td className="pt-2 text-[10px] font-black uppercase" style={{ color: '#1F2937' }}>Total</td>
                  <td className="pt-2 font-bold" style={{ color: '#1F2937' }}>{patients.length}</td>
                  <td className="pt-2 font-bold" style={{ color: '#14B8A6' }}>{low}</td>
                  <td className="pt-2 font-bold" style={{ color: '#F59E0B' }}>{mod}</td>
                  <td className="pt-2 font-bold" style={{ color: '#EF4444' }}>{high}</td>
                  <td className="pt-2 font-bold" style={{ color: '#EF4444' }}>{newAlerts}</td>
                </tr>
              </tbody>
            </table>
            <button onClick={() => onNavigate('room-overview')} className="mt-3 w-full py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors hover:bg-slate-50" style={{ border: '1px solid #E5E7EB', background: 'transparent', color: '#64748B' }}>
              View all rooms →
            </button>
          </div>
        </div>

        {/* Risk distribution donut */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(20,184,166,0.04),transparent)' }}>
            <div className="text-sm font-black" style={{ color: '#1F2937' }}>Risk Distribution</div>
            <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>All Patients · Live</div>
          </div>
          <div className="p-4 flex flex-col items-center gap-3">
            <DonutChart segments={donut} size={160} thickness={30} centerLabel={String(patients.length)} centerSub="Total" />
            <div className="w-full flex flex-col gap-1.5">
              {donut.map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 text-xs" style={{ color: '#64748B' }}>{s.label}</span>
                  <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
                  <span className="text-xs" style={{ color: '#94A3B8' }}>({((s.value / patients.length) * 100).toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent high-risk alerts */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(239,68,68,0.04),transparent)' }}>
            <div className="text-sm font-black" style={{ color: '#1F2937' }}>Recent High Risk Alerts</div>
            <button onClick={() => onNavigate('alerts-risk')} className="text-xs font-bold cursor-pointer" style={{ background: 'none', border: 'none', color: '#2563EB' }}>View all</button>
          </div>
          <div>
            {alerts.filter(a => a.riskLevel === 'High Risk').slice(0, 5).map(a => (
              <div key={a.id} className="flex items-start gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                style={{ borderBottom: '1px solid #F9FAFB' }}
                onClick={() => setSelected(patients.find(p => p.id === a.patientId) ?? null)}>
                <span className="text-sm mt-0.5 shrink-0">🚨</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate" style={{ color: '#1F2937' }}>{a.patientName} ({a.room} – {a.bed})</div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{a.description}</div>
                </div>
                <div className="text-[10px] whitespace-nowrap" style={{ color: '#94A3B8' }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Progressive Risk Indicator ─────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(37,99,235,0.04),transparent)' }}>
          <span className="text-sm font-black" style={{ color: '#1F2937' }}>Progressive Risk Indicator </span>
          <span className="text-xs font-normal" style={{ color: '#94A3B8' }}>(Last 30s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Patient', 'Risk Level', 'Risk Score', 'Δ Change', '30s Trend'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {progRisk.map(p => (
                <tr key={p.id} className="cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ borderBottom: '1px solid #F9FAFB' }}
                  onClick={() => setSelected(p)}>
                  <td className="px-4 py-2.5 font-bold" style={{ color: '#1F2937' }}>{p.name} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({p.id})</span></td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: riskBg(p.riskLevel), color: riskColor(p.riskLevel) }}>{p.riskLevel}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm font-black" style={{ color: scoreColor(p.riskScore) }}>{p.riskScore}/100</td>
                  <td className="px-4 py-2.5 font-bold text-sm" style={{ color: p.trendChange > 0 ? '#EF4444' : '#14B8A6' }}>
                    {p.trendChange > 0 ? '▲' : '▼'} {Math.abs(p.trendChange)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Sparkline data={p.trend} color={riskColor(p.riskLevel)} width={90} height={26} filled />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Current Patient Status ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,rgba(30,58,138,0.04),transparent)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black" style={{ color: '#1F2937' }}>Current Patient Status</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(20,184,166,0.1)', color: '#14B8A6' }}>● Live</span>
          </div>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search Patient ID / Name"
            className="text-xs px-3 py-1.5 rounded-lg outline-none"
            style={{ border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#1F2937', width: 200 }} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 860 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Patient ID', 'Name', 'Room', 'Bed', 'Risk Level', 'Score', 'Status', 'Last Updated', 'Trend (30s)', 'Action'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#94A3B8', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(p => (
                <tr key={p.id} className="cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ borderBottom: '1px solid #F9FAFB' }}
                  onClick={() => setSelected(p)}>
                  <td className="px-3 py-2.5 font-black text-xs" style={{ color: '#1E3A8A' }}>{p.id}</td>
                  <td className="px-3 py-2.5 font-semibold" style={{ color: '#1F2937' }}>{p.name}</td>
                  <td className="px-3 py-2.5" style={{ color: '#64748B' }}>{p.room}</td>
                  <td className="px-3 py-2.5" style={{ color: '#64748B' }}>{p.bed}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: riskBg(p.riskLevel), color: riskColor(p.riskLevel) }}>{p.riskLevel}</span>
                  </td>
                  <td className="px-3 py-2.5 text-sm font-black" style={{ color: scoreColor(p.riskScore) }}>{p.riskScore}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot(p.status) }} />
                      <span className="text-xs font-semibold" style={{ color: statusDot(p.status) }}>{p.status}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[11px]" style={{ color: '#94A3B8' }}>{p.lastUpdated}</td>
                  <td className="px-3 py-2.5">
                    <Sparkline data={p.trend} color={riskColor(p.riskLevel)} width={72} height={22} />
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={e => { e.stopPropagation(); setSelected(p) }}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors hover:bg-blue-50"
                      style={{ border: '1px solid #E5E7EB', background: 'transparent', color: '#2563EB' }}>👁 View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid #F3F4F6' }}>
          <span className="text-xs" style={{ color: '#94A3B8' }}>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} patients
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
  return (
    <div className="bg-white rounded-2xl px-4 py-3 relative overflow-hidden" style={{ border: '1px solid #E5E7EB', borderTop: `3px solid ${color}` }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{label}</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-3xl font-black leading-none" style={{ color }}>{value}</span>
            {pulse && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />}
          </div>
          <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>{sub}</div>
        </div>
        <span className="text-2xl opacity-60">{icon}</span>
      </div>
    </div>
  )
}
