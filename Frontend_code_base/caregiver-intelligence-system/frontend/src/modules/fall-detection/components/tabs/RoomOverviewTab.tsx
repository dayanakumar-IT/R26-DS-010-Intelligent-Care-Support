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
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  const allSegments = [
    { label: 'Low Risk',      value: patients.filter(p => p.riskLevel === 'Low Risk').length,      color: '#14B8A6' },
    { label: 'Moderate Risk', value: patients.filter(p => p.riskLevel === 'Moderate Risk').length, color: '#F59E0B' },
    { label: 'High Risk',     value: patients.filter(p => p.riskLevel === 'High Risk').length,     color: '#EF4444' },
  ]
  const highRiskPatients = patients.filter(p => p.riskLevel === 'High Risk')
  const displayPatients = selectedRoom ? patients.filter(p => p.roomId === selectedRoom) : patients

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Room Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Room cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, gridColumn: '1/3' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {ROOMS.map(room => {
              // Compute live counts from store patients
              const roomPatients = patients.filter(p => p.roomId === room.id)
              const liveLow  = roomPatients.filter(p => p.riskLevel === 'Low Risk').length
              const liveMod  = roomPatients.filter(p => p.riskLevel === 'Moderate Risk').length
              const liveHigh = roomPatients.filter(p => p.riskLevel === 'High Risk').length
              const segs = [
                { label: 'Low',      value: liveLow,  color: '#14B8A6' },
                { label: 'Moderate', value: liveMod,  color: '#F59E0B' },
                { label: 'High',     value: liveHigh, color: '#EF4444' },
              ]
              const isSelected = selectedRoom === room.id
              return (
                <div key={room.id} onClick={() => setSelectedRoom(isSelected ? null : room.id)}
                  style={{ background: 'white', border: `1.5px solid ${isSelected ? '#2563EB' : '#E5E7EB'}`, borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{room.name}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{room.totalBeds} Beds · {room.bedsOccupied} Occupied</div>
                    </div>
                    <DonutChart segments={segs} size={90} thickness={18} centerLabel={String(room.totalBeds)} centerSub="Beds" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                    {[
                      { label: 'Low Risk',  value: liveLow,      color: '#14B8A6' },
                      { label: 'Moderate',  value: liveMod,      color: '#F59E0B' },
                      { label: 'High',      value: liveHigh,     color: '#EF4444' },
                      { label: 'Alerts',    value: room.alerts,  color: '#EF4444' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '6px 4px', background: '#F9FAFB', borderRadius: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Room Utilization */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 14 }}>Room Utilization</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {ROOMS.map(room => {
                const occupiedPct = (room.bedsOccupied / room.totalBeds) * 100
                return (
                  <div key={room.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280' }}>
                      <span style={{ fontWeight: 700, color: '#111827' }}>{room.name}</span>
                      <span>{room.bedsOccupied}/{room.totalBeds} beds</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, height: 40 }}>
                      {Array.from({ length: room.totalBeds }, (_, i) => {
                        const patient = patients.find(p => p.roomId === room.id && p.bed === `Bed ${i + 1}`)
                        const col = patient ? riskColor(patient.riskLevel) : '#E5E7EB'
                        return (
                          <div key={i}
                            style={{ flex: 1, background: col, borderRadius: 4, opacity: patient ? 0.85 : 0.4, cursor: patient ? 'pointer' : 'default', transition: 'opacity 0.1s' }}
                            title={patient ? `${patient.name} — ${patient.riskLevel}` : 'Empty'}
                            onClick={() => patient && setSelectedPatient(patient)} />
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B7280' }}>
                      <span style={{ color: '#14B8A6' }}>■ Low</span>
                      <span style={{ color: '#F59E0B' }}>■ Moderate</span>
                      <span style={{ color: '#EF4444' }}>■ High</span>
                      <span style={{ color: '#D1D5DB' }}>□ Empty</span>
                    </div>
                    <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${occupiedPct}%`, background: '#2563EB', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: Donut + High Risk */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Distribution */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 12 }}>Risk Distribution</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <DonutChart segments={allSegments} size={140} thickness={30} centerLabel={String(patients.length)} centerSub="Patients" />
            </div>
            {allSegments.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                <span style={{ flex: 1, fontSize: 12, color: '#6B7280' }}>{s.label}</span>
                <span style={{ fontWeight: 800, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>({((s.value / patients.length) * 100).toFixed(1)}%)</span>
              </div>
            ))}
          </div>

          {/* High Risk Patients */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.04)' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#EF4444' }}>High Risk Patients</div>
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{highRiskPatients.length} total</span>
            </div>
            {highRiskPatients.map(p => (
              <div key={p.id} onClick={() => setSelectedPatient(p)}
                style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0, boxShadow: '0 0 6px #EF4444' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{p.room} – {p.bed} · Score: <b style={{ color: '#EF4444' }}>{p.riskScore}/100</b></div>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{p.lastUpdated}</div>
              </div>
            ))}
            {highRiskPatients.length === 0 && (
              <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: '#14B8A6', fontWeight: 600 }}>✓ No high risk patients</div>
            )}
          </div>
        </div>
      </div>

      {/* Room-wise Patient Status Table */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12, background: '#F9FAFB' }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#111827' }}>
            Room-wise Patient Status
            {selectedRoom && <span style={{ marginLeft: 8, fontSize: 11, color: '#2563EB', fontWeight: 600 }}>({ROOMS.find(r => r.id === selectedRoom)?.name})</span>}
          </div>
          {selectedRoom && (
            <button onClick={() => setSelectedRoom(null)}
              style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: 11, cursor: 'pointer' }}>
              Show All
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {ROOMS.map(r => (
              <button key={r.id} onClick={() => setSelectedRoom(selectedRoom === r.id ? null : r.id)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: selectedRoom === r.id ? '#2563EB' : 'white', color: selectedRoom === r.id ? 'white' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Room', 'Patient ID', 'Name', 'Bed', 'Risk Level', 'Score', 'Status', 'Last Updated', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayPatients.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setSelectedPatient(p)}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#111827' }}>{p.room}</td>
                  <td style={{ padding: '10px 12px', color: '#6B7280' }}>{p.id}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{p.name}</td>
                  <td style={{ padding: '10px 12px', color: '#6B7280' }}>{p.bed}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: riskBg(p.riskLevel), color: riskColor(p.riskLevel) }}>{p.riskLevel}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 800, fontSize: 14, color: scoreColor(p.riskScore) }}>{p.riskScore}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot(p.status) }} />
                      <span style={{ color: statusDot(p.status), fontWeight: 600 }}>{p.status}</span>
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6B7280', fontSize: 11 }}>{p.lastUpdated}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={e => { e.stopPropagation(); setSelectedPatient(p) }}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: 11, cursor: 'pointer' }}>
                      👁
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#6B7280' }}>Showing {displayPatients.length} of {patients.length} patients</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(n => (
              <button key={n} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E5E7EB', background: n === 1 ? '#2563EB' : 'white', color: n === 1 ? 'white' : '#374151', fontSize: 12, cursor: 'pointer' }}>{n}</button>
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
