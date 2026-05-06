import { useState } from 'react'
import type { Patient } from '../../types'
import { ALERT_TREND } from '../../data/mockData'
import { useFallStore } from '../../store/useFallStore'
import { Sparkline } from '../Charts'
import { PatientDetailPanel } from '../PatientDetailPanel'

const riskColor = (l: string) => l === 'High Risk' ? '#EF4444' : l === 'Moderate Risk' ? '#F59E0B' : '#14B8A6'
const riskBg   = (l: string) => l === 'High Risk' ? 'rgba(239,68,68,0.08)' : l === 'Moderate Risk' ? 'rgba(245,158,11,0.08)' : 'rgba(20,184,166,0.08)'
const statusColor = (s: string) => s === 'New' ? '#EF4444' : s === 'Acknowledged' ? '#F59E0B' : '#14B8A6'

export function AlertsRiskTab() {
  const { alerts, patients, acknowledgeAlert, resolveAlert, setAlerts } = useFallStore()
  const [riskFilter, setRiskFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  const filtered = alerts.filter(a => {
    const riskMatch = riskFilter === 'All' || a.riskLevel === riskFilter
    const statusMatch = statusFilter === 'All' || a.status === statusFilter
    return riskMatch && statusMatch
  })

  const highCount = alerts.filter(a => a.riskLevel === 'High Risk' && a.status !== 'Resolved').length
  const modCount  = alerts.filter(a => a.riskLevel === 'Moderate Risk' && a.status !== 'Resolved').length
  const lowCount  = alerts.filter(a => a.riskLevel === 'Low Risk' && a.status !== 'Resolved').length
  const ackCount  = alerts.filter(a => a.status === 'Acknowledged').length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
      {/* Left: Alerts table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>Risk Level:</span>
          {['All', 'High Risk', 'Moderate Risk', 'Low Risk'].map(opt => (
            <button key={opt} onClick={() => setRiskFilter(opt)}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E5E7EB', background: riskFilter === opt ? '#2563EB' : 'white', color: riskFilter === opt ? 'white' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {opt}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 4px' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Status:</span>
          {['All', 'New', 'Acknowledged', 'Resolved'].map(opt => (
            <button key={opt} onClick={() => setStatusFilter(opt)}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E5E7EB', background: statusFilter === opt ? '#1E3A8A' : 'white', color: statusFilter === opt ? 'white' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {opt}
            </button>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => { setRiskFilter('All'); setStatusFilter('All') }}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Clear Filters
            </button>
          </div>
        </div>

        {/* Alert List */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#111827' }}>
              Alert List <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>({filtered.length} records)</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Alert ID', 'Patient ID', 'Patient / Bed', 'Room', 'Risk Level', 'Alert Type', 'Description', 'Time', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', opacity: a.status === 'Resolved' ? 0.5 : 1 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: riskColor(a.riskLevel) }}>{a.id}</td>
                    <td style={{ padding: '10px 12px', color: '#6B7280' }}>{a.patientId}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{a.patientName} / {a.bed}</td>
                    <td style={{ padding: '10px 12px', color: '#6B7280' }}>{a.room}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: riskBg(a.riskLevel), color: riskColor(a.riskLevel) }}>{a.riskLevel}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 600, fontSize: 11 }}>{a.alertType}</td>
                    <td style={{ padding: '10px 12px', color: '#6B7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</td>
                    <td style={{ padding: '10px 12px', color: '#6B7280', whiteSpace: 'nowrap', fontSize: 11 }}>{a.time}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${statusColor(a.status)}18`, color: statusColor(a.status), border: `1px solid ${statusColor(a.status)}40` }}>{a.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); setSelectedPatient(patients.find(p => p.id === a.patientId) ?? null) }}
                          style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #E5E7EB', background: 'white', fontSize: 11, cursor: 'pointer' }} title="View">👁</button>
                        {a.status === 'New' && (
                          <button onClick={e => { e.stopPropagation(); acknowledgeAlert(a.id) }}
                            style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', fontSize: 11, cursor: 'pointer', color: '#F59E0B', fontWeight: 700 }} title="Acknowledge">✓</button>
                        )}
                        {a.status === 'Acknowledged' && (
                          <button onClick={e => { e.stopPropagation(); resolveAlert(a.id) }}
                            style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid rgba(20,184,166,0.3)', background: 'rgba(20,184,166,0.08)', fontSize: 11, cursor: 'pointer', color: '#14B8A6', fontWeight: 700 }} title="Resolve">✓✓</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>No alerts match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(n => (
              <button key={n} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E5E7EB', background: n === 1 ? '#2563EB' : 'white', color: n === 1 ? 'white' : '#374151', fontSize: 12, cursor: 'pointer' }}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Alert Summary + Trend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 14 }}>Alert Summary</div>
          {[
            { label: 'High Risk Alerts',  value: highCount, color: '#EF4444', icon: '🚨' },
            { label: 'Moderate Risk',     value: modCount,  color: '#F59E0B', icon: '⚠️' },
            { label: 'Low Risk Alerts',   value: lowCount,  color: '#14B8A6', icon: '✅' },
            { label: 'Acknowledged',      value: ackCount,  color: '#2563EB', icon: '✓' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ flex: 1, fontSize: 12, color: '#6B7280' }}>{s.label}</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, padding: '10px', background: '#F9FAFB', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>Total Active</div>
            <div style={{ fontSize: 28, fontWeight: 950, color: '#1E3A8A' }}>{highCount + modCount + lowCount}</div>
          </div>
        </div>

        {/* Alert Trend */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 4 }}>Alert Trend (Last 7 days)</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>Number of alerts per day</div>
          <Sparkline data={ALERT_TREND} color="#2563EB" width={268} height={60} filled />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#6B7280' }}>
            {['29 Apr','30 Apr','01 May','02 May','03 May','04 May','05 May','06 May'].map(d => (
              <span key={d} style={{ transform: 'rotate(-30deg)', display: 'inline-block', transformOrigin: 'top left', marginTop: 8, fontSize: 9 }}>{d}</span>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 12 }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setAlerts(prev => prev.map(a => a.status === 'New' ? { ...a, status: 'Acknowledged' as const } : a))}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)', color: '#F59E0B', fontSize: 12, cursor: 'pointer', fontWeight: 700, textAlign: 'left' }}>
              ✓ Acknowledge All New Alerts
            </button>
            <button
              onClick={() => setAlerts(prev => prev.map(a => a.riskLevel !== 'High Risk' && a.status === 'Acknowledged' ? { ...a, status: 'Resolved' as const } : a))}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(20,184,166,0.3)', background: 'rgba(20,184,166,0.06)', color: '#14B8A6', fontSize: 12, cursor: 'pointer', fontWeight: 700, textAlign: 'left' }}>
              ✓✓ Resolve Non-Critical
            </button>
            <button
              onClick={() => setAlerts(prev => prev.map(a => a.status === 'Resolved' ? { ...a, status: 'New' as const } : a))}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600, textAlign: 'left' }}>
              ↺ Reopen Resolved
            </button>
          </div>
        </div>
      </div>

      {selectedPatient && (
        <PatientDetailPanel patient={selectedPatient} onClose={() => setSelectedPatient(null)} onViewLive={p => setSelectedPatient(p)} />
      )}
    </div>
  )
}
