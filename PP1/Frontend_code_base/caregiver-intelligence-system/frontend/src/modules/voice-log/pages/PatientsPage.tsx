import { Plus, SlidersHorizontal, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../shared/components/Button'
import type { Patient } from '../data/mockCareData'
import { patients as mockPatients } from '../data/mockCareData'
import { PatientAvatar } from '../components/PatientAvatar'
import { StatusBadge } from '../components/StatusBadge'
import { useVoiceLogUI } from '../components/VoiceLogLayout'
import { api } from '../../../shared/services/api'
import { usePolling } from '../../../shared/hooks/usePolling'

type AlertFilter = 'All' | 'None' | 'New' | 'Monitoring'

export function PatientsPage() {
  const navigate = useNavigate()
  const { branch, query, setQuery } = useVoiceLogUI()

  const [gender, setGender] = useState<'All' | 'Female' | 'Male'>('All')
  const [condition, setCondition] = useState('All')
  const [alert, setAlert] = useState<AlertFilter>('All')

  const [page, setPage] = useState(1)
  const pageSize = 8

  const live = usePolling<{ patients?: Patient[] }>(
    async ({ signal }) => {
      const res = await api.get('/voice-log/patients', { params: { branch }, signal })
      return (res?.data ?? {}) as { patients?: Patient[] }
    },
    { enabled: true, immediate: true, intervalMs: 12_000 },
  )

  const patients = live.data?.patients?.length ? live.data.patients : mockPatients

  const conditionOptions = useMemo(() => {
    const s = new Set<string>()
    for (const p of patients) for (const c of p.conditions) s.add(c)
    return ['All', ...Array.from(s).sort()]
  }, [patients])

  const filtered = useMemo(() => {
    let list: Patient[] = patients
    // Branch filter is bypassed when a specific gender is selected,
    // because Female Branch ↔ Female and Male Branch ↔ Male are one-to-one.
    // Applying both simultaneously would always yield zero cross-branch results.
    if (branch !== 'All Branches' && gender === 'All') {
      list = list.filter((p) => p.branch === branch)
    }
    if (gender !== 'All') list = list.filter((p) => p.gender === gender)
    if (condition !== 'All') list = list.filter((p) => p.conditions.includes(condition))
    if (alert !== 'All') list = list.filter((p) => p.alertStatus === alert)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.room.toLowerCase().includes(q),
      )
    }
    return list
  }, [alert, branch, condition, gender, patients, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Patients</div>
          <div className="mt-1 text-sm vl-subtle">
            Search, filter, and open patient profiles for ADL + handover details.
          </div>
        </div>
        <Button className="vl-btn" variant="primary" size="sm" onClick={() => window.alert('Mock: Add Patient')}>
          <span className="inline-flex items-center gap-2">
            <Plus size={16} />
            Add Patient
          </span>
        </Button>
      </div>

      <div className="vl-card">
        <div className="vl-cardHeader">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} color="rgba(15,23,42,0.55)" />
            <div>
              <div className="vl-cardTitle">Filters</div>
              <div className="text-xs vl-subtle">Branch uses top selector. Others below.</div>
            </div>
          </div>
          <span className="vl-chip">
            <Search size={14} />
            <input
              className="bg-transparent text-xs font-semibold outline-none placeholder:text-[rgba(15,23,42,0.40)]"
              placeholder="Search by ID / name / room"
              value={query}
              onChange={(e) => {
                setPage(1)
                setQuery(e.target.value)
              }}
            />
          </span>
        </div>
        <div className="vl-cardBody">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-xs font-semibold text-[rgba(15,23,42,0.70)]">
              Gender
              <select
                className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                value={gender}
                onChange={(e) => {
                  setPage(1)
                  setGender(e.target.value as never)
                }}
              >
                <option>All</option>
                <option>Female</option>
                <option>Male</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-[rgba(15,23,42,0.70)]">
              Condition
              <select
                className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                value={condition}
                onChange={(e) => {
                  setPage(1)
                  setCondition(e.target.value)
                }}
              >
                {conditionOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-[rgba(15,23,42,0.70)]">
              Alert status
              <select
                className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                value={alert}
                onChange={(e) => {
                  setPage(1)
                  setAlert(e.target.value as never)
                }}
              >
                <option>All</option>
                <option>None</option>
                <option>New</option>
                <option>Monitoring</option>
              </select>
            </label>

            <div className="grid gap-1 text-xs font-semibold text-[rgba(15,23,42,0.70)]">
              Results
              <div className="flex items-center justify-between rounded-2xl border bg-white px-3 py-2" style={{ borderColor: 'rgba(15,23,42,0.10)' }}>
                <span className="text-sm font-semibold">{filtered.length}</span>
                <span className="text-xs vl-subtle">patients</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="vl-tableScroll">
        <table className="min-w-[920px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs font-extrabold tracking-wide text-[rgba(15,23,42,0.55)]">
              {['Patient', 'Branch', 'Gender', 'Room', 'Conditions', 'Alert', 'Actions'].map((h) => (
                <th key={h} className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer bg-white transition hover:bg-[rgba(238,242,255,0.55)]"
                onClick={() => navigate(`/voice-log/patients/${p.id}`)}
              >
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <PatientAvatar name={p.name} gender={p.gender} size={40} />
                    <div className="leading-tight">
                      <div className="text-sm font-extrabold tracking-tight">{p.id}</div>
                      <div className="text-xs vl-subtle">{p.name}</div>
                    </div>
                  </div>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <span className="text-sm font-semibold">{p.branch}</span>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <span className="text-sm font-semibold">{p.gender}</span>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <span className="text-sm font-semibold">{p.room}</span>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <div className="flex flex-wrap gap-2">
                    {p.conditions.slice(0, 2).map((c) => (
                      <span key={c} className="vl-chip">
                        {c}
                      </span>
                    ))}
                    {p.conditions.length > 2 ? (
                      <span className="vl-chip">+{p.conditions.length - 2}</span>
                    ) : null}
                  </div>
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <StatusBadge
                    label={p.alertStatus}
                    tone={
                      p.alertStatus === 'New'
                        ? 'danger'
                        : p.alertStatus === 'Monitoring'
                          ? 'warn'
                          : 'neutral'
                    }
                    pulse={p.alertStatus === 'New'}
                  />
                </td>
                <td className="border-b px-4 py-3" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      className="vl-btn"
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/voice-log/patients/${p.id}`)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Eye size={16} />
                        View
                      </span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm vl-subtle">
                  No patients match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm vl-subtle">
          Page <span className="font-semibold text-[rgba(15,23,42,0.78)]">{safePage}</span> of{' '}
          <span className="font-semibold text-[rgba(15,23,42,0.78)]">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="vl-iconBtn"
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
            disabled={safePage <= 1}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            className="vl-iconBtn"
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
            disabled={safePage >= totalPages}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  )
}

