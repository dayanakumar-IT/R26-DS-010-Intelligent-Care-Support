import { useEffect, useState, useCallback } from 'react'
import Icon from '../../../shared/components/Icon'
import type { IconName } from '../../../shared/components/Icon'
import StatCard from '../components/StatCard'
import RiskBadge from '../components/RiskBadge'
import { api } from '../api/client'
import type { Room, Patient, Alert, DashboardSummary } from '../api/client'
import styles from './Overview.module.css'

// ── Tabs ──────────────────────────────────────────────────────────────────────
interface TabDef { id: string; label: string; icon: IconName }
const TABS: TabDef[] = [
  { id: 'dashboard',    label: 'Dashboard',        icon: 'activity'    },
  { id: 'rooms',        label: 'Rooms',             icon: 'footprints'  },
  { id: 'patients',     label: 'Patients & Beds',   icon: 'users'       },
  { id: 'live',         label: 'Live Monitoring',   icon: 'eye'         },
  { id: 'alerts',       label: 'Alerts',            icon: 'warning'     },
  { id: 'replay',       label: 'Event Replay',      icon: 'heart-pulse' },
  { id: 'history',      label: 'History',           icon: 'trending-up' },
  { id: 'analytics',    label: 'Analytics',         icon: 'bar-chart-3' },
  { id: 'reports',      label: 'Reports',           icon: 'bar-chart-3' },
  { id: 'users',        label: 'Users & Roles',     icon: 'users'       },
  { id: 'config',       label: 'Config',            icon: 'settings'    },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
function genderLabel(g: string | null) {
  if (g === 'M') return 'Male'
  if (g === 'F') return 'Female'
  if (g === 'Other') return 'Other'
  return '—'
}

// ── PANEL: Dashboard ──────────────────────────────────────────────────────────
function DashboardPanel({ summary, rooms, alerts, loading }: {
  summary: DashboardSummary | null; rooms: Room[]; alerts: Alert[]; loading: boolean
}) {
  const recent = alerts.slice(0, 5)
  return (
    <div className={styles.dashWrap}>
      <div className={styles.statsGrid}>
        <StatCard label="Rooms Monitored"      value={summary?.total_rooms ?? '—'}             accent="blue"  />
        <StatCard label="Patients Registered"  value={summary?.total_patients ?? '—'}          accent="green" />
        <StatCard label="Unacknowledged"        value={summary?.unacknowledged_alerts ?? '—'}  accent="amber" sub="pending alerts" />
        <StatCard label="High Risk Today"       value={summary?.high_alerts_today ?? '—'}      accent="red"   sub="HIGH level alerts" />
      </div>

      <div className={styles.dashCols}>
        {/* Room status */}
        <div className={styles.dashCard}>
          <div className={styles.dashCardTitle}>Room Status</div>
          {loading ? <div className={styles.empty}>Loading…</div> :
            rooms.length === 0 ? <div className={styles.empty}>No rooms yet</div> :
            rooms.map(r => (
              <div key={r.id} className={styles.roomStatusRow}>
                <div>
                  <div className={styles.roomStatusCode}>{r.room_code}</div>
                  <div className={styles.roomStatusWard}>{r.ward ?? 'No ward'}</div>
                </div>
                <span className={`${styles.camPill} ${r.camera_src ? styles.camOnline : styles.camOffline}`}>
                  {r.camera_src ? '● Live' : '○ Offline'}
                </span>
              </div>
            ))
          }
        </div>

        {/* Recent alerts */}
        <div className={styles.dashCard}>
          <div className={styles.dashCardTitle}>Recent Alerts</div>
          {loading ? <div className={styles.empty}>Loading…</div> :
            recent.length === 0 ? <div className={styles.empty}>No alerts yet</div> :
            recent.map(a => (
              <div key={a.id} className={styles.recentAlertRow}>
                <RiskBadge level={a.risk_level} />
                <div className={styles.recentAlertMeta}>
                  <span>{a.posture ?? '—'}</span>
                  <span className={styles.recentAlertTime}>{fmtTime(a.timestamp)}</span>
                </div>
                {!a.acknowledged && <span className={styles.dot} />}
              </div>
            ))
          }
        </div>

        {/* Risk distribution */}
        <div className={styles.dashCard}>
          <div className={styles.dashCardTitle}>Risk Distribution</div>
          {summary ? (
            <div className={styles.riskDist}>
              {(['HIGH', 'MODERATE', 'NORMAL'] as const).map(level => {
                const count = summary.patients_by_level[level] ?? 0
                const total = Object.values(summary.patients_by_level).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={level} className={styles.riskDistRow}>
                    <RiskBadge level={level} />
                    <div className={styles.riskBar}>
                      <div
                        className={`${styles.riskBarFill} ${styles[`bar${level}`]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={styles.riskCount}>{count}</span>
                  </div>
                )
              })}
              {!Object.values(summary.patients_by_level).some(v => v > 0) &&
                <div className={styles.empty}>No active inference data</div>
              }
            </div>
          ) : <div className={styles.empty}>Loading…</div>}
        </div>
      </div>
    </div>
  )
}

// ── PANEL: Rooms ──────────────────────────────────────────────────────────────
function RoomsPanel({ rooms, loading }: { rooms: Room[]; loading: boolean }) {
  if (loading) return <div className={styles.empty}>Loading rooms…</div>
  if (!rooms.length) return <div className={styles.empty}>No rooms configured yet.</div>
  return (
    <div className={styles.roomGrid}>
      {rooms.map(r => (
        <div key={r.id} className={styles.roomCard}>
          <div className={styles.roomHeader}>
            <span className={styles.roomCode}>{r.room_code}</span>
            <span className={`${styles.camPill} ${r.camera_src ? styles.camOnline : styles.camOffline}`}>
              {r.camera_src ? '● Live' : '○ No Camera'}
            </span>
          </div>
          <div className={styles.roomMeta}>{r.ward ?? 'Unassigned ward'}</div>
          <div className={styles.roomMetaRow}>
            <span className={styles.metaLabel}>Camera</span>
            <span className={styles.metaVal}>{r.camera_src ?? 'Not configured'}</span>
          </div>
          <div className={styles.roomMetaRow}>
            <span className={styles.metaLabel}>Caregiver</span>
            <span className={styles.metaVal}>{r.caregiver_id ? r.caregiver_id.slice(0, 8) + '…' : 'Unassigned'}</span>
          </div>
          <div className={styles.roomMetaRow}>
            <span className={styles.metaLabel}>Zone config</span>
            <span className={styles.metaVal}>{r.zone_config ? 'Configured' : 'None'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── PANEL: Patients & Beds ────────────────────────────────────────────────────
function PatientsPanel({ patients, rooms, loading }: { patients: Patient[]; rooms: Room[]; loading: boolean }) {
  if (loading) return <div className={styles.empty}>Loading patients…</div>
  if (!patients.length) return <div className={styles.empty}>No patients registered yet.</div>
  const roomMap = Object.fromEntries(rooms.map(r => [String(r.id), r.room_code]))
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th><th>Patient Code</th><th>Gender</th><th>Assigned Room</th><th>Registered</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p, i) => (
            <tr key={p.id}>
              <td className={styles.tdIdx}>{i + 1}</td>
              <td className={styles.tdCode}>{p.patient_code}</td>
              <td>{genderLabel(p.gender)}</td>
              <td>{p.room_id ? (roomMap[p.room_id] ?? p.room_id) : '—'}</td>
              <td className={styles.tdTime}>{fmtTime(p.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── PANEL: Live Monitoring ────────────────────────────────────────────────────
function LivePanel({ rooms }: { rooms: Room[] }) {
  const [selected, setSelected] = useState<Room | null>(null)
  const activeRooms = rooms.filter(r => r.camera_src)

  return (
    <div className={styles.liveWrap}>
      <div className={styles.liveLeft}>
        <div className={styles.sectionLabel}>Camera Rooms</div>
        {activeRooms.length === 0
          ? <div className={styles.empty}>No camera configured.<br />Set camera_src via backend API.</div>
          : activeRooms.map(r => (
            <button
              key={r.id}
              className={`${styles.roomBtn} ${selected?.id === r.id ? styles.roomBtnActive : ''}`}
              onClick={() => setSelected(r)}
            >
              <span className={styles.liveIndicator} />
              <span>{r.room_code}</span>
              <span className={styles.roomBtnWard}>{r.ward ?? ''}</span>
            </button>
          ))
        }
        {rooms.filter(r => !r.camera_src).length > 0 && (
          <>
            <div className={styles.sectionLabel} style={{ marginTop: 16 }}>No Camera</div>
            {rooms.filter(r => !r.camera_src).map(r => (
              <div key={r.id} className={styles.roomBtnDisabled}>
                <span>{r.room_code}</span>
                <span className={styles.roomBtnWard}>{r.ward ?? ''}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className={styles.liveRight}>
        {!selected ? (
          <div className={styles.livePrompt}>
            <Icon name="eye" size={40} color="#94a3b8" />
            <p>Select a room to start live monitoring</p>
          </div>
        ) : (
          <div className={styles.liveMonitor}>
            <div className={styles.liveMonitorHeader}>
              <div>
                <div className={styles.liveMonitorRoom}>{selected.room_code}</div>
                <div className={styles.liveMonitorSub}>{selected.ward} · {selected.camera_src}</div>
              </div>
              <span className={styles.liveDot}>● LIVE</span>
            </div>
            <div className={styles.skeletonCanvas}>
              <div className={styles.skeletonPlaceholder}>
                <Icon name="activity" size={48} color="#334155" />
                <p>Skeleton feed streams here via WebSocket</p>
                <p className={styles.skeletonSub}>Connect camera source: <code>{selected.camera_src}</code></p>
              </div>
            </div>
            <div className={styles.liveStats}>
              <div className={styles.liveStat}>
                <span className={styles.liveStatLabel}>Risk Score</span>
                <span className={styles.liveStatVal}>—</span>
              </div>
              <div className={styles.liveStat}>
                <span className={styles.liveStatLabel}>Risk Level</span>
                <span className={styles.liveStatVal}>—</span>
              </div>
              <div className={styles.liveStat}>
                <span className={styles.liveStatLabel}>Posture</span>
                <span className={styles.liveStatVal}>—</span>
              </div>
              <div className={styles.liveStat}>
                <span className={styles.liveStatLabel}>Zone</span>
                <span className={styles.liveStatVal}>—</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PANEL: Alerts ─────────────────────────────────────────────────────────────
function AlertsPanel({ alerts, loading, onAcknowledge }: {
  alerts: Alert[]; loading: boolean; onAcknowledge: (id: number) => void
}) {
  const [filter, setFilter] = useState<'unacked' | 'all' | 'high'>('unacked')
  const shown = filter === 'unacked' ? alerts.filter(a => !a.acknowledged)
    : filter === 'high' ? alerts.filter(a => a.risk_level === 'HIGH')
    : alerts

  if (loading) return <div className={styles.empty}>Loading alerts…</div>
  return (
    <div>
      <div className={styles.filterRow}>
        {[
          { key: 'unacked', label: 'Unacknowledged', count: alerts.filter(a => !a.acknowledged).length },
          { key: 'high',    label: 'HIGH only',      count: alerts.filter(a => a.risk_level === 'HIGH').length },
          { key: 'all',     label: 'All Alerts',     count: alerts.length },
        ].map(f => (
          <button
            key={f.key}
            className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
            onClick={() => setFilter(f.key as typeof filter)}
          >
            {f.label}
            <span className={filter === f.key ? styles.filterBadgeActive : styles.filterBadge}>{f.count}</span>
          </button>
        ))}
      </div>
      {shown.length === 0
        ? <div className={styles.empty}>{filter === 'unacked' ? '✓ All alerts acknowledged' : 'No alerts'}</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Time</th><th>Level</th><th>Score</th><th>Posture</th><th>Key Factors</th><th>Status</th><th>Replay</th><th></th></tr>
              </thead>
              <tbody>
                {shown.map(a => (
                  <tr key={a.id} className={a.risk_level === 'HIGH' ? styles.rowHigh : styles.rowMod}>
                    <td className={styles.tdTime}>{fmtTime(a.timestamp)}</td>
                    <td><RiskBadge level={a.risk_level} /></td>
                    <td className={styles.tdScore}>{Math.round(a.risk_score)}</td>
                    <td>{a.posture ?? '—'}</td>
                    <td className={styles.tdFactors}>{(a.key_factors ?? []).slice(0, 2).join(', ') || '—'}</td>
                    <td>
                      {a.acknowledged
                        ? <span className={styles.ackedPill}>Acked</span>
                        : <span className={styles.unackedPill}>Pending</span>}
                    </td>
                    <td>
                      {a.r2_replay_key
                        ? <span className={styles.replayLink}>▶ View</span>
                        : <span className={styles.tdTime}>—</span>}
                    </td>
                    <td>
                      {!a.acknowledged && (
                        <button className={styles.ackBtn} onClick={() => onAcknowledge(a.id)}>
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

// ── PANEL: Event Replay ───────────────────────────────────────────────────────
function ReplayPanel({ alerts }: { alerts: Alert[] }) {
  const [selected, setSelected] = useState<Alert | null>(null)
  const highAlerts = alerts.filter(a => a.r2_replay_key)

  return (
    <div className={styles.replayWrap}>
      <div className={styles.replayLeft}>
        <div className={styles.sectionLabel}>HIGH Alerts with Replay</div>
        {highAlerts.length === 0
          ? <div className={styles.empty}>No replay data yet.<br />Replays saved on HIGH alerts.</div>
          : highAlerts.map(a => (
            <button
              key={a.id}
              className={`${styles.replayItem} ${selected?.id === a.id ? styles.replayItemActive : ''}`}
              onClick={() => setSelected(a)}
            >
              <RiskBadge level={a.risk_level} />
              <span className={styles.replayTime}>{fmtTime(a.timestamp)}</span>
            </button>
          ))
        }
      </div>
      <div className={styles.replayRight}>
        {!selected
          ? <div className={styles.livePrompt}><Icon name="heart-pulse" size={40} color="#94a3b8" /><p>Select an alert to replay skeleton</p></div>
          : (
            <div>
              <div className={styles.liveMonitorHeader}>
                <div>
                  <div className={styles.liveMonitorRoom}>Alert #{selected.id} · {selected.risk_level}</div>
                  <div className={styles.liveMonitorSub}>{fmtTime(selected.timestamp)} · Score: {Math.round(selected.risk_score)}</div>
                </div>
                <RiskBadge level={selected.risk_level} score={selected.risk_score} />
              </div>
              <div className={styles.skeletonCanvas}>
                <div className={styles.skeletonPlaceholder}>
                  <Icon name="activity" size={48} color="#334155" />
                  <p>Skeleton replay loads from Cloudflare R2</p>
                  <code className={styles.replayKey}>{selected.r2_replay_key}</code>
                </div>
              </div>
              <div className={styles.replayMeta}>
                {(selected.key_factors ?? []).map((f, i) => (
                  <span key={i} className={styles.factorPill}>{f}</span>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  )
}

// ── PANEL: History ────────────────────────────────────────────────────────────
function HistoryPanel({ alerts, loading }: { alerts: Alert[]; loading: boolean }) {
  if (loading) return <div className={styles.empty}>Loading…</div>
  if (!alerts.length) return <div className={styles.empty}>No fall events recorded yet.</div>
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr><th>Time</th><th>Level</th><th>Score</th><th>Posture</th><th>Factors</th><th>Acknowledged</th></tr>
        </thead>
        <tbody>
          {alerts.map(a => (
            <tr key={a.id}>
              <td className={styles.tdTime}>{fmtTime(a.timestamp)}</td>
              <td><RiskBadge level={a.risk_level} /></td>
              <td className={styles.tdScore}>{Math.round(a.risk_score)}</td>
              <td>{a.posture ?? '—'}</td>
              <td className={styles.tdFactors}>{(a.key_factors ?? []).join(', ') || '—'}</td>
              <td>{a.acknowledged ? <span className={styles.ackedPill}>Yes · {a.ack_by ?? ''}</span> : <span className={styles.unackedPill}>No</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── PANEL: Analytics ─────────────────────────────────────────────────────────
function AnalyticsPanel({ summary, alerts }: { summary: DashboardSummary | null; alerts: Alert[] }) {
  const highCount = alerts.filter(a => a.risk_level === 'HIGH').length
  const modCount  = alerts.filter(a => a.risk_level === 'MODERATE').length
  const ackedPct  = alerts.length > 0 ? Math.round((alerts.filter(a => a.acknowledged).length / alerts.length) * 100) : 0

  return (
    <div className={styles.analyticsWrap}>
      <div className={styles.analyticsGrid}>
        <div className={styles.analyticCard}>
          <div className={styles.analyticTitle}>Alert Breakdown</div>
          <div className={styles.analyticBody}>
            <div className={styles.bigStat} style={{ color: '#dc2626' }}>{highCount}</div>
            <div className={styles.analyticLabel}>HIGH alerts total</div>
            <div className={styles.bigStat} style={{ color: '#d97706', marginTop: 16 }}>{modCount}</div>
            <div className={styles.analyticLabel}>MODERATE alerts total</div>
          </div>
        </div>
        <div className={styles.analyticCard}>
          <div className={styles.analyticTitle}>Acknowledgement Rate</div>
          <div className={styles.analyticBody}>
            <div className={styles.gaugeWrap}>
              <div className={styles.gaugeVal}>{ackedPct}%</div>
              <div className={styles.gaugeBar}>
                <div className={styles.gaugeFill} style={{ width: `${ackedPct}%` }} />
              </div>
              <div className={styles.analyticLabel}>{alerts.filter(a => a.acknowledged).length} of {alerts.length} acknowledged</div>
            </div>
          </div>
        </div>
        <div className={styles.analyticCard}>
          <div className={styles.analyticTitle}>Coverage</div>
          <div className={styles.analyticBody}>
            <div className={styles.bigStat} style={{ color: '#1e3a8a' }}>{summary?.total_rooms ?? 0}</div>
            <div className={styles.analyticLabel}>Rooms monitored</div>
            <div className={styles.bigStat} style={{ color: '#16a34a', marginTop: 16 }}>{summary?.total_patients ?? 0}</div>
            <div className={styles.analyticLabel}>Patients registered</div>
          </div>
        </div>
      </div>
      <div className={styles.analyticsNote}>
        Full analytics charts (time-series risk trends, per-room heatmaps) will be available once live inference data is streaming.
      </div>
    </div>
  )
}

// ── PANEL: Reports ────────────────────────────────────────────────────────────
function ReportsPanel() {
  return (
    <div className={styles.comingSoon}>
      <Icon name="bar-chart-3" size={48} color="#94a3b8" />
      <h3>Reports</h3>
      <p>Generate PDF / CSV reports of fall events, alert history, and patient risk summaries.</p>
      <p className={styles.comingSub}>Available after live inference data is collected.</p>
    </div>
  )
}

// ── PANEL: Users & Roles ──────────────────────────────────────────────────────
function UsersPanel() {
  return (
    <div className={styles.comingSoon}>
      <Icon name="users" size={48} color="#94a3b8" />
      <h3>Users & Roles</h3>
      <p>Manage supervisor and admin accounts. Caregivers are read from PULSE component.</p>
      <p className={styles.comingSub}>User management is handled via Supabase Auth + the shared profiles table.</p>
    </div>
  )
}

// ── PANEL: Config ─────────────────────────────────────────────────────────────
function ConfigPanel({ rooms }: { rooms: Room[] }) {
  return (
    <div>
      <div className={styles.configSection}>
        <div className={styles.configTitle}>Camera Configuration</div>
        <p className={styles.configSub}>Set camera source for each room. Use <code>0</code> for webcam, <code>rtsp://…</code> for IP camera.</p>
        <div className={styles.configTable}>
          {rooms.length === 0
            ? <div className={styles.empty}>No rooms yet.</div>
            : rooms.map(r => (
              <div key={r.id} className={styles.configRow}>
                <div>
                  <div className={styles.configRoomCode}>{r.room_code}</div>
                  <div className={styles.configRoomWard}>{r.ward ?? 'No ward'}</div>
                </div>
                <div className={styles.configCamVal}>
                  {r.camera_src
                    ? <span className={styles.camOnlineText}>{r.camera_src}</span>
                    : <span className={styles.camOfflineText}>Not configured</span>}
                </div>
              </div>
            ))
          }
        </div>
        <p className={styles.configNote}>To set camera: PATCH /api/rooms/{'{id}'}/camera via backend API or Swagger UI at localhost:8000/docs</p>
      </div>

      <div className={styles.configSection}>
        <div className={styles.configTitle}>Risk Thresholds</div>
        <div className={styles.thresholdGrid}>
          <div className={styles.thresholdRow}>
            <RiskBadge level="HIGH" />
            <span className={styles.thresholdVal}>Score ≥ 70</span>
            <span className={styles.thresholdDesc}>Immediate alert + R2 replay saved</span>
          </div>
          <div className={styles.thresholdRow}>
            <RiskBadge level="MODERATE" />
            <span className={styles.thresholdVal}>Score 40–69</span>
            <span className={styles.thresholdDesc}>Alert fired after dwell timer</span>
          </div>
          <div className={styles.thresholdRow}>
            <RiskBadge level="NORMAL" />
            <span className={styles.thresholdVal}>Score &lt; 40</span>
            <span className={styles.thresholdDesc}>Logged to fall_events only</span>
          </div>
        </div>
      </div>

      <div className={styles.configSection}>
        <div className={styles.configTitle}>Storage</div>
        <div className={styles.storageGrid}>
          <div className={styles.storageCard}>
            <div className={styles.storageLabel}>Structured Data</div>
            <div className={styles.storageVal}>Supabase</div>
            <div className={styles.storageSub}>patients · rooms · fall_events · fall_alerts</div>
          </div>
          <div className={styles.storageCard}>
            <div className={styles.storageLabel}>Skeleton Replays</div>
            <div className={styles.storageVal}>Cloudflare R2</div>
            <div className={styles.storageSub}>caresense-fall-models · replays/alert_*.json</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Overview() {
  const [activeTab, setActiveTab] = useState(TABS[0]!.id)
  const [summary,  setSummary]  = useState<DashboardSummary | null>(null)
  const [rooms,    setRooms]    = useState<Room[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [alerts,   setAlerts]   = useState<Alert[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const [sum, rm, pt, al] = await Promise.all([
        api.getDashboard(), api.getRooms(), api.getPatients(), api.getAlerts(),
      ])
      setSummary(sum); setRooms(rm); setPatients(pt); setAlerts(al)
    } catch {
      setError('Cannot reach backend — make sure python main.py --reload is running on port 8000.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])
  useEffect(() => {
    const t = setInterval(() => { void loadAll() }, 15_000)
    return () => clearInterval(t)
  }, [loadAll])

  const handleAcknowledge = async (id: number) => {
    await api.acknowledgeAlert(id)
    void loadAll()
  }

  const unackedCount = alerts.filter(a => !a.acknowledged).length

  return (
    <div>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>SENTRY · Fall Risk Detection</h1>
          <p className={styles.pageSub}>Edge-deployed skeletal movement analysis — ST-GCN + Biomechanical Late Fusion</p>
        </div>
        <button className={styles.refreshBtn} onClick={() => void loadAll()}>↻ Refresh</button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <Icon name="warning" size={16} /> {error}
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabRow} role="tablist" aria-label="Fall Detection views">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={15} />
            <span>{tab.label}</span>
            {tab.id === 'alerts' && unackedCount > 0 && (
              <span className={styles.tabBadge}>{unackedCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className={styles.panel} role="tabpanel">
        {activeTab === 'dashboard' && <DashboardPanel summary={summary} rooms={rooms} alerts={alerts} loading={loading} />}
        {activeTab === 'rooms'     && <RoomsPanel rooms={rooms} loading={loading} />}
        {activeTab === 'patients'  && <PatientsPanel patients={patients} rooms={rooms} loading={loading} />}
        {activeTab === 'live'      && <LivePanel rooms={rooms} />}
        {activeTab === 'alerts'    && <AlertsPanel alerts={alerts} loading={loading} onAcknowledge={handleAcknowledge} />}
        {activeTab === 'replay'    && <ReplayPanel alerts={alerts} />}
        {activeTab === 'history'   && <HistoryPanel alerts={alerts} loading={loading} />}
        {activeTab === 'analytics' && <AnalyticsPanel summary={summary} alerts={alerts} />}
        {activeTab === 'reports'   && <ReportsPanel />}
        {activeTab === 'users'     && <UsersPanel />}
        {activeTab === 'config'    && <ConfigPanel rooms={rooms} />}
      </div>
    </div>
  )
}
