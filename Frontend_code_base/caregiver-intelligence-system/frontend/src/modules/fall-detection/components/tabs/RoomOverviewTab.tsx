import { useState } from 'react'
import type { Patient } from '../../types'
import { ROOMS } from '../../data/mockData'
import { useFallStore } from '../../store/useFallStore'
import { DonutChart } from '../Charts'
import { PatientDetailPanel } from '../PatientDetailPanel'

const riskColor  = (l: string) => l === 'High Risk' ? '#EF4444' : l === 'Moderate Risk' ? '#F59E0B' : '#14B8A6'
const riskBg     = (l: string) => l === 'High Risk' ? 'rgba(239,68,68,0.08)' : l === 'Moderate Risk' ? 'rgba(245,158,11,0.08)' : 'rgba(20,184,166,0.08)'
const scoreColor = (s: number) => s >= 71 ? '#EF4444' : s >= 41 ? '#F59E0B' : '#14B8A6'
const statusDot  = (s: string) => s === 'Alert' ? '#EF4444' : s === 'Monitoring' ? '#F59E0B' : s === 'Recovery' ? '#2563EB' : '#14B8A6'

export function RoomOverviewTab() {
  const { patients } = useFallStore()
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedRoom, setSelectedRoom]       = useState<string | null>(null)

  const totalLow  = patients.filter(p => p.riskLevel === 'Low Risk').length
  const totalMod  = patients.filter(p => p.riskLevel === 'Moderate Risk').length
  const totalHigh = patients.filter(p => p.riskLevel === 'High Risk').length

  const totalBeds     = ROOMS.reduce((acc, r) => acc + r.totalBeds, 0)
  const totalAlerts   = ROOMS.reduce((acc, r) => acc + r.alerts, 0)
  const occupancyRate = totalBeds > 0 ? Math.round((patients.length / totalBeds) * 100) : 0

  const allSegments = [
    { label: 'Low Risk',      value: totalLow,  color: '#14B8A6' },
    { label: 'Moderate Risk', value: totalMod,  color: '#F59E0B' },
    { label: 'High Risk',     value: totalHigh, color: '#EF4444' },
  ]
  const highRiskPatients = patients.filter(p => p.riskLevel === 'High Risk')
  const displayPatients  = selectedRoom ? patients.filter(p => p.roomId === selectedRoom) : patients

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Summary Stats Bar ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          {
            label: 'Total Patients', value: patients.length,
            sub: `across ${ROOMS.length} rooms`,
            color: '#2563EB', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            ),
          },
          {
            label: 'Bed Occupancy', value: `${occupancyRate}%`,
            sub: `${patients.length} of ${totalBeds} beds`,
            color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.18)',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            ),
          },
          {
            label: 'Active Alerts', value: totalAlerts,
            sub: totalAlerts > 0 ? 'require attention' : 'all clear',
            color: totalAlerts > 0 ? '#EF4444' : '#14B8A6',
            bg:    totalAlerts > 0 ? 'rgba(239,68,68,0.08)'  : 'rgba(20,184,166,0.08)',
            border: totalAlerts > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(20,184,166,0.18)',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={totalAlerts > 0 ? '#EF4444' : '#14B8A6'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            ),
          },
          {
            label: 'High Risk', value: totalHigh,
            sub: totalHigh > 0 ? 'immediate review needed' : 'no high risk patients',
            color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            ),
          },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'white', border: `1.5px solid ${stat.border}`,
            borderRadius: 14, padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              width: 50, height: 50, borderRadius: 13, background: stat.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 2 }}>{stat.label}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Top: Room Cards + Right Panel ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 16, alignItems: 'stretch' }}>

        {/* Room Cards */}
        {ROOMS.map(room => {
          const roomPatients = patients.filter(p => p.roomId === room.id)
          const liveLow   = roomPatients.filter(p => p.riskLevel === 'Low Risk').length
          const liveMod   = roomPatients.filter(p => p.riskLevel === 'Moderate Risk').length
          const liveHigh  = roomPatients.filter(p => p.riskLevel === 'High Risk').length
          const occupied  = liveLow + liveMod + liveHigh
          const total     = room.totalBeds
          const isSelected = selectedRoom === room.id

          const highPct = total > 0 ? Math.round((liveHigh / total) * 100) : 0
          const modPct  = total > 0 ? Math.round((liveMod  / total) * 100) : 0
          const lowPct  = total > 0 ? Math.round((liveLow  / total) * 100) : 0

          return (
            <div key={room.id}
              onClick={() => setSelectedRoom(isSelected ? null : room.id)}
              style={{
                background: 'white',
                border: `1.5px solid ${isSelected ? '#2563EB' : '#E5E7EB'}`,
                borderTop: `4px solid ${isSelected ? '#2563EB' : '#1E3A8A'}`,
                borderRadius: 16,
                padding: 20,
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.1)' : '0 1px 4px rgba(0,0,0,0.05)',
              }}>

              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#111827' }}>{room.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                    {total} Beds &nbsp;·&nbsp; {occupied} Occupied
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: room.alerts > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(20,184,166,0.1)',
                  color:      room.alerts > 0 ? '#EF4444'             : '#14B8A6',
                  border:    `1px solid ${room.alerts > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(20,184,166,0.2)'}`,
                }}>
                  {room.alerts > 0 ? `${room.alerts} Alert${room.alerts > 1 ? 's' : ''}` : 'All Stable'}
                </span>
              </div>

              {/* Risk stat boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Low Risk',  value: liveLow,  color: '#14B8A6', bg: 'rgba(20,184,166,0.07)'  },
                  { label: 'Moderate',  value: liveMod,  color: '#F59E0B', bg: 'rgba(245,158,11,0.07)' },
                  { label: 'High Risk', value: liveHigh, color: '#EF4444', bg: 'rgba(239,68,68,0.07)'  },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '10px 4px', background: s.bg, borderRadius: 10 }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: s.color, marginTop: 4, fontWeight: 600, opacity: 0.85 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Stacked occupancy bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Occupancy</span>
                  <span style={{ fontWeight: 700, color: '#1E3A8A' }}>
                    {occupied}/{total} &nbsp;
                    <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({Math.round((occupied / total) * 100)}%)</span>
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 6, overflow: 'hidden', display: 'flex', background: '#F3F4F6' }}>
                  <div style={{ width: `${highPct}%`, background: '#EF4444', transition: 'width 0.6s ease' }} />
                  <div style={{ width: `${modPct}%`,  background: '#F59E0B', transition: 'width 0.6s ease' }} />
                  <div style={{ width: `${lowPct}%`,  background: '#14B8A6', transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 10 }}>
                  <span style={{ color: '#EF4444' }}>■ High</span>
                  <span style={{ color: '#F59E0B' }}>■ Moderate</span>
                  <span style={{ color: '#14B8A6' }}>■ Low</span>
                  <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>{total - occupied} free</span>
                </div>
              </div>

              {/* Bed grid map */}
              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Bed Map</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
                  {Array.from({ length: total }, (_, i) => {
                    const patient = patients.find(p => p.roomId === room.id && p.bed === `Bed ${i + 1}`)
                    const col = patient ? riskColor(patient.riskLevel) : '#E5E7EB'
                    return (
                      <div key={i}
                        title={patient ? `${patient.name} — ${patient.riskLevel}` : `Bed ${i + 1} (Empty)`}
                        onClick={e => { e.stopPropagation(); patient && setSelectedPatient(patient) }}
                        style={{
                          aspectRatio: '1',
                          background: col,
                          borderRadius: 6,
                          opacity: patient ? 1 : 0.35,
                          cursor: patient ? 'pointer' : 'default',
                          transition: 'transform 0.12s',
                          border: `1.5px solid ${patient ? col + '55' : '#D1D5DB'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={e => { if (patient) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}>
                        <span style={{ fontSize: 8, color: patient ? 'rgba(255,255,255,0.9)' : '#9CA3AF', fontWeight: 700 }}>{i + 1}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}

        {/* Right panel: Risk Distribution + High Risk Patients */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Risk Distribution */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', marginBottom: 16 }}>Risk Distribution</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <DonutChart segments={allSegments} size={148} thickness={30} centerLabel={String(patients.length)} centerSub="Patients" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {allSegments.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: '#374151', fontWeight: 500 }}>{s.label}</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: s.color }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF', minWidth: 42, textAlign: 'right' }}>
                    ({patients.length > 0 ? ((s.value / patients.length) * 100).toFixed(1) : '0.0'}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* High Risk Patients */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.03)' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#EF4444' }}>High Risk Patients</div>
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{highRiskPatients.length} total</span>
            </div>
            {highRiskPatients.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#14B8A6', fontWeight: 600 }}>
                ✓ No high risk patients
              </div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {highRiskPatients.map(p => (
                  <div key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    style={{ padding: '10px 16px', borderBottom: '1px solid #F9FAFB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0, boxShadow: '0 0 6px rgba(239,68,68,0.55)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                        {p.room} – {p.bed} · Score: <b style={{ color: '#EF4444' }}>{p.riskScore}/100</b>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{p.lastUpdated}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Patient Status Table ───────────────────────────────────────── */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden' }}>

        {/* Table header */}
        <div style={{ padding: '14px 20px', borderBottom: '1.5px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12, background: '#FAFAFA' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>
            Room-wise Patient Status
            {selectedRoom && (
              <span style={{ marginLeft: 8, fontSize: 12, color: '#2563EB', fontWeight: 600 }}>
                — {ROOMS.find(r => r.id === selectedRoom)?.name}
              </span>
            )}
          </div>
          {selectedRoom && (
            <button onClick={() => setSelectedRoom(null)}
              style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              Show All
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {ROOMS.map(r => (
              <button key={r.id}
                onClick={() => setSelectedRoom(selectedRoom === r.id ? null : r.id)}
                style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                  border: '1px solid', borderColor: selectedRoom === r.id ? '#2563EB' : '#E5E7EB',
                  background: selectedRoom === r.id ? '#2563EB' : 'white',
                  color:      selectedRoom === r.id ? 'white'   : '#374151',
                }}>
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Table body */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Room', 'Patient ID', 'Name', 'Bed', 'Risk Level', 'Score', 'Status', 'Last Updated', 'Action'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayPatients.map(p => (
                <tr key={p.id}
                  style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setSelectedPatient(p)}>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: '#111827' }}>{p.room}</td>
                  <td style={{ padding: '11px 14px', color: '#1E3A8A', fontWeight: 700 }}>{p.id}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#111827' }}>{p.name}</td>
                  <td style={{ padding: '11px 14px', color: '#6B7280' }}>{p.bed}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: riskBg(p.riskLevel), color: riskColor(p.riskLevel) }}>
                      {p.riskLevel}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: scoreColor(p.riskScore) }}>{p.riskScore}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>/100</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot(p.status), flexShrink: 0 }} />
                      <span style={{ color: statusDot(p.status), fontWeight: 600, fontSize: 12 }}>{p.status}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#9CA3AF', fontSize: 11 }}>{p.lastUpdated}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedPatient(p) }}
                      style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', color: '#2563EB', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA' }}>
          <span style={{ fontSize: 12, color: '#6B7280' }}>
            Showing <b style={{ color: '#374151' }}>{displayPatients.length}</b> of <b style={{ color: '#374151' }}>{patients.length}</b> patients
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(n => (
              <button key={n} style={{
                width: 30, height: 30, borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                border: '1px solid', borderColor: n === 1 ? '#2563EB' : '#E5E7EB',
                background: n === 1 ? '#2563EB' : 'white',
                color:      n === 1 ? 'white'   : '#374151',
              }}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {selectedPatient && (
        <PatientDetailPanel patient={selectedPatient} onClose={() => setSelectedPatient(null)} onViewLive={p => setSelectedPatient(p)} />
      )}
    </div>
  )
}
