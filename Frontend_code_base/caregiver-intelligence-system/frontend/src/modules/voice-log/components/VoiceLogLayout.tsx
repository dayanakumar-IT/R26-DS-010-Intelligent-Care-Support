import { Bell, Mic, Search, ChevronDown, Wifi } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../../shared/components/Button'
import { PatientAvatar } from './PatientAvatar'
import { MicRecorderPanel } from './MicRecorderPanel'
import type { Branch } from '../data/mockCareData'
import { alertsToday, patients } from '../data/mockCareData'
import { TopNavTabs } from './TopNavTabs'
import '../styles/voice-log.css'
import { api } from '../../../shared/services/api'
import { usePolling } from '../../../shared/hooks/usePolling'
import { getStoredUser } from '../../../config/auth'
import { AdminAvatarImg } from '../../../shared/components/AdminAvatar'

export type DesignMode = 'classic' | 'soft' | 'compact'

type VoiceLogUIState = {
  branch: Branch
  setBranch: (b: Branch) => void
  query: string
  setQuery: (q: string) => void
  design: DesignMode
  setDesign: (d: DesignMode) => void
  recorderOpen: boolean
  openRecorder: () => void
  closeRecorder: () => void
}

const VoiceLogUIContext = createContext<VoiceLogUIState | null>(null)

const fallbackUI: VoiceLogUIState = {
  branch: 'All Branches',
  setBranch: () => {},
  query: '',
  setQuery: () => {},
  design: 'classic',
  setDesign: () => {},
  recorderOpen: false,
  openRecorder: () => {},
  closeRecorder: () => {},
}

