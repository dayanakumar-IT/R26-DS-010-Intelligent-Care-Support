import {
  Baby,
  Calendar,
  ClipboardList,
  Coffee,
  CupSoda,
  Droplets,
  Filter,
  HeartHandshake,
  PersonStanding,
  Pill,
  Printer,
  Thermometer,
  UserCheck,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../../../shared/components/Button'
import { DownloadButton } from '../components/DownloadButton'
import { StatusBadge } from '../components/StatusBadge'
import { adlReports, patients } from '../data/mockCareData'
import { useEffect, useMemo, useState } from 'react'
import type { Patient, ADLReport } from '../data/mockCareData'

/* ── icon + colour palette per ADL activity ─────────────── */
type IconMeta = { icon: LucideIcon; color: string; bg: string }

const ADL_ICONS: Partial<Record<string, IconMeta>> = {
  'Hygiene':                    { icon: Droplets,       color: '#0D9488', bg: 'rgba(20,184,166,0.13)'  },
  'Breakfast':                  { icon: Coffee,         color: '#D97706', bg: 'rgba(245,158,11,0.13)'  },
  'Medication after breakfast': { icon: Pill,           color: '#7C3AED', bg: 'rgba(124,58,237,0.13)'  },
  'Lunch':                      { icon: Utensils,       color: '#16A34A', bg: 'rgba(22,163,74,0.13)'   },
  'Tea':                        { icon: CupSoda,        color: '#F97316', bg: 'rgba(249,115,22,0.13)'  },
  'Dinner':                     { icon: UtensilsCrossed,color: '#1E3A8A', bg: 'rgba(30,58,138,0.13)'   },
  'Mobility':                   { icon: PersonStanding, color: '#2563EB', bg: 'rgba(37,99,235,0.13)'   },
  'Diaper Change':              { icon: Baby,           color: '#9333EA', bg: 'rgba(147,51,234,0.13)'  },
  'Symptoms':                   { icon: Thermometer,    color: '#EF4444', bg: 'rgba(239,68,68,0.13)'   },
  'Emotional Observations':     { icon: HeartHandshake, color: '#EC4899', bg: 'rgba(236,72,153,0.13)'  },
}

/* accent colour for the left-side tone border */
const TONE_ACCENT: Record<string, string> = {
  good:    '#16A34A',
  warn:    '#F97316',
  neutral: '#94A3B8',
}

/* ── print-preview helper ────────────────────────────────── */
function openADLPrintPreview(r: ADLReport, patient: Patient | undefined) {
  const win = window.open('', '_blank', 'width=820,height=700')
  if (!win) { window.alert('Pop-up blocked — please allow pop-ups for this site.'); return }

  const rows = r.items
    .map((i) => `<tr><td>${i.label}</td><td>${i.value}</td><td>${i.tone === 'good' ? '✅ OK' : i.tone === 'warn' ? '⚠️ Watch' : '📝 Note'}</td></tr>`)
    .join('')

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ADL Report — ${r.patientId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #0F172A; padding: 48px 56px; max-width: 720px; margin: 0 auto; }
    .brand  { font-size: 22px; font-weight: 800; color: #1E3A8A; }
    .brand span { color: #7C3AED; }
    .tagline { font-size: 12px; color: #64748B; margin-top: 2px; }
    hr  { border: none; border-top: 2px solid #1E3A8A; margin: 20px 0; }
    h2  { font-size: 16px; font-weight: 700; margin-bottom: 14px; color: #1E3A8A; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13px; }
    th  { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
          color: #64748B; background: #F8FAFC; padding: 8px 12px; border-bottom: 1px solid #E2E8F0; }
    td  { padding: 9px 12px; border-bottom: 1px solid #F1F5F9; }
    td:first-child { font-weight: 600; color: #475569; }
    .notes { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; font-size: 13px; line-height: 1.7; }
    .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; display: flex; justify-content: space-between; }
    .actions { margin-top: 28px; display: flex; gap: 10px; }
    .btn { padding: 10px 22px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary   { background: #1E3A8A; color: #fff; }
    .btn-secondary { background: #F1F5F9; color: #1E3A8A; border: 1px solid #E2E8F0; }
    @media print { .actions { display: none; } body { padding: 24px 32px; } }
  </style>
</head>
<body>
  <div class="brand">Care<span>Sense</span></div>
  <div class="tagline">Intelligent Care Support — ADL Report</div>
  <hr />
  <h2>Patient Details</h2>
  <table>
    <thead><tr><th>Field</th><th colspan="2">Value</th></tr></thead>
    <tbody>
      <tr><td>Patient ID</td><td colspan="2"><strong>${r.patientId}</strong></td></tr>
      ${patient ? `<tr><td>Patient Name</td><td colspan="2">${patient.name}</td></tr>` : ''}
      <tr><td>Date</td><td colspan="2">${r.date}</td></tr>
      <tr><td>Submitted By</td><td colspan="2">${r.submittedBy} at ${r.submittedAt}</td></tr>
      <tr><td>Status</td><td colspan="2">${r.reviewed ? '✅ Reviewed' : '⏳ Pending'}</td></tr>
      ${r.reviewedBy ? `<tr><td>Reviewed By</td><td colspan="2">${r.reviewedBy}</td></tr>` : ''}
    </tbody>
  </table>
  <h2>ADL Items</h2>
  <table>
    <thead><tr><th>Activity</th><th>Value</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>Notes</h2>
  <div class="notes">${r.notes.replace(/</g, '&lt;')}</div>
  <div class="footer">
    <span>Generated by CareSense</span>
    <span>${new Date().toLocaleString()}</span>
  </div>
  <div class="actions">
    <button class="btn btn-primary" onclick="window.print()">🖨&nbsp; Print / Save as PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">Close</button>
  </div>
</body>
</html>`)
  win.document.close()
}

/* ── page component ──────────────────────────────────────── */
export function ADLReportsPage() {
  const [patientId,   setPatientId]   = useState<'All' | string>('All')
  const [selectedDate, setSelectedDate] = useState('2026-03-01')
  const [selectedId,   setSelectedId]   = useState(adlReports[0]!.id)

  const filtered = useMemo(() => {
    return adlReports.filter((r) => {
      if (patientId !== 'All' && r.patientId !== patientId) return false
      if (selectedDate && r.date !== selectedDate) return false
      return true
    })
  }, [patientId, selectedDate])

  useEffect(() => {
    if (!filtered.some((r) => r.id === selectedId) && filtered[0]) setSelectedId(filtered[0].id)
  }, [filtered, selectedId])

  const r       = filtered.find((x) => x.id === selectedId) ?? filtered[0] ?? adlReports[0]!
  const patient = patients.find((p) => p.id === r.patientId)

  const csv = [
    ['Field', 'Value'].join(','),
    ...r.items.map((i) => [i.label, i.value].map(csvEscape).join(',')),
    ['Notes', r.notes].map(csvEscape).join(','),
  ].join('\n')

  return (
    <div className="grid gap-4">
      {/* ── page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">ADL Reports</div>
          <div className="mt-1 text-sm vl-subtle">Filter by patient and date (March 2026).</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* PDF — opens printable preview */}
          <Button
            className="vl-btn"
            variant="primary"
            size="sm"
            onClick={() => openADLPrintPreview(r, patient)}
            title="Opens a print-ready report — use Print → Save as PDF"
          >
            <span className="inline-flex items-center gap-2">
              <Printer size={16} />
              Export PDF
            </span>
          </Button>
          <DownloadButton
            filename={`adl-report-${r.patientId}.csv`}
            label="Download CSV"
            getContent={() => ({ mime: 'text/csv', text: csv })}
            variant="secondary"
          />
        </div>
      </div>

      {/* ── filters ── */}
      <div className="vl-card">
        <div className="vl-cardHeader">
          <div className="flex items-center gap-2">
            <span
              className="grid h-8 w-8 place-items-center rounded-xl border"
              style={{ borderColor: 'rgba(15,23,42,0.10)', background: 'rgba(124,58,237,0.10)', color: 'var(--vl-primary)' }}
            >
              <Filter size={16} />
            </span>
            <div>
              <div className="vl-cardTitle">Filters</div>
              <div className="text-xs vl-subtle">Patient ID + date (March 2026)</div>
            </div>
          </div>
          <span className="vl-chip">
            <Calendar size={14} />
            {filtered.length} results
          </span>
        </div>
        <div className="vl-cardBody">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-[rgba(15,23,42,0.70)]">
              Patient ID
              <select
                className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="All">All</option>
                {patients.map((p) => p.id).sort().map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-[rgba(15,23,42,0.70)]">
              Date
              <input
                type="date"
                min="2026-03-01"
                max="2026-03-31"
                className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── main split: list + detail ── */}
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">

        {/* reports list */}
        <div className="vl-card">
          <div className="vl-cardHeader">
            <div className="vl-cardTitle">Reports list</div>
            <span className="vl-chip">{filtered.length}</span>
          </div>
          <div className="vl-cardBody">
            <div className="vl-tableScroll" style={{ borderRadius: 14 }}>
              <table className="min-w-[520px] w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs font-extrabold tracking-wide text-[rgba(15,23,42,0.55)]">
                    {['Patient', 'Date', 'Status', 'Reviewer'].map((h) => (
                      <th key={h} className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.08)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      className={[
                        'cursor-pointer bg-white transition',
                        row.id === selectedId ? 'bg-[rgba(238,242,255,0.75)]' : 'hover:bg-[rgba(238,242,255,0.55)]',
                      ].join(' ')}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                        <div className="text-sm font-extrabold">{row.patientId}</div>
                        <div className="text-xs vl-subtle">{row.submittedBy}</div>
                      </td>
                      <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                        <div className="text-sm font-semibold">{row.date}</div>
                        <div className="text-xs vl-subtle">{row.submittedAt}</div>
                      </td>
                      <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                        {row.reviewed
                          ? <StatusBadge label="Reviewed" tone="good" />
                          : <StatusBadge label="Pending"  tone="warn" pulse />}
                      </td>
                      <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[rgba(15,23,42,0.72)]">
                          <UserCheck size={14} />
                          {row.reviewedBy ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm vl-subtle">
                        No reports match your filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* report detail */}
        <div className="vl-card">
          <div className="vl-cardHeader">
            <div className="flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-xl border"
                style={{ borderColor: 'rgba(15,23,42,0.10)', background: 'rgba(124,58,237,0.10)', color: 'var(--vl-primary)' }}
              >
                <ClipboardList size={16} />
              </span>
              <div>
                <div className="vl-cardTitle">Report for {r.patientId}</div>
                <div className="text-xs vl-subtle">
                  {r.date} • Submitted by <span className="font-semibold">{r.submittedBy}</span> at {r.submittedAt}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {r.reviewed
                ? <StatusBadge label="Reviewed" tone="good" />
                : <StatusBadge label="Pending"  tone="warn" pulse />}
              <span className="vl-chip">
                <UserCheck size={14} />
                {r.reviewedBy ?? '—'}
              </span>
            </div>
          </div>

          <div className="vl-cardBody">
            <div className="grid gap-3 md:grid-cols-2">
              {r.items.map((item) => {
                const meta  = ADL_ICONS[item.label]
                const Icon  = meta?.icon
                const accent = TONE_ACCENT[item.tone ?? 'neutral'] ?? TONE_ACCENT.neutral

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border bg-white p-4 transition-shadow hover:shadow-md"
                    style={{
                      borderColor: 'rgba(15,23,42,0.09)',
                      borderLeft: `3px solid ${accent}`,
                    }}
                  >
                    {/* header row: icon + label + badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {Icon && (
                          <div
                            className="grid shrink-0 place-items-center rounded-xl"
                            style={{ width: 34, height: 34, background: meta.bg, color: meta.color }}
                          >
                            <Icon size={17} strokeWidth={2} />
                          </div>
                        )}
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[rgba(15,23,42,0.65)]">
                          {item.label}
                        </span>
                      </div>
                      <StatusBadge
                        label={item.tone === 'good' ? 'OK' : item.tone === 'warn' ? 'Watch' : 'Note'}
                        tone={item.tone ?? 'neutral'}
                        pulse={item.tone === 'warn'}
                      />
                    </div>

                    {/* value */}
                    <div
                      className="mt-2.5 text-sm font-semibold text-[rgba(15,23,42,0.84)]"
                      style={{ paddingLeft: Icon ? 46 : 0 }}
                    >
                      {item.value}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* notes */}
            <div
              className="mt-4 rounded-2xl border bg-white p-4"
              style={{ borderColor: 'rgba(15,23,42,0.09)', borderLeft: '3px solid #7C3AED' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="grid place-items-center rounded-xl"
                  style={{ width: 34, height: 34, background: 'rgba(124,58,237,0.10)', color: '#7C3AED' }}
                >
                  <ClipboardList size={17} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[rgba(15,23,42,0.65)]">
                  Notes
                </span>
              </div>
              <div className="text-sm leading-6 text-[rgba(15,23,42,0.82)]" style={{ paddingLeft: 46 }}>
                {r.notes}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function csvEscape(v: string) {
  const s = String(v ?? '')
  if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}
