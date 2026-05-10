import { Clock, Siren, Timer, UserRound, CheckCircle2, Filter, X, Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../../../shared/components/Button'
import type { AlertItem } from '../data/mockCareData'
import { alertsToday as mockAlertsToday } from '../data/mockCareData'
import { StatusBadge } from '../components/StatusBadge'
import { useVoiceLogUI } from '../components/VoiceLogLayout'
import { patients } from '../data/mockCareData'
import { api } from '../../../shared/services/api'
import { usePolling } from '../../../shared/hooks/usePolling'

export function AlertsPage() {
  const { branch } = useVoiceLogUI()
  const [typeFilter, setTypeFilter] = useState<'All' | string>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | 'New' | 'In Progress' | 'Resolved'>('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [localStatusById, setLocalStatusById] = useState<Record<string, AlertItem['status']>>({})

  const live = usePolling<{ alerts?: AlertItem[] }>(
    async ({ signal }) => {
      const res = await api.get('/voice-log/alerts', { params: { branch }, signal })
      return (res?.data ?? {}) as { alerts?: AlertItem[] }
    },
    { enabled: true, immediate: true, intervalMs: 12_000 },
  )

  const baseItems = live.data?.alerts?.length ? live.data.alerts : mockAlertsToday
  const items = useMemo(
    () => baseItems.map((a) => (localStatusById[a.id] ? { ...a, status: localStatusById[a.id]! } : a)),
    [baseItems, localStatusById],
  )

  const rows = useMemo(() => {
    const allowed =
      branch === 'All Branches'
        ? null
        : new Set(patients.filter((p) => p.branch === branch).map((p) => p.id))
    let out = items.filter((a) => (allowed ? allowed.has(a.patientId) : true))
    if (typeFilter !== 'All') out = out.filter((a) => a.type === typeFilter)
    if (statusFilter !== 'All') out = out.filter((a) => a.status === statusFilter)
    return out
  }, [branch, items, statusFilter, typeFilter])

  const typeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const a of items) set.add(a.type)
    return Array.from(set).sort()
  }, [items])

  const summary = useMemo(() => {
    const total = rows.length
    const by = (s: string) => rows.filter((r) => r.status === s).length
    return {
      total,
      newCount: by('New'),
      inProgress: by('In Progress'),
      resolved: by('Resolved'),
      avgResponse: '12m',
    }
  }, [rows])

  const selected = selectedId ? items.find((a) => a.id === selectedId) : null
  const selectedPatient = selected ? patients.find((p) => p.id === selected.patientId) : null

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Alerts</div>
          <div className="mt-1 text-sm vl-subtle">Manage care alerts and assignments for faster response.</div>
        </div>
        <Button className="vl-btn" variant="primary" size="sm" onClick={() => window.alert('Mock: Create alert')}>
          Create Alert
        </Button>
      </div>

      <div className="vl-card">
        <div className="vl-cardHeader">
          <div className="flex items-center gap-2">
            <span
              className="grid h-8 w-8 place-items-center rounded-xl border"
              style={{
                borderColor: 'rgba(15,23,42,0.10)',
                background: 'rgba(108,77,255,0.10)',
                color: 'var(--vl-primary)',
              }}
            >
              <Filter size={16} />
            </span>
            <div>
              <div className="vl-cardTitle">Filters</div>
              <div className="text-xs vl-subtle">Click an alert type chip to filter</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="vl-chip">
              <span className="text-[11px] font-bold" style={{ color: 'var(--vl-primary)' }}>
                Status
              </span>
              <select
                className="bg-transparent text-xs font-semibold outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as never)}
                aria-label="Status filter"
              >
                <option value="All">All</option>
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </span>
            <Button
              className="vl-btn"
              variant="ghost"
              size="sm"
              onClick={() => {
                setTypeFilter('All')
                setStatusFilter('All')
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="vl-cardBody">
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip label="All" active={typeFilter === 'All'} onClick={() => setTypeFilter('All')} />
            {typeOptions.map((t) => (
              <TypeChip key={t} label={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={<Siren size={18} />} title="Total alerts today" value={summary.total} tone="primary" />
        <SummaryCard icon={<Clock size={18} />} title="New" value={summary.newCount} tone="danger" />
        <SummaryCard icon={<Timer size={18} />} title="In progress" value={summary.inProgress} tone="warning" />
        <SummaryCard icon={<CheckCircle2 size={18} />} title="Resolved" value={summary.resolved} tone="success" />
        <SummaryCard icon={<Timer size={18} />} title="Avg response time" value={summary.avgResponse} tone="secondary" />
      </div>

      <div className="vl-tableScroll">
        <table className="min-w-[980px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs font-extrabold tracking-wide text-[rgba(15,23,42,0.55)]">
              {['Time', 'Patient ID', 'Alert type', 'Message', 'Status', 'Assigned to', 'Actions'].map((h) => (
                <th key={h} className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="bg-white transition hover:bg-[rgba(238,242,255,0.55)]">
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <span className="text-sm font-semibold">{a.time}</span>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <span className="text-sm font-extrabold">{a.patientId}</span>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <button
                    type="button"
                    className="vl-chip"
                    onClick={() => setTypeFilter(a.type)}
                    style={{ cursor: 'pointer' }}
                    title="Filter by this alert type"
                  >
                    {a.type}
                  </button>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <div className="max-w-[520px] text-sm font-medium text-[rgba(15,23,42,0.76)]">
                    {a.message}
                  </div>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <StatusBadge
                    label={a.status}
                    tone={a.status === 'New' ? 'danger' : a.status === 'In Progress' ? 'warn' : 'good'}
                    pulse={a.status === 'New'}
                  />
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <UserRound size={16} color="rgba(15,23,42,0.55)" />
                    {a.assignedTo}
                  </span>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button className="vl-btn" variant="secondary" size="sm" onClick={() => setSelectedId(a.id)}>
                      <span className="inline-flex items-center gap-2">
                        <Eye size={16} />
                        View
                      </span>
                    </Button>
                    <Button
                      className="vl-btn"
                      variant={a.status === 'Resolved' ? 'ghost' : 'primary'}
                      size="sm"
                      onClick={() => {
                        setLocalStatusById((prev) => ({ ...prev, [a.id]: 'Resolved' }))
                      }}
                      disabled={a.status === 'Resolved'}
                    >
                      Resolve
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm vl-subtle">
                  No alerts match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/30 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null)
          }}
        >
          <div className="vl-card w-full max-w-[920px]">
            <div className="vl-cardHeader">
              <div>
                <div className="vl-cardTitle">Alert details</div>
                <div className="text-xs vl-subtle">
                  {selected.id} • {selected.time} • {selectedPatient?.room ?? '—'}
                </div>
              </div>
              <Button className="vl-iconBtn" variant="secondary" onClick={() => setSelectedId(null)} aria-label="Close">
                <X size={18} />
              </Button>
            </div>
            <div className="vl-cardBody">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoRow label="Patient ID" value={selected.patientId} />
                <InfoRow label="Branch" value={selectedPatient?.branch ?? '—'} />
                <InfoRow label="Type" value={selected.type} />
                <InfoRow label="Severity" value={selected.severity} />
                <InfoRow label="Status" value={selected.status} />
                <InfoRow label="Assigned to" value={selected.assignedTo} />
              </div>
              <div className="mt-4 rounded-2xl border bg-white p-3 text-sm leading-6" style={{ borderColor: 'rgba(15,23,42,0.10)' }}>
                {selected.message}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="vl-chip" onClick={() => setTypeFilter(selected.type)}>
                    Filter by this type
                  </button>
                  <button type="button" className="vl-chip" onClick={() => setStatusFilter(selected.status as never)}>
                    Filter by this status
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    className="vl-btn"
                    variant="secondary"
                    size="sm"
                    onClick={() => window.alert('Mock: Assign alert')}
                  >
                    Reassign
                  </Button>
                  <Button
                    className="vl-btn"
                    variant={selected.status === 'Resolved' ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={selected.status === 'Resolved'}
                    onClick={() => {
                      setLocalStatusById((prev) => ({ ...prev, [selected.id]: 'Resolved' }))
                    }}
                  >
                    Mark Resolved
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TypeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="vl-chip"
      style={{
        cursor: 'pointer',
        background: active ? 'rgba(108,77,255,0.12)' : undefined,
        borderColor: active ? 'rgba(108,77,255,0.22)' : undefined,
        fontWeight: 700,
      }}
    >
      {label}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white px-3 py-2" style={{ borderColor: 'rgba(15,23,42,0.10)' }}>
      <div className="text-[11px] font-extrabold tracking-wide text-[rgba(15,23,42,0.55)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[rgba(15,23,42,0.82)]">{value}</div>
    </div>
  )
}

function SummaryCard({
  icon,
  title,
  value,
  tone,
}: {
  icon: React.ReactNode
  title: string
  value: string | number
  tone: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
}) {
  const map: Record<typeof tone, { bg: string; fg: string }> = {
    primary: { bg: 'rgba(108,77,255,0.12)', fg: 'var(--vl-primary)' },
    secondary: { bg: 'rgba(37,99,235,0.10)', fg: 'var(--vl-secondary)' },
    success: { bg: 'rgba(22,163,74,0.10)', fg: 'var(--vl-success)' },
    warning: { bg: 'rgba(249,115,22,0.12)', fg: 'var(--vl-warning)' },
    danger: { bg: 'rgba(239,68,68,0.10)', fg: 'var(--vl-danger)' },
  }
  const t = map[tone]

  return (
    <div className="vl-card">
      <div className="vl-cardBody">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-wide text-[rgba(15,23,42,0.64)]">{title}</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-[rgba(15,23,42,0.92)]">{value}</div>
          </div>
          <div
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border"
            style={{
              background: t.bg,
              borderColor: 'rgba(15, 23, 42, 0.08)',
              color: t.fg,
              boxShadow: '0 10px 22px rgba(2, 6, 23, 0.08)',
            }}
          >
            {icon}
          </div>
        </div>
      </div>
    </div>
  )
}