export function useVoiceLogUI() {
  const ctx = useContext(VoiceLogUIContext)
  // Defensive fallback: prevents runtime crash if a route renders outside the layout.
  return ctx ?? fallbackUI
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function VoiceLogLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const [branch, setBranch] = useState<Branch>(() => readLocal('vl.branch', 'All Branches'))
  const [query, setQuery] = useState('')
  const [design, setDesign] = useState<DesignMode>(() => readLocal('vl.design', 'classic'))
  const [recorderOpen, setRecorderOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem('vl.branch', JSON.stringify(branch))
  }, [branch])
  useEffect(() => {
    window.localStorage.setItem('vl.design', JSON.stringify(design))
  }, [design])

  // If parent navigation wants to open recorder, we can pass state:
  // navigate('/voice-log/dashboard', { state: { openRecorder: true } })
  useEffect(() => {
    const st = location.state as { openRecorder?: boolean } | null
    if (st?.openRecorder) {
      setRecorderOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const sessionUser = getStoredUser()
  const displayUserName = sessionUser?.name?.trim() || 'CareSense User'
  const isAdmin = sessionUser?.role === 'admin'

  const ctx: VoiceLogUIState = useMemo(
    () => ({
      branch,
      setBranch,
      query,
      setQuery,
      design,
      setDesign,
      recorderOpen,
      openRecorder: () => setRecorderOpen(true),
      closeRecorder: () => setRecorderOpen(false),
    }),
    [branch, query, design, recorderOpen],
  )

  const fallbackBadgeCount = (() => {
    const allowed =
      branch === 'All Branches'
        ? null
        : new Set(patients.filter((p) => p.branch === branch).map((p) => p.id))
    return alertsToday.filter((a) => (allowed ? allowed.has(a.patientId) : true)).filter((a) => a.status !== 'Resolved')
      .length
  })()

  const live = usePolling<{ badgeCount?: number }>(
    async ({ signal }) => {
      const res = await api.get('/voice-log/alerts/badge', { params: { branch }, signal })
      return (res?.data ?? {}) as { badgeCount?: number }
    },
    { enabled: true, immediate: true, intervalMs: 12_000 },
  )

  const badgeCount = Math.max(0, live.data?.badgeCount ?? fallbackBadgeCount)

  return (
    <VoiceLogUIContext.Provider value={ctx}>
      <div className="vl-root" data-vl-design={design}>
        {/* ── Sticky header ── */}
        <div
          className="sticky top-0 z-40"
          style={{
            background: design === 'soft'
              ? 'linear-gradient(135deg,rgba(124,58,237,0.07) 0%,rgba(30,58,138,0.05) 60%,rgba(255,255,255,0.88) 100%)'
              : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid rgba(15,23,42,0.07)',
            boxShadow: '0 2px 14px rgba(15,23,42,0.04)',
          }}
        >
          {/* thin top accent bar */}
          <div
            aria-hidden
            style={{
              height: 3,
              background: '#ffffff',
            }}
          />
          <div className="vl-container" style={{ paddingBottom: 0 }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5">
                  {/* brand mark */}
                  <div
                    className="relative grid h-10 w-10 place-items-center rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg,#7C3AED 0%,#1E3A8A 100%)',
                      boxShadow: '0 6px 18px rgba(124,58,237,0.30)',
                    }}
                  >
                    <span className="text-[13px] font-black tracking-tight text-white">CS</span>
                  </div>
                  <div className="leading-tight">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-extrabold tracking-tight" style={{ color: '#0F172A' }}>CareSense</div>
                      {/* live indicator — only shown when connected; hides on error */}
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: 'rgba(20,184,166,0.10)', borderColor: 'rgba(20,184,166,0.24)', color: '#0D9488' }}
                        title="Live polling status"
                      >
                        <span
                          style={{
                            width: 5, height: 5, borderRadius: 999,
                            background: '#14B8A6',
                            animation: 'vl-pulse 1.6s ease-out infinite',
                          }}
                        />
                        <Wifi size={11} />
                        {live.lastUpdatedAt ? 'Live' : 'Ready'}
                      </span>
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--vl-muted)' }}>
                      Voice Log{live.lastUpdatedAt ? ` · ${new Date(live.lastUpdatedAt).toLocaleTimeString()}` : ''}
                    </div>
                  </div>
                </div>

                <div className="hidden items-center gap-2 md:flex">
                  <div className="vl-chip">
                    <span className="text-[11px] font-bold" style={{ color: 'var(--vl-primary)' }}>
                      Branch
                    </span>
                    <select
                      className="bg-transparent text-xs font-semibold outline-none"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value as Branch)}
                      aria-label="Branch selector"
                    >
                      <option>All Branches</option>
                      <option>Female Branch</option>
                      <option>Male Branch</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 items-center justify-end gap-2">
                <div className="hidden max-w-[420px] flex-1 md:block">
                  <div
                    className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm"
                    style={{ borderColor: 'rgba(15,23,42,0.08)' }}
                  >
                    <Search size={16} color="rgba(15,23,42,0.55)" />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[rgba(15,23,42,0.38)]"
                      placeholder="Search patients, alerts, summaries…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <span className="vl-kbd shrink-0">Ctrl K</span>
                  </div>
                </div>

                <Button
                  className="vl-iconBtn"
                  variant="secondary"
                  onClick={() => navigate('/voice-log/alerts')}
                  aria-label="Notifications"
                >
                  <span className="relative inline-flex items-center">
                    <Bell size={18} />
                    {badgeCount > 0 ? (
                      <span
                        className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-extrabold text-white"
                        style={{
                          background: 'var(--vl-danger)',
                          boxShadow: '0 10px 22px rgba(239,68,68,0.22)',
                        }}
                      >
                        {badgeCount}
                      </span>
                    ) : null}
                  </span>
                </Button>

                <Button
                  className={['vl-iconBtn', recorderOpen ? 'vl-micPulse' : null].filter(Boolean).join(' ')}
                  variant="primary"
                  onClick={() => {
                    navigate('/voice-log/dashboard', { replace: false })
                    setRecorderOpen(true)
                  }}
                  aria-label="Open microphone"
                >
                  <Mic size={18} />
                </Button>

                <Button className="vl-btn" variant="ghost" onClick={() => navigate('/voice-log/settings')}>
                  <span className="inline-flex items-center gap-2">
                    {isAdmin ? (
                      <AdminAvatarImg size={34} />
                    ) : (
                      <PatientAvatar name={displayUserName} gender="Female" size={34} />
                    )}
                    <span className="hidden text-sm font-semibold md:inline">{displayUserName}</span>
                    <ChevronDown size={16} />
                  </span>
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 md:hidden">
                <div className="vl-chip">
                  <span className="text-[11px] font-bold" style={{ color: 'var(--vl-primary)' }}>
                    Branch
                  </span>
                  <select
                    className="bg-transparent text-xs font-semibold outline-none"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value as Branch)}
                    aria-label="Branch selector mobile"
                  >
                    <option>All Branches</option>
                    <option>Female Branch</option>
                    <option>Male Branch</option>
                  </select>
                </div>
                <div className="flex-1">
                  <div
                    className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm"
                    style={{ borderColor: 'rgba(15,23,42,0.08)' }}
                  >
                    <Search size={16} color="rgba(15,23,42,0.55)" />
                    <input
                      className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[rgba(15,23,42,0.38)]"
                      placeholder="Search…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <TopNavTabs />
            </div>
          </div>
        </div>

        <div className="vl-container" style={{ background: 'var(--vl-bg)', paddingTop: 24 }}>
          <Outlet />
        </div>

        <MicRecorderPanel
          open={recorderOpen}
          onClose={() => setRecorderOpen(false)}
          patient={patients.find((p) => p.id === 'P008')}
        />
      </div>
    </VoiceLogUIContext.Provider>
  )
}

