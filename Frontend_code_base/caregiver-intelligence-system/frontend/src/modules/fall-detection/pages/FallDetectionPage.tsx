import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FallTab } from '../types'
import { useFallStore } from '../store/useFallStore'
import { getStoredUser, clearStoredUser } from '../../../config/auth'
import { DashboardTab }    from '../components/tabs/DashboardTab'
import { RoomOverviewTab } from '../components/tabs/RoomOverviewTab'
import { AlertsRiskTab }   from '../components/tabs/AlertsRiskTab'
import { EventReplayTab }  from '../components/tabs/EventReplayTab'
import { ReportsTab }      from '../components/tabs/ReportsTab'
import { SettingsTab }     from '../components/tabs/SettingsTab'

// ─── Color palette ────────────────────────────────────────────────────────────
// #1E3A8A navy  #2563EB blue  #14B8A6 teal  #7C3AED purple  #1F2937 dark  #F3F4F6 light

const TABS: { id: FallTab; label: string; num: number; adminOnly?: boolean }[] = [
  { id: 'dashboard',    label: 'Dashboard',     num: 1 },
  { id: 'room-overview',label: 'Room Overview', num: 2 },
  { id: 'alerts-risk',  label: 'Alerts & Risk', num: 3 },
  { id: 'event-replay', label: 'Event Replay',  num: 4 },
  { id: 'reports',      label: 'Reports',       num: 5 },
  { id: 'settings',     label: 'Settings',      num: 6, adminOnly: true },
]

