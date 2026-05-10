import {
  Users,
  Bed,
  Sparkles,
  Heart,
  HeartPulse,
  UserRoundCheck,
  Stethoscope,
  Building2,
  FileText,
  CheckCircle,
  Droplets,
  ClipboardCheck,
  Pill,
} from 'lucide-react'
import { Button } from '../../../shared/components/Button'
import { organizationStats } from '../data/mockCareData'
import { BranchDistributionChart } from '../components/BranchDistributionChart'
import { MiniTrend } from '../components/MiniTrend'
import { StatCard } from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'
import { useVoiceLogUI } from '../components/VoiceLogLayout'
import { DownloadButton } from '../components/DownloadButton'
import { api } from '../../../shared/services/api'
import { usePolling } from '../../../shared/hooks/usePolling'

export function DashboardPage() {
  const { branch, design, setDesign, openRecorder } = useVoiceLogUI()

  const femaleBase = organizationStats.femaleResidents
  const maleBase = organizationStats.maleResidents

  const fallbackFemaleCount = branch === 'Male Branch' ? 0 : femaleBase
  const fallbackMaleCount = branch === 'Female Branch' ? 0 : maleBase
  const fallbackTotalPatients =
    branch === 'All Branches' ? organizationStats.totalPatients : fallbackFemaleCount + fallbackMaleCount

  const fallbackRoomsFemale = branch === 'Male Branch' ? 0 : organizationStats.rooms.female
  const fallbackRoomsMale = branch === 'Female Branch' ? 0 : organizationStats.rooms.male
  const fallbackRoomsTotal =
    branch === 'All Branches' ? organizationStats.rooms.total : fallbackRoomsFemale + fallbackRoomsMale

  const fallbackActiveAlerts = branch === 'All Branches' ? 6 : branch === 'Female Branch' ? 3 : 3
  const fallbackPendingReviews = branch === 'All Branches' ? 5 : branch === 'Female Branch' ? 2 : 3
  const fallbackTodaysReports = fallbackTotalPatients
  const fallbackCompletedDailyLogs = fallbackTotalPatients

  type LiveStats = {
    totalPatients: number
    femaleCount: number
    maleCount: number
    roomsFemale: number
    roomsMale: number
    roomsTotal: number
    caregivers: number
    doctors: number
    nurses: number
    activeAlerts: number
    pendingReviews: number
    todaysReports: number
    completedDailyLogs: number
  }

  const live = usePolling<Partial<LiveStats>>(
    async ({ signal }) => {
      const res = await api.get('/voice-log/stats', { params: { branch }, signal })
      return (res?.data ?? {}) as Partial<LiveStats>
    },
    { enabled: true, immediate: true, intervalMs: 12_000 },
  )

  const femaleCount = live.data?.femaleCount ?? fallbackFemaleCount
  const maleCount = live.data?.maleCount ?? fallbackMaleCount
  const totalPatients = live.data?.totalPatients ?? fallbackTotalPatients

  const roomsFemale = live.data?.roomsFemale ?? fallbackRoomsFemale
  const roomsMale = live.data?.roomsMale ?? fallbackRoomsMale
  const roomsTotal = live.data?.roomsTotal ?? fallbackRoomsTotal

  const caregivers = live.data?.caregivers ?? organizationStats.caregivers
  const doctors = live.data?.doctors ?? organizationStats.doctors
  const nurses = live.data?.nurses ?? organizationStats.nurses

  const activeAlerts = live.data?.activeAlerts ?? fallbackActiveAlerts
  const pendingReviews = live.data?.pendingReviews ?? fallbackPendingReviews
  const todaysReports = live.data?.todaysReports ?? fallbackTodaysReports
  const completedDailyLogs = live.data?.completedDailyLogs ?? fallbackCompletedDailyLogs

  return (
    <div className="grid gap-5">
      {/* ── Page header ── */}
      <div
        className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border p-5"
        style={{
          background: 'linear-gradient(135deg,rgba(124,58,237,0.06) 0%,rgba(30,58,138,0.04) 60%,rgba(255,255,255,0) 100%)',
          borderColor: 'rgba(124,58,237,0.12)',
        }}
      >
        <div>
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#1E3A8A)', boxShadow: '0 4px 14px rgba(124,58,237,0.30)' }}
            >
              <Sparkles size={18} color="white" />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>Voice Log Overview</div>
              <div className="mt-0.5 text-[13px]" style={{ color: 'var(--vl-muted)' }}>
                Voice-driven ADL capture, alerts, and handover summaries.
              </div>
            </div>
          </div>
          {/* live badge */}
          {live.lastUpdatedAt ? (
            <div className="mt-3 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                style={{ background: 'rgba(20,184,166,0.09)', borderColor: 'rgba(20,184,166,0.22)', color: '#0D9488' }}
              >
                <span style={{ width: 5, height: 5, borderRadius: 999, background: '#14B8A6', display: 'inline-block', animation: 'vl-pulse 1.6s ease-out infinite' }} />
                {`Live · ${new Date(live.lastUpdatedAt).toLocaleTimeString()}`}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="vl-chip">
            <Sparkles size={13} color="var(--vl-primary)" />
            <span className="text-[11px] font-bold">Design</span>
            <select
              className="bg-transparent text-xs font-semibold outline-none"
              value={design}
              onChange={(e) => setDesign(e.target.value as never)}
              aria-label="Design mode selector"
            >
              <option value="classic">Classic Clinical</option>
              <option value="soft">Modern Soft Gradient</option>
              <option value="compact">Compact Admin</option>
            </select>
          </div>

          <Button className="vl-btn" variant="primary" size="sm" onClick={openRecorder}>
            <span className="inline-flex items-center gap-2">
              <Pill size={14} />
              Start Voice Log
            </span>
          </Button>

          <DownloadButton
            variant="secondary"
            filename="caresense-dashboard-export.txt"
            label="Export"
            getContent={() => ({
              mime: 'text/plain',
              text: [
                'CareSense Voice Log Dashboard Export',
                `Branch: ${branch}`,
                `Total patients: ${totalPatients}`,
                `Female residents: ${femaleCount}`,
                `Male residents: ${maleCount}`,
                `Rooms: ${roomsTotal} (Female ${roomsFemale}, Male ${roomsMale})`,
                `Active alerts: ${activeAlerts}`,
                `ADL reports today: ${todaysReports}`,
                `Pending reviews: ${pendingReviews}`,
              ].join('\n'),
            })}
          />
        </div>
      </div>

      {/* ── Stats section label ── */}
      <div className="flex items-center gap-3">
        <div style={{ width: 4, height: 20, borderRadius: 4, background: 'linear-gradient(180deg,#7C3AED,#1E3A8A)', flexShrink: 0 }} aria-hidden />
        <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--vl-muted)' }}>
          Organisation overview
        </span>
      </div>

      <div className="voice-dashboard-grid">
        {/* Row 1 */}
        <div className="vl-span-3">
          <StatCard title="Total Patients" value={totalPatients} icon={<Users size={18} />} accent="purple" />
        </div>
        <div className="vl-span-3">
          <StatCard title="Female Residents" value={femaleCount} icon={<Heart size={18} />} accent="pink" />
        </div>
        <div className="vl-span-3">
          <StatCard title="Male Residents" value={maleCount} icon={<HeartPulse size={18} />} accent="blue" />
        </div>
        <div className="vl-span-3">
          <StatCard
            title="Total Rooms"
            value={roomsTotal}
            subtitle={`${roomsFemale} female rooms + ${roomsMale} male rooms`}
            icon={<Bed size={18} />}
            accent="purple"
          />
        </div>

        {/* Row 2 */}
        <div className="vl-span-3">
          <StatCard title="Caregivers" value={caregivers} icon={<UserRoundCheck size={18} />} accent="purple" />
        </div>
        <div className="vl-span-3">
          <StatCard title="Doctors" value={doctors} icon={<Stethoscope size={18} />} accent="blue" />
        </div>
        <div className="vl-span-3">
          <StatCard title="Nurses" value={nurses} icon={<HeartPulse size={18} />} accent="pink" />
        </div>
        <div className="vl-span-3">
          <StatCard
            title="Branch Rooms"
            value={`${roomsFemale}F / ${roomsMale}M`}
            subtitle="Female rooms / Male rooms"
            icon={<Building2 size={18} />}
            accent="neutral"
          />
        </div>

        {/* ── Analytics label row ── */}
        <div className="vl-span-12 flex items-center gap-3">
          <div style={{ width: 4, height: 20, borderRadius: 4, background: 'linear-gradient(180deg,#7C3AED,#14B8A6)', flexShrink: 0 }} aria-hidden />
          <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--vl-muted)' }}>
            Live analytics
          </span>
        </div>

        {/* Row 3 */}
        <div className="vl-span-4">
          <div className="vl-dashCard vl-analyticsCard">
            <div className="vl-dashCardHeader">
              <div>
                <div className="vl-dashTitle">Alerts Snapshot</div>
                <div className="vl-dashSubtle">Trend (mock) + active count</div>
              </div>
              <StatusBadge
                label={`${activeAlerts} Active`}
                tone={activeAlerts >= 5 ? 'danger' : 'warn'}
                pulse={activeAlerts >= 5}
              />
            </div>
            <div className="vl-dashCardBody">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[28px] font-extrabold leading-none tracking-tight text-[#0F172A]">
                    {activeAlerts}
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-[#64748B]">
                    New + monitoring across selected branch
                  </div>
                </div>
                <MiniTrend points={[2, 5, 3, 6, 4, 7, 6]} tone={activeAlerts >= 5 ? 'danger' : 'warning'} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <MiniKpi label="New" value={Math.max(0, Math.round(activeAlerts * 0.4))} />
                <MiniKpi label="In Progress" value={Math.max(0, Math.round(activeAlerts * 0.35))} />
                <MiniKpi label="Resolved" value={Math.max(0, Math.round(activeAlerts * 0.25))} />
              </div>
            </div>
          </div>
        </div>

        <div className="vl-span-4">
          <div className="vl-dashCard vl-analyticsCard">
            <div className="vl-dashCardHeader">
              <div>
                <div className="vl-dashTitle">Reports Today</div>
                <div className="vl-dashSubtle">ADL coverage + review queue (mock)</div>
              </div>
              <span className="vl-chip">
                <FileText size={14} />
                {todaysReports} reports
              </span>
            </div>
            <div className="vl-dashCardBody">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[28px] font-extrabold leading-none tracking-tight text-[#0F172A]">
                    {completedDailyLogs}/{totalPatients}
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-[#64748B]">ADL reports completed</div>
                </div>
                <MiniTrend points={[7, 8, 10, 9, 11, 12, 12]} tone="success" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniKpi label="Pending reviews" value={pendingReviews} />
                <MiniKpi label="Reviewed" value={Math.max(0, todaysReports - pendingReviews)} />
              </div>
            </div>
          </div>
        </div>

        <div className="vl-span-4">
          <div className="vl-analyticsCard">
            <BranchDistributionChart femaleCount={femaleCount} maleCount={maleCount} selectedBranch={branch} />
          </div>
        </div>

        {/* Row 4 – Quick Insights */}
        <div className="vl-span-12">
          <div className="quick-insights-card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div style={{ width: 4, height: 20, borderRadius: 4, background: 'linear-gradient(180deg,#16A34A,#0D9488)', flexShrink: 0 }} aria-hidden />
                <div className="text-[15px] font-extrabold tracking-tight" style={{ color: '#0F172A' }}>Quick Insights</div>
              </div>
              <span className="vl-chip">
                <Sparkles size={13} color="var(--vl-primary)" />
                Today
              </span>
            </div>

            <div className="mt-4 quick-insights-list">
              <div className="quick-insights-item">
                <span className="quick-insights-icon">
                  <CheckCircle size={16} />
                </span>
                <span className="quick-insights-text">
                  All {organizationStats.totalPatients} patients have ADL reports for today.
                </span>
              </div>
              <div className="quick-insights-item">
                <span className="quick-insights-icon">
                  <Droplets size={16} />
                </span>
                <span className="quick-insights-text">
                  2 patients under fluid restriction (Kidney patients).
                </span>
              </div>
              <div className="quick-insights-item">
                <span className="quick-insights-icon">
                  <ClipboardCheck size={16} />
                </span>
                <span className="quick-insights-text">
                  Diaper changes completed 3 times for 35 patients.
                </span>
              </div>
              <div className="quick-insights-item">
                <span className="quick-insights-icon">
                  <Pill size={16} />
                </span>
                <span className="quick-insights-text">Medication compliance: 92%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniKpi({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-2xl border p-4 transition-all"
      style={{
        background: 'linear-gradient(135deg,rgba(124,58,237,0.04) 0%,rgba(30,58,138,0.03) 100%)',
        borderColor: 'rgba(124,58,237,0.10)',
      }}
    >
      <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--vl-muted)' }}>{label}</div>
      <div className="mt-1.5 text-[22px] font-extrabold tracking-tight" style={{ color: '#0F172A' }}>{value}</div>
    </div>
  )
}

