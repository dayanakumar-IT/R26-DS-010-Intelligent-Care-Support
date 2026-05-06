import { useState } from 'react'
import { PATIENTS, ROOMS, ALERTS, RISK_TREND_DATA, POSTURE_DIST } from '../../data/mockData'
import { DonutChart, BarChart, Sparkline, LineChart } from '../Charts'

export function ReportsTab() {
  const [reportType, setReportType] = useState('Daily Report')
  const [reportDate, setReportDate] = useState('06-05-2026')
  const [room, setRoom] = useState('All Rooms')
  const [generated, setGenerated] = useState(true)
  const [exportFormat, setExportFormat] = useState<string | null>(null)

  const totalPatients = PATIENTS.length
  const totalAlerts = ALERTS.length
  const highRiskEvents = ALERTS.filter(a => a.riskLevel === 'High Risk').length
  const fallsDetected = 2
  const avgRisk = Math.round(PATIENTS.reduce((s, p) => s + p.riskScore, 0) / PATIENTS.length)

  const donutSegments = [
    { label: 'Low Risk',      value: PATIENTS.filter(p => p.riskLevel === 'Low Risk').length,      color: '#16A34A' },
    { label: 'Moderate Risk', value: PATIENTS.filter(p => p.riskLevel === 'Moderate Risk').length, color: '#F59E0B' },
    { label: 'High Risk',     value: PATIENTS.filter(p => p.riskLevel === 'High Risk').length,     color: '#EF4444' },
  ]

  const lineData = RISK_TREND_DATA.map(d => ({
    label: d.label,
    values: [
      { key: 'high',     value: d.high,     color: '#EF4444' },
      { key: 'moderate', value: d.moderate, color: '#F59E0B' },
      { key: 'low',      value: d.low,      color: '#16A34A' },
    ],
  }))

  const handleExport = (fmt: string) => {
    setExportFormat(fmt)
    setTimeout(() => setExportFormat(null), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Report Type:</span>
          <select value={reportType} onChange={e => setReportType(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-strong)', background: 'var(--surface)', cursor: 'pointer' }}>
            {['Daily Report', 'Weekly Report', 'Monthly Report', 'Custom Range'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Date:</span>
          <input type="text" value={reportDate} onChange={e => setReportDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-strong)', background: 'var(--surface)', width: 110 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>Room:</span>
          <select value={room} onChange={e => setRoom(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-strong)', background: 'var(--surface)', cursor: 'pointer' }}>
            {['All Rooms', 'Room 01', 'Room 02'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <button onClick={() => setGenerated(true)}
          style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1E3A8A,#7C3AED)', color: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
          Generate
        </button>
      </div>

      {generated && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {[
              { label: 'Total Patients',    value: totalPatients, color: '#1E3A8A', icon: '👥' },
              { label: 'Total Alerts',      value: totalAlerts,   color: '#F97316', icon: '🔔' },
              { label: 'High Risk Events',  value: highRiskEvents,color: '#EF4444', icon: '🚨' },
              { label: 'Falls Detected',    value: fallsDetected, color: '#8B5CF6', icon: '⬇' },
              { label: 'Avg Risk Score',    value: `${avgRisk}/100`, color: '#F59E0B', icon: '📊' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', borderTop: `3px solid ${s.color}`, textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 950, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 14 }}>
            {/* Risk Score Trend */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-strong)', marginBottom: 4 }}>Risk Score Trend (7 Days)</div>
              <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 12 }}>Risk distribution by category over time</div>
              <LineChart data={lineData} width={340} height={180} />
              <div style={{ display: 'flex', gap: 14, marginTop: 10, justifyContent: 'center' }}>
                {[['High Risk', '#EF4444'], ['Moderate', '#F59E0B'], ['Low Risk', '#16A34A']].map(([l, c]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: c }} />
                    <span style={{ fontSize: 10, color: 'var(--text)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Distribution */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-strong)', marginBottom: 4 }}>Risk Distribution</div>
              <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 12 }}>Current patient distribution</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <DonutChart segments={donutSegments} size={140} thickness={28} centerLabel={String(totalPatients)} centerSub="Patients" />
              </div>
              {donutSegments.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text)' }}>{s.label}</span>
                  <span style={{ fontWeight: 800, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Posture Distribution */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-strong)', marginBottom: 4 }}>Posture Distribution</div>
              <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 12 }}>Movement patterns today</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <DonutChart segments={POSTURE_DIST} size={140} thickness={28} centerLabel="Today" />
              </div>
              {POSTURE_DIST.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text)' }}>{s.label}</span>
                  <span style={{ fontWeight: 800, color: s.color }}>{s.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Room-wise Summary Table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(249,115,22,0.04)' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-strong)' }}>Room-wise Summary</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Room', 'Total Beds', 'Low Risk', 'Moderate Risk', 'High Risk', 'Active Alerts', 'Avg Score', 'Occupancy'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROOMS.map(r => {
                  const pts = PATIENTS.filter(p => p.roomId === r.id)
                  const avgScore = pts.length ? Math.round(pts.reduce((s, p) => s + p.riskScore, 0) / pts.length) : 0
                  const occupancy = Math.round((r.bedsOccupied / r.totalBeds) * 100)
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-strong)' }}>{r.name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text)' }}>{r.totalBeds}</td>
                      <td style={{ padding: '12px 14px', color: '#16A34A', fontWeight: 700 }}>{r.lowRisk}</td>
                      <td style={{ padding: '12px 14px', color: '#F59E0B', fontWeight: 700 }}>{r.moderateRisk}</td>
                      <td style={{ padding: '12px 14px', color: '#EF4444', fontWeight: 700 }}>{r.highRisk}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontWeight: 700 }}>{r.alerts}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: avgScore >= 71 ? '#EF4444' : avgScore >= 41 ? '#F59E0B' : '#16A34A' }}>{avgScore}/100</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${occupancy}%`, background: '#1E3A8A', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{occupancy}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Download Report */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-strong)', marginBottom: 4 }}>Download Report</div>
            <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 16 }}>
              Description: Generates a detailed report with patient statistics, risk distribution, posture analysis and room-wise summaries for {reportDate}.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: exportFormat === 'PDF' ? '✓ Downloading...' : '⬇ Download PDF',   fmt: 'PDF',   color: '#EF4444' },
                { label: exportFormat === 'XLS' ? '✓ Downloading...' : '⬇ Download Excel', fmt: 'XLS',   color: '#16A34A' },
                { label: exportFormat === 'PRT' ? '✓ Printing...'    : '🖨 Print Report',   fmt: 'PRT',   color: '#1E3A8A' },
              ].map(btn => (
                <button key={btn.fmt} onClick={() => handleExport(btn.fmt)}
                  style={{ padding: '10px 20px', borderRadius: 9, border: `1px solid ${btn.color}40`, background: `${btn.color}10`, color: btn.color, fontSize: 13, cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s' }}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
