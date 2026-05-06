import { useState, useEffect } from 'react'
import { ROOMS, RISK_TREND_DATA } from '../../data/mockData'
import { useFallStore } from '../../store/useFallStore'
import { DonutChart, BarChart, LineChart } from '../Charts'

const scoreColor = (s: number) => s >= 71 ? '#EF4444' : s >= 41 ? '#F59E0B' : '#14B8A6'

// Parse "DD-MM-YYYY" → Date
function parseDate(s: string): Date {
  const [d, m, y] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function fmtDate(dt: Date): string {
  return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`
}
function fmtMonthYear(dt: Date): string {
  return dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
function addDays(dt: Date, n: number): Date {
  const d = new Date(dt); d.setDate(d.getDate() + n); return d
}

// Period-scaled mock aggregates (realistic multipliers from base daily data)
const PERIOD_SCALE: Record<string, { alertMult: number; fallMult: number; eventMult: number }> = {
  'Daily Report':   { alertMult: 1,    fallMult: 1,  eventMult: 1   },
  'Weekly Report':  { alertMult: 6.8,  fallMult: 3,  eventMult: 5.5 },
  'Monthly Report': { alertMult: 28.5, fallMult: 11, eventMult: 22  },
  'Custom Range':   { alertMult: 1,    fallMult: 1,  eventMult: 1   },
}

export function ReportsTab() {
  const { patients, alerts } = useFallStore()

  const [reportType, setReportType] = useState('Daily Report')
  const [baseDate,   setBaseDate]   = useState('06-05-2026')   // single DD-MM-YYYY anchor
  const [customEnd,  setCustomEnd]  = useState('06-05-2026')
  const [room,       setRoom]       = useState('All Rooms')
  const [generated,  setGenerated]  = useState(true)
  const [exportFormat, setExportFormat] = useState<string | null>(null)

  // ── Derived date label shown in the UI ──────────────────────────────
  const dateLabel = (() => {
    const dt = parseDate(baseDate)
    if (reportType === 'Daily Report')   return baseDate
    if (reportType === 'Weekly Report')  return `${fmtDate(addDays(dt, -6))} – ${baseDate}`
    if (reportType === 'Monthly Report') return fmtMonthYear(dt)
    if (reportType === 'Custom Range')   return `${baseDate} – ${customEnd}`
    return baseDate
  })()

  // Auto-update baseDate format hint when type switches
  useEffect(() => {
    if (reportType === 'Monthly Report') setBaseDate('06-05-2026')
  }, [reportType])

  // ── Filtered data ────────────────────────────────────────────────────
  const filteredPatients = room === 'All Rooms' ? patients : patients.filter(p => p.room === room)
  const filteredAlerts   = room === 'All Rooms' ? alerts   : alerts.filter(a => a.room === room)

  const totalPatients   = filteredPatients.length
  const highRiskPts     = filteredPatients.filter(p => p.riskLevel === 'High Risk')
  const moderateRiskPts = filteredPatients.filter(p => p.riskLevel === 'Moderate Risk')
  const lowRiskPts      = filteredPatients.filter(p => p.riskLevel === 'Low Risk')
  const criticalPts     = filteredPatients.filter(p => p.riskScore >= 80)
  const topRiskPatients = [...filteredPatients].sort((a, b) => b.riskScore - a.riskScore).slice(0, 6)
  const avgRisk         = totalPatients > 0 ? Math.round(filteredPatients.reduce((s, p) => s + p.riskScore, 0) / totalPatients) : 0

  // ── Period-scaled aggregate stats ───────────────────────────────────
  const scale          = PERIOD_SCALE[reportType] ?? PERIOD_SCALE['Daily Report']
  const periodAlerts   = Math.round(filteredAlerts.length * scale.alertMult)
  const periodFalls    = Math.round(2 * scale.fallMult)
  const periodHiEvents = Math.round(filteredAlerts.filter(a => a.riskLevel === 'High Risk').length * scale.eventMult)

  // ── Period label strings ─────────────────────────────────────────────
  const periodWord = reportType === 'Daily Report' ? 'today' :
                     reportType === 'Weekly Report' ? 'this week' :
                     reportType === 'Monthly Report' ? 'this month' : 'this period'
  const periodAdj  = reportType === 'Daily Report' ? "Today's" :
                     reportType === 'Weekly Report' ? "This week's" :
                     reportType === 'Monthly Report' ? "This month's" : "Period"

  // ── Ward status ──────────────────────────────────────────────────────
  const wardStatus      = highRiskPts.length > 3 ? 'CRITICAL' : highRiskPts.length > 0 ? 'CAUTION' : 'STABLE'
  const wardStatusColor = wardStatus === 'CRITICAL' ? '#EF4444' : wardStatus === 'CAUTION' ? '#F59E0B' : '#14B8A6'
  const wardStatusBg    = wardStatus === 'CRITICAL' ? 'rgba(239,68,68,0.1)' : wardStatus === 'CAUTION' ? 'rgba(245,158,11,0.1)' : 'rgba(20,184,166,0.1)'

  // ── Chart data (weekly/monthly gets scaled bar heights) ──────────────
  const donutSegments = [
    { label: 'Low Risk',      value: lowRiskPts.length,      color: '#14B8A6' },
    { label: 'Moderate Risk', value: moderateRiskPts.length, color: '#F59E0B' },
    { label: 'High Risk',     value: highRiskPts.length,     color: '#EF4444' },
  ]
  const chartScale = reportType === 'Monthly Report' ? 4 : reportType === 'Weekly Report' ? 1 : 1
  const lineData   = RISK_TREND_DATA.map(d => ({
    label: d.label,
    values: [
      { key: 'high',     value: d.high     * chartScale, color: '#EF4444' },
      { key: 'moderate', value: d.moderate * chartScale, color: '#F59E0B' },
      { key: 'low',      value: d.low      * chartScale, color: '#14B8A6' },
    ],
  }))
  const barData = RISK_TREND_DATA.map(d => ({
    label: d.label,
    low:      d.low      * chartScale,
    moderate: d.moderate * chartScale,
    high:     d.high     * chartScale,
  }))

  // ── Key findings & recommendations (all period-aware) ────────────────
  const keyFindings = [
    { dot: '#EF4444', text: `${highRiskPts.length} patient(s) at High Risk ${periodWord} — immediate review recommended` },
    { dot: '#F59E0B', text: `${criticalPts.length} patient(s) with risk score ≥ 80/100 ${periodWord}` },
    { dot: '#F59E0B', text: `${periodHiEvents} high-risk alert events triggered ${periodWord}` },
    { dot: '#7C3AED', text: `${periodFalls} fall(s) detected during ${periodWord === 'today' ? "today's" : periodWord} monitoring period` },
    { dot: '#14B8A6', text: `Average ward risk score: ${avgRisk}/100 — ${avgRisk >= 60 ? 'Elevated, monitor closely' : avgRisk >= 40 ? 'Moderate, routine monitoring' : 'Within acceptable range'}` },
    ...(reportType !== 'Daily Report' ? [
      { dot: '#2563EB', text: `${periodAlerts} total alerts logged ${periodWord} across ${room}` },
    ] : []),
  ]

  const recommendations = [
    highRiskPts.length > 0
      ? { dot: '#EF4444', text: `Prioritise monitoring ${periodWord}: ${highRiskPts.slice(0, 3).map(p => p.name).join(', ')}` }
      : { dot: '#14B8A6', text: 'No immediate staffing concerns — continue routine rounds' },
    ...(criticalPts.length > 0 ? [{ dot: '#EF4444', text: `Bed-side safety review needed for ${criticalPts.length} critical patient(s)` }] : []),
    reportType === 'Weekly Report'
      ? { dot: '#2563EB', text: 'Conduct weekly risk review meeting with nursing team' }
      : reportType === 'Monthly Report'
      ? { dot: '#2563EB', text: 'Schedule monthly supervisor debrief and protocol review' }
      : { dot: '#F59E0B', text: 'Review all Monitoring-status patients before end of shift' },
    { dot: '#2563EB', text: 'Ensure fall prevention protocols are active for all High Risk patients' },
    reportType === 'Monthly Report'
      ? { dot: '#14B8A6', text: 'Archive monthly report for compliance and audit records' }
      : { dot: '#14B8A6', text: 'Document all status changes for handover notes' },
  ]

  // ── Build printable HTML ─────────────────────────────────────────────
  const buildReportHTML = () => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Fall Detection ${reportType} — ${dateLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:28px 32px;color:#111827;background:#fff;font-size:13px}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1E3A8A;padding-bottom:18px;margin-bottom:22px}
    .hdr h1{font-size:22px;color:#1E3A8A;font-weight:900;margin-bottom:4px}
    .hdr p{font-size:12px;color:#6B7280}
    .hdr-meta{text-align:right;font-size:12px;color:#6B7280;line-height:1.8}
    .status-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-weight:900;font-size:13px;background:${wardStatusBg};color:${wardStatusColor};border:2px solid ${wardStatusColor}55;margin-top:8px}
    .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:22px}
    .stat{border:1px solid #E5E7EB;border-radius:10px;padding:14px 10px;text-align:center}
    .stat-v{font-size:26px;font-weight:900;line-height:1}
    .stat-l{font-size:10px;color:#6B7280;margin-top:5px;text-transform:uppercase;letter-spacing:.04em}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px}
    .box{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:14px}
    .box-title{font-size:11px;font-weight:800;color:#374151;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #E5E7EB;text-transform:uppercase;letter-spacing:.05em}
    ul.findings{list-style:none;display:flex;flex-direction:column;gap:6px}
    ul.findings li{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#374151;line-height:1.45}
    .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:3px}
    .sec-title{font-size:13px;font-weight:800;color:#111827;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E5E7EB}
    table{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:22px}
    thead tr{background:#1E3A8A}
    th{padding:8px 10px;text-align:left;color:#fff;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
    td{padding:8px 10px;border-bottom:1px solid #F3F4F6}
    tr:nth-child(even) td{background:#F9FAFB}
    .badge{display:inline-block;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700}
    .bh{background:rgba(239,68,68,.12);color:#EF4444}
    .bm{background:rgba(245,158,11,.12);color:#F59E0B}
    .bl{background:rgba(20,184,166,.12);color:#14B8A6}
    .footer{margin-top:24px;padding-top:12px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;font-size:10px;color:#9CA3AF}
    @media print{body{padding:10px 14px}@page{margin:.8cm}}
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1>Intelligent Care Support</h1>
      <p>Fall Detection &amp; Risk Monitoring — Supervisor ${reportType}</p>
      <div class="status-badge">WARD STATUS: ${wardStatus}</div>
    </div>
    <div class="hdr-meta">
      <div><b>Report Type:</b> ${reportType}</div>
      <div><b>Period:</b> ${dateLabel}</div>
      <div><b>Scope:</b> ${room}</div>
      <div><b>Generated:</b> ${new Date().toLocaleString()}</div>
    </div>
  </div>
  <div class="stats">
    <div class="stat" style="border-top:3px solid #1E3A8A"><div class="stat-v" style="color:#1E3A8A">${totalPatients}</div><div class="stat-l">Total Patients</div></div>
    <div class="stat" style="border-top:3px solid #EF4444"><div class="stat-v" style="color:#EF4444">${highRiskPts.length}</div><div class="stat-l">High Risk</div></div>
    <div class="stat" style="border-top:3px solid #F59E0B"><div class="stat-v" style="color:#F59E0B">${periodAlerts}</div><div class="stat-l">Total Alerts (${periodWord})</div></div>
    <div class="stat" style="border-top:3px solid #7C3AED"><div class="stat-v" style="color:#7C3AED">${periodFalls}</div><div class="stat-l">Falls (${periodWord})</div></div>
    <div class="stat" style="border-top:3px solid #F59E0B"><div class="stat-v" style="color:#F59E0B">${avgRisk}/100</div><div class="stat-l">Avg Risk Score</div></div>
  </div>
  <div class="two">
    <div class="box">
      <div class="box-title">Key Findings — ${periodAdj} Summary</div>
      <ul class="findings">${keyFindings.map(f => `<li><span class="dot" style="background:${f.dot}"></span>${f.text}</li>`).join('')}</ul>
    </div>
    <div class="box">
      <div class="box-title">Supervisor Recommendations</div>
      <ul class="findings">${recommendations.map(r => `<li><span class="dot" style="background:${r.dot}"></span>${r.text}</li>`).join('')}</ul>
    </div>
  </div>
  <div class="sec-title">Top Risk Patients — Requires Attention</div>
  <table>
    <thead><tr><th>Patient ID</th><th>Name</th><th>Room</th><th>Bed</th><th>Risk Level</th><th>Score</th><th>Status</th><th>Trend</th><th>Last Updated</th></tr></thead>
    <tbody>${topRiskPatients.map(p => `<tr>
      <td><b>${p.id}</b></td><td>${p.name}</td><td>${p.room}</td><td>${p.bed}</td>
      <td><span class="badge ${p.riskLevel === 'High Risk' ? 'bh' : p.riskLevel === 'Moderate Risk' ? 'bm' : 'bl'}">${p.riskLevel}</span></td>
      <td><b style="color:${p.riskScore >= 71 ? '#EF4444' : p.riskScore >= 41 ? '#F59E0B' : '#14B8A6'}">${p.riskScore}/100</b></td>
      <td>${p.status}</td>
      <td>${p.trendChange > 0 ? '↑ +' + p.trendChange : p.trendChange < 0 ? '↓ ' + p.trendChange : '→ Stable'}</td>
      <td>${p.lastUpdated}</td>
    </tr>`).join('')}</tbody>
  </table>
  <div class="sec-title">Room-wise Summary</div>
  <table>
    <thead><tr><th>Room</th><th>Total Beds</th><th>Occupied</th><th>Low Risk</th><th>Moderate Risk</th><th>High Risk</th><th>Active Alerts</th><th>Avg Score</th><th>Occupancy</th></tr></thead>
    <tbody>${ROOMS.map(r => {
      const pts = patients.filter(p => p.roomId === r.id)
      const avg = pts.length ? Math.round(pts.reduce((s,p)=>s+p.riskScore,0)/pts.length) : 0
      const occ = Math.round((r.bedsOccupied/r.totalBeds)*100)
      return `<tr>
        <td><b>${r.name}</b></td><td>${r.totalBeds}</td><td>${pts.length}</td>
        <td style="color:#14B8A6;font-weight:700">${pts.filter(p=>p.riskLevel==='Low Risk').length}</td>
        <td style="color:#F59E0B;font-weight:700">${pts.filter(p=>p.riskLevel==='Moderate Risk').length}</td>
        <td style="color:#EF4444;font-weight:700">${pts.filter(p=>p.riskLevel==='High Risk').length}</td>
        <td><span class="badge bh">${r.alerts}</span></td>
        <td style="color:${avg>=71?'#EF4444':avg>=41?'#F59E0B':'#14B8A6'};font-weight:700">${avg}/100</td>
        <td>${occ}%</td>
      </tr>`
    }).join('')}</tbody>
  </table>
  <div class="footer">
    <div>Intelligent Care Support System — Confidential Supervisor Report</div>
    <div>Generated: ${new Date().toLocaleString()} | Period: ${dateLabel} | Scope: ${room}</div>
  </div>
</body></html>`

  const buildCSV = () => {
    const header = ['Patient ID','Name','Room','Bed','Risk Level','Risk Score','Status','Trend Change','Last Updated']
    const rows   = filteredPatients.map(p => [p.id, p.name, p.room, p.bed, p.riskLevel, p.riskScore, p.status, p.trendChange, p.lastUpdated])
    return [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  }

  const handleExport = (fmt: string) => {
    setExportFormat(fmt)
    if (fmt === 'PDF' || fmt === 'PRT') {
      const win = window.open('', '_blank')
      if (win) { win.document.write(buildReportHTML()); win.document.close(); setTimeout(() => { win.focus(); win.print() }, 600) }
    } else if (fmt === 'CSV') {
      const blob = new Blob([buildCSV()], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `report-${reportType.replace(' ','-').toLowerCase()}-${dateLabel}.csv`; a.click()
      URL.revokeObjectURL(url)
    }
    setTimeout(() => setExportFormat(null), 2500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Report Type:</span>
          <select value={reportType} onChange={e => setReportType(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12, color: '#111827', background: '#F9FAFB', cursor: 'pointer' }}>
            {['Daily Report','Weekly Report','Monthly Report','Custom Range'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>

        {/* Date input — adapts to report type */}
        {reportType === 'Monthly Report' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Month:</span>
            <input type="month" defaultValue="2026-05"
              onChange={e => {
                const [y, m] = e.target.value.split('-')
                setBaseDate(`01-${m}-${y}`)
              }}
              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12, color: '#111827', background: '#F9FAFB' }} />
          </div>
        ) : reportType === 'Custom Range' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>From:</span>
            <input type="text" value={baseDate} onChange={e => setBaseDate(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12, color: '#111827', background: '#F9FAFB', width: 100 }} />
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>To:</span>
            <input type="text" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12, color: '#111827', background: '#F9FAFB', width: 100 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
              {reportType === 'Weekly Report' ? 'Week ending:' : 'Date:'}
            </span>
            <input type="text" value={baseDate} onChange={e => setBaseDate(e.target.value)}
              placeholder="DD-MM-YYYY"
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12, color: '#111827', background: '#F9FAFB', width: 110 }} />
            {reportType === 'Weekly Report' && (
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>({dateLabel})</span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Room:</span>
          <select value={room} onChange={e => setRoom(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12, color: '#111827', background: '#F9FAFB', cursor: 'pointer' }}>
            {['All Rooms','Room 01','Room 02'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>

        <button onClick={() => setGenerated(true)}
          style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1E3A8A,#7C3AED)', color: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
          Generate
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {[
            { fmt: 'PDF', label: exportFormat === 'PDF' ? '✓ Opening...' : '⬇ PDF',   color: '#EF4444' },
            { fmt: 'CSV', label: exportFormat === 'CSV' ? '✓ Saved!'    : '⬇ CSV',    color: '#14B8A6' },
            { fmt: 'PRT', label: exportFormat === 'PRT' ? '✓ Printing…' : '🖨 Print',  color: '#1E3A8A' },
          ].map(btn => (
            <button key={btn.fmt} onClick={() => handleExport(btn.fmt)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${btn.color}55`, background: `${btn.color}0f`, color: btn.color, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {generated && (
        <>
          {/* ── At-a-Glance Supervisor Summary ──────────────────────────── */}
          <div style={{ background: 'white', border: `2px solid ${wardStatusColor}44`, borderLeft: `5px solid ${wardStatusColor}`, borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Supervisor At-a-Glance · {reportType}
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>
                  {periodAdj} Report &nbsp;
                  <span style={{ color: '#6B7280', fontWeight: 600, fontSize: 15 }}>{dateLabel}</span>
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>Scope: {room}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Ward Status</div>
                <div style={{ padding: '8px 20px', borderRadius: 20, background: wardStatusBg, color: wardStatusColor, fontWeight: 900, fontSize: 16, border: `2px solid ${wardStatusColor}44` }}>
                  {wardStatus}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Key Findings — {periodAdj} Summary
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {keyFindings.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#374151' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: f.dot, flexShrink: 0, marginTop: 4 }} />
                      {f.text}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Supervisor Recommendations
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {recommendations.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#374151' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.dot, flexShrink: 0, marginTop: 4 }} />
                      {r.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats Row ────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {[
              { label: 'Total Patients',                value: totalPatients,    color: '#1E3A8A', icon: '👥' },
              { label: 'High Risk Patients',            value: highRiskPts.length, color: '#EF4444', icon: '🚨' },
              { label: `Total Alerts (${periodWord})`,  value: periodAlerts,     color: '#2563EB', icon: '🔔' },
              { label: `Falls (${periodWord})`,         value: periodFalls,      color: '#7C3AED', icon: '⬇' },
              { label: 'Avg Risk Score',                value: `${avgRisk}/100`, color: '#F59E0B', icon: '📊' },
            ].map(s => (
              <div key={s.label} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', borderTop: `3px solid ${s.color}`, textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Charts Row ───────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 14 }}>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 4 }}>
                Risk Score Trend {reportType === 'Monthly Report' ? '(Monthly)' : '(7 Days)'}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>Risk distribution by category over time</div>
              <LineChart data={lineData} width={340} height={180} />
              <div style={{ display: 'flex', gap: 14, marginTop: 10, justifyContent: 'center' }}>
                {[['High Risk','#EF4444'],['Moderate','#F59E0B'],['Low Risk','#14B8A6']].map(([l,c]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: c }} />
                    <span style={{ fontSize: 10, color: '#6B7280' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 4 }}>Risk Distribution</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>Current patient distribution — {room}</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <DonutChart segments={donutSegments} size={140} thickness={28} centerLabel={String(totalPatients)} centerSub="Patients" />
              </div>
              {donutSegments.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                  <span style={{ flex: 1, fontSize: 11, color: '#6B7280' }}>{s.label}</span>
                  <span style={{ fontWeight: 800, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 4 }}>Alert Distribution</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>
                {reportType === 'Monthly Report' ? 'Monthly alert volumes' : reportType === 'Weekly Report' ? 'Weekly alert volumes' : 'Alerts by risk level per day'}
              </div>
              <BarChart data={barData} width={280} height={140} />
              <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'center' }}>
                {[['Low','#16A34A'],['Moderate','#F59E0B'],['High','#EF4444']].map(([l,c]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                    <span style={{ fontSize: 10, color: '#6B7280' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Top Risk Patients ────────────────────────────────────────── */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', background: 'rgba(239,68,68,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#EF4444' }}>Top Risk Patients — Requires Attention</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Sorted by highest risk score · {periodAdj} snapshot</div>
              </div>
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Top {topRiskPatients.length} of {totalPatients}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Patient ID','Name','Room','Bed','Risk Level','Score','Status','Trend','Last Updated'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topRiskPatients.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 14px', color: '#1E3A8A', fontWeight: 700 }}>{p.id}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>{p.name}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{p.room}</td>
                    <td style={{ padding: '10px 14px', color: '#6B7280' }}>{p.bed}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: p.riskLevel === 'High Risk' ? 'rgba(239,68,68,0.1)' : p.riskLevel === 'Moderate Risk' ? 'rgba(245,158,11,0.1)' : 'rgba(20,184,166,0.1)',
                        color: p.riskLevel === 'High Risk' ? '#EF4444' : p.riskLevel === 'Moderate Risk' ? '#F59E0B' : '#14B8A6' }}>
                        {p.riskLevel}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontWeight: 900, fontSize: 15, color: scoreColor(p.riskScore) }}>{p.riskScore}</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>/100</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#374151' }}>{p.status}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 12,
                      color: p.trendChange > 0 ? '#EF4444' : p.trendChange < 0 ? '#14B8A6' : '#9CA3AF' }}>
                      {p.trendChange > 0 ? `↑ +${p.trendChange}` : p.trendChange < 0 ? `↓ ${p.trendChange}` : '→'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#9CA3AF' }}>{p.lastUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Room-wise Summary ────────────────────────────────────────── */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#111827' }}>Room-wise Summary</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{periodAdj} breakdown per room</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Room','Total Beds','Low Risk','Moderate Risk','High Risk','Active Alerts','Avg Score','Occupancy'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROOMS.map(r => {
                  const pts      = patients.filter(p => p.roomId === r.id)
                  const avgScore = pts.length ? Math.round(pts.reduce((s, p) => s + p.riskScore, 0) / pts.length) : 0
                  const occupancy = Math.round((r.bedsOccupied / r.totalBeds) * 100)
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>{r.name}</td>
                      <td style={{ padding: '12px 14px', color: '#374151' }}>{r.totalBeds}</td>
                      <td style={{ padding: '12px 14px', color: '#14B8A6', fontWeight: 700 }}>{pts.filter(p => p.riskLevel === 'Low Risk').length}</td>
                      <td style={{ padding: '12px 14px', color: '#F59E0B', fontWeight: 700 }}>{pts.filter(p => p.riskLevel === 'Moderate Risk').length}</td>
                      <td style={{ padding: '12px 14px', color: '#EF4444', fontWeight: 700 }}>{pts.filter(p => p.riskLevel === 'High Risk').length}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontWeight: 700 }}>{r.alerts}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: scoreColor(avgScore) }}>{avgScore}/100</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${occupancy}%`, background: '#1E3A8A', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{occupancy}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