export function FallDetectionPage() {
  const [activeTab, setActiveTab] = useState<FallTab>('dashboard')
  const [now, setNow] = useState(new Date())
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [search, setSearch] = useState('')
  const [flashCritical, setFlashCritical] = useState(false)

  const { alerts, patients, startLive, lastUpdate, highAlertCount, initFromManifest, demoManifest } = useFallStore()
  const newAlertCount = alerts.filter(a => a.status === 'New').length

  // Load the backend manifest (real model output for 24 patients) once on mount.
  useEffect(() => { initFromManifest() }, [initFromManifest])

  const user = getStoredUser()
  const navigate = useNavigate()
  const handleLogout = () => { clearStoredUser(); navigate('/', { replace: true }) }
  const visibleTabs = TABS.filter(t => !t.adminOnly || user?.role === 'admin')

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Real-time data feed
  useEffect(() => {
    const stop = startLive()
    return stop
  }, [startLive])

  // Visual-only flash on new High Risk alert.
  // Audio cue is intentionally NOT on the supervisor web dashboard — per the
  // proposal, audio fires from the edge device in the patient's room, and
  // mobile notifications + vibration go to the caregiver's phone.
  // The supervisor is monitoring many patients at once and only needs visual cues.
  const prevHighCount = useRef(highAlertCount)
  useEffect(() => {
    if (highAlertCount > prevHighCount.current) {
      setFlashCritical(true)
      const t = setTimeout(() => setFlashCritical(false), 1500)
      prevHighCount.current = highAlertCount
      return () => clearTimeout(t)
    }
    prevHighCount.current = highAlertCount
  }, [highAlertCount])

  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  return (
    <div className="fall-detection-page flex flex-col min-h-full relative" style={{ background: '#F3F4F6', fontFamily: 'var(--font-sans)' }}>

      {/* ── Critical-alert flash overlay (full-screen pulse) ─────────────── */}
      {flashCritical && (
        <div className="fixed inset-0 pointer-events-none z-[200]"
          style={{
            background: 'radial-gradient(circle at center, rgba(239,68,68,0.0) 0%, rgba(239,68,68,0.18) 100%)',
            animation: 'critFlash 1.5s ease-out',
            boxShadow: 'inset 0 0 0 4px rgba(239,68,68,0.55)',
          }}>
          <style>{`@keyframes critFlash { 0% { opacity: 0 } 18% { opacity: 1 } 100% { opacity: 0 } }`}</style>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ background: 'white', borderBottom: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {/* Brand row */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl text-lg"
              style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)' }}>🦴</div>
            <div>
              <div className="font-black tracking-tight" style={{ color: '#111827', fontSize: 17 }}>FALL RISK MONITORING SYSTEM</div>
              <div className="font-medium mt-0.5 flex items-center gap-1" style={{ color: '#6B7280', fontSize: 13 }}>
                ⚡ Edge AI &nbsp;·&nbsp; 🔒 Privacy First
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Date */}
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#6B7280' }}>
              <span>📅</span>
              <span style={{ color: '#374151' }}>{dateStr}</span>
            </div>
            {/* Clock */}
            <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums" style={{ color: '#111827' }}>
              <span style={{ color: '#9CA3AF', fontSize: 13 }}>🕐</span>
              {timeStr}
            </div>
            {/* Bell */}
            <button onClick={() => setShowNotifPanel(p => !p)}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center text-base cursor-pointer"
              style={{ background: showNotifPanel ? 'rgba(30,58,138,0.06)' : '#F9FAFB', border: '1px solid #E5E7EB' }}>
              🔔
              {newAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-black"
                  style={{ background: '#EF4444', fontSize: 9 }}>
                  {Math.min(newAlertCount, 9)}
                </span>
              )}
            </button>
            {/* Logged-in user — role-aware label */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
              title={user ? `${user.name} · ${user.email}` : 'Not signed in'}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black"
                style={{ background: 'linear-gradient(135deg,#1E3A8A,#7C3AED)', fontSize: 12 }}>
                {user?.role === 'admin' ? 'A' : 'S'}
              </div>
              <div className="leading-tight">
                <div className="font-semibold" style={{ color: '#1F2937', fontSize: 13 }}>
                  {user?.name ?? 'Supervisor'}
                </div>
                <div className="uppercase tracking-wide" style={{ color: '#6B7280', fontSize: 10 }}>
                  {user?.role ?? 'Supervisor'}
                </div>
              </div>
            </div>
            <button onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
              style={{
                background: '#1E3A8A', color: 'white', border: 'none',
                fontSize: 13, letterSpacing: '0.02em',
              }}>
              Logout
            </button>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex items-center px-5">
          {visibleTabs.map(tab => {
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-5 py-3 cursor-pointer transition-all whitespace-nowrap"
                style={{
                  background: 'transparent', border: 'none',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#1E3A8A' : '#6B7280',
                  borderBottom: active ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
                  fontSize: 15,
                }}>
                <span className="w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] font-black transition-all"
                  style={{ background: active ? '#1E3A8A' : '#F3F4F6', color: active ? 'white' : '#9CA3AF' }}>
                  {tab.num}
                </span>
                {tab.label}
                {tab.id === 'alerts-risk' && newAlertCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-white font-black text-[10px]"
                    style={{ background: '#EF4444' }}>{newAlertCount}</span>
                )}
              </button>
            )
          })}

          <div className="ml-auto flex items-center gap-2 pl-4">
            {/* Search */}
            <div className="relative">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search Patient ID / Name..."
                className="py-1.5 pl-8 pr-3 rounded-lg outline-none"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', width: 240, color: '#111827', fontSize: 13 }} />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#9CA3AF' }}>🔍</span>
            </div>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-base"
              style={{ border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#6B7280' }} title="Filters">⚙</button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#6B7280', fontSize: 15 }}>↺</button>
          </div>
        </div>
      </header>

      {/* ── Notification panel ─────────────────────────────────────────── */}
      {showNotifPanel && (
        <div className="fixed top-24 right-5 w-80 z-50 rounded-2xl overflow-hidden"
          style={{ background: 'white', border: '1px solid #E5E7EB', boxShadow: '0 18px 44px rgba(15,23,42,0.18)' }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
            <span className="text-sm font-black" style={{ color: '#1F2937' }}>Notifications</span>
            <button onClick={() => setShowNotifPanel(false)} className="text-lg cursor-pointer" style={{ background: 'none', border: 'none', color: '#64748B' }}>×</button>
          </div>
          {alerts.slice(0, 6).map(a => (
            <div key={a.id} className="flex gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
              style={{ borderBottom: '1px solid #F3F4F6' }}>
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ background: a.riskLevel === 'High Risk' ? '#EF4444' : a.riskLevel === 'Moderate Risk' ? '#F59E0B' : '#14B8A6' }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate" style={{ color: '#1F2937' }}>{a.patientName} — {a.alertType}</div>
                <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{a.description}</div>
                <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{a.time}</div>
              </div>
              {a.status === 'New' && <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#EF4444' }} />}
            </div>
          ))}
          <div className="px-4 py-2.5 text-center">
            <button onClick={() => { setActiveTab('alerts-risk'); setShowNotifPanel(false) }}
              className="text-xs font-bold cursor-pointer" style={{ color: '#2563EB', background: 'none', border: 'none' }}>
              View All Alerts →
            </button>
          </div>
        </div>
      )}

      {/* ── Page content ──────────────────────────────────────────────── */}
      <main className="flex-1 p-5 overflow-x-hidden">
        {activeTab === 'dashboard'     && <DashboardTab    onNavigate={setActiveTab} />}
        {activeTab === 'room-overview' && <RoomOverviewTab />}
        {activeTab === 'alerts-risk'   && <AlertsRiskTab   />}
        {activeTab === 'event-replay'  && <EventReplayTab  />}
        {activeTab === 'reports'       && <ReportsTab      />}
        {activeTab === 'settings'      && (user?.role === 'admin'
          ? <SettingsTab />
          : <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1px solid #E5E7EB' }}>
              <div className="text-3xl mb-3">🔒</div>
              <div className="text-sm font-black mb-1" style={{ color: '#1F2937' }}>Admin access required</div>
              <div className="text-xs" style={{ color: '#6B7280' }}>System Settings are restricted to admin users.</div>
            </div>
        )}
      </main>

      {/* ── Test-set accuracy banner (real backend → frontend integration) ── */}
      {demoManifest && (
        <div className="flex items-center gap-4 px-5 py-2"
          style={{ background: '#0F172A', color: '#E2E8F0', borderTop: '1px solid #1E293B', fontSize: 12.5 }}>
          <span style={{ color: '#14B8A6', fontWeight: 800, letterSpacing: '0.08em' }}>● BACKEND INTEGRATED</span>
          <span style={{ color: '#94A3B8' }}>
            Held-out test set ({demoManifest.testSetSize} seqs · {demoManifest.evaluationProtocol})
          </span>
          {Object.entries(demoManifest.modelAccuracy).map(([model, acc]) => (
            <span key={model} style={{ color: '#94A3B8' }}>
              {model}: <b style={{ color: '#E2E8F0' }}>{(acc * 100).toFixed(2)}%</b>
            </span>
          ))}
          <span className="ml-auto" style={{ color: '#94A3B8' }}>
            Demo ward: <b style={{ color: '#10B981' }}>{demoManifest.correctCount}/{demoManifest.totalPatients}</b> patients correctly classified
          </span>
        </div>
      )}

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <footer className="flex items-center gap-4 px-5 py-2.5"
        style={{ background: 'white', borderTop: '1px solid #E5E7EB', fontSize: 12.5 }}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: '#14B8A6' }} />
          <span style={{ color: '#64748B' }}>AI Model: <b style={{ color: '#1F2937' }}>ST-GCN + Fusion Active</b></span>
        </div>
        <span style={{ color: '#64748B' }}>Test-set replay &nbsp;·&nbsp; <b style={{ color: '#2563EB' }}>25 FPS</b></span>
        <span style={{ color: '#64748B' }}>{patients.length} patients monitored</span>
        <span style={{ color: '#64748B' }}>Active alerts: <b style={{ color: '#EF4444' }}>{newAlertCount}</b></span>
        <span className="ml-auto" style={{ color: '#94A3B8' }}>
          Last sync: <b style={{ color: '#1F2937' }}>{lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</b>
        </span>
      </footer>
    </div>
  )
}
