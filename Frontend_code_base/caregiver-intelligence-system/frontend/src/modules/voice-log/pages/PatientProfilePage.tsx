import { ArrowLeft, Droplets, Moon, Smile, Utensils, Activity, Sparkles, Mic } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../../shared/components/Button'
import { PatientAvatar } from '../components/PatientAvatar'
import { StatusBadge } from '../components/StatusBadge'
import { AudioSummaryPlayer } from '../components/AudioSummaryPlayer'
import { handoverSummaries, patients } from '../data/mockCareData'
import { useVoiceLogUI } from '../components/VoiceLogLayout'

export function PatientProfilePage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { openRecorder } = useVoiceLogUI()

  const patient = useMemo(() => patients.find((p) => p.id === patientId), [patientId])
  const summary = useMemo(
    () => handoverSummaries.find((s) => s.patientId === (patient?.id ?? 'P008')) ?? handoverSummaries[0],
    [patient?.id],
  )

  if (!patient) {
    return (
      <div className="vl-card">
        <div className="vl-cardBody">
          <div className="text-lg font-extrabold tracking-tight">Patient not found</div>
          <div className="mt-2 text-sm vl-subtle">Try selecting a patient from the table.</div>
          <div className="mt-4">
            <Button className="vl-btn" variant="secondary" onClick={() => navigate('/voice-log/patients')}>
              Back to Patients
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const routine = [
    { time: '07:00', task: 'Wake up + vitals check' },
    { time: '08:00', task: 'Breakfast' },
    { time: '08:30', task: 'Medication (post breakfast)' },
    { time: '10:30', task: 'Mobility walk (assisted)' },
    { time: '12:30', task: 'Lunch' },
    { time: '15:30', task: 'Tea' },
    { time: '18:30', task: 'Dinner' },
    { time: '21:00', task: 'Sleep routine' },
  ]

  const timeline = [
    { time: '08:05', label: 'Breakfast taken well', tone: 'good' as const },
    { time: '08:32', label: 'Medication given', tone: 'good' as const },
    { time: '10:42', label: 'Walked with support', tone: 'neutral' as const },
    { time: '12:40', label: 'Lunch half portion', tone: 'warn' as const },
    { time: '15:28', label: 'Hydration reminder', tone: 'warn' as const },
  ]

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button className="vl-iconBtn" variant="secondary" onClick={() => navigate('/voice-log/patients')}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="text-2xl font-extrabold tracking-tight">Patient Profile</div>
            <div className="mt-1 text-sm vl-subtle">ADL status, observations, and handover summary.</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button className="vl-btn" variant="secondary" size="sm" onClick={() => openRecorder()}>
            <span className="inline-flex items-center gap-2">
              <Mic size={16} />
              Start Voice Log
            </span>
          </Button>
          <Button className="vl-btn" variant="primary" size="sm" onClick={() => window.alert('Mock: Assign caregiver')}>
            Assign caregiver
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4">
          <div className="vl-card">
            <div className="vl-cardBody">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <PatientAvatar name={patient.name} gender={patient.gender} size={64} />
                  <div>
                    <div className="text-sm font-extrabold tracking-tight">{patient.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="vl-chip">
                        <span className="text-xs font-extrabold">{patient.id}</span>
                      </span>
                      <span className="vl-chip">{patient.branch}</span>
                      <span className="vl-chip">{patient.gender}</span>
                      <span className="vl-chip">Room {patient.room}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {patient.conditions.map((c) => (
                        <span key={c} className="vl-chip">
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs vl-subtle">
                      Allergies: {patient.allergies.length ? patient.allergies.join(', ') : 'None'}
                    </div>
                  </div>
                </div>

                <StatusBadge
                  label={patient.alertStatus === 'None' ? 'No active alerts' : `${patient.alertStatus} alert`}
                  tone={patient.alertStatus === 'New' ? 'danger' : patient.alertStatus === 'Monitoring' ? 'warn' : 'good'}
                  pulse={patient.alertStatus === 'New'}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="vl-card">
              <div className="vl-cardHeader">
                <div>
                  <div className="vl-cardTitle">Daily routine</div>
                  <div className="text-xs vl-subtle">Schedule (mock)</div>
                </div>
                <span className="vl-chip">
                  <Sparkles size={14} color="var(--vl-primary)" />
                  Auto reminders
                </span>
              </div>
              <div className="vl-cardBody">
                <div className="grid gap-2">
                  {routine.map((r) => (
                    <div
                      key={r.time}
                      className="flex items-center justify-between rounded-2xl border bg-white px-3 py-2"
                      style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                    >
                      <span className="text-xs font-extrabold text-[rgba(15,23,42,0.70)]">{r.time}</span>
                      <span className="text-sm font-semibold text-[rgba(15,23,42,0.82)]">{r.task}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="vl-card">
              <div className="vl-cardHeader">
                <div>
                  <div className="vl-cardTitle">Current observations</div>
                  <div className="text-xs vl-subtle">Snapshot (mock)</div>
                </div>
              </div>
              <div className="vl-cardBody">
                <div className="grid gap-2">
                  <ObsRow icon={<Droplets size={16} />} label="Hydration" value={patient.hydration} />
                  <ObsRow icon={<Smile size={16} />} label="Mood" value={patient.mood} />
                  <ObsRow icon={<Utensils size={16} />} label="Appetite" value={patient.appetite} />
                  <ObsRow icon={<Moon size={16} />} label="Sleep" value={patient.sleep} />
                  <ObsRow icon={<Activity size={16} />} label="Mobility" value={patient.mobility} />
                </div>
              </div>
            </div>
          </div>

          <div className="vl-card">
            <div className="vl-cardHeader">
              <div>
                <div className="vl-cardTitle">Recent ADL timeline</div>
                <div className="text-xs vl-subtle">Events from voice + daily logs (mock)</div>
              </div>
            </div>
            <div className="vl-cardBody">
              <div className="grid gap-2">
                {timeline.map((t) => (
                  <div
                    key={t.time}
                    className="flex items-center justify-between rounded-2xl border bg-white px-3 py-2"
                    style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                  >
                    <span className="text-xs font-extrabold text-[rgba(15,23,42,0.70)]">{t.time}</span>
                    <span className="text-sm font-semibold text-[rgba(15,23,42,0.82)]">{t.label}</span>
                    <StatusBadge
                      label={t.tone === 'good' ? 'OK' : t.tone === 'warn' ? 'Watch' : 'Note'}
                      tone={t.tone}
                      pulse={t.tone === 'warn'}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4" style={{ alignContent: 'start' }}>
          <div className="vl-card">
            <div className="vl-cardHeader">
              <div>
                <div className="vl-cardTitle">Patient-specific handover</div>
                <div className="text-xs vl-subtle">Generated summary + voice playback</div>
              </div>
              <StatusBadge label={summary.status} tone={summary.status === 'Ready' ? 'good' : summary.status === 'Processing' ? 'info' : 'warn'} />
            </div>
            <div className="vl-cardBody">
              <div className="rounded-2xl border bg-white p-3 text-sm leading-6" style={{ borderColor: 'rgba(15,23,42,0.10)' }}>
                {summary.summary}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs vl-subtle">
                <span>Last updated: {summary.updatedAt}</span>
                <span className="vl-chip">Room {summary.room}</span>
              </div>
            </div>
          </div>

          <AudioSummaryPlayer
            label="Handover summary audio"
            ttsText={summary.summary}
          />
        </div>
      </div>
    </div>
  )
}

function ObsRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border bg-white px-3 py-2"
      style={{ borderColor: 'rgba(15,23,42,0.10)' }}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl border" style={{ borderColor: 'rgba(15,23,42,0.10)', background: 'rgba(108,77,255,0.08)', color: 'var(--vl-primary)' }}>
          {icon}
        </span>
        <span className="text-xs font-extrabold text-[rgba(15,23,42,0.65)]">{label}</span>
      </div>
      <span className="text-sm font-semibold text-[rgba(15,23,42,0.82)]">{value}</span>
    </div>
  )
}

