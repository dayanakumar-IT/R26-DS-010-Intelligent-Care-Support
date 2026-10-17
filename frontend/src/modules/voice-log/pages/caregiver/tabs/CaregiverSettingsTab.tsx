import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../../../shared/components/Button'
import ProfileStrip from '../../../components/ProfileStrip'
import SectionHeader from '../../../components/SectionHeader'
import { logout } from '../../../../../services/authService'
import type { User } from '../../../../../types/user'
import styles from '../../../styles/dashboard.module.css'

interface CaregiverSettingsTabProps {
  user: User
}

export default function CaregiverSettingsTab({ user }: CaregiverSettingsTabProps) {
  const navigate = useNavigate()
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [alertNotifications, setAlertNotifications] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  const subtitle = [user.institution, user.ward].filter(Boolean).join(' · ')

  return (
    <div className={styles.page}>
      <ProfileStrip name={user.name} role="Caregiver" subtitle={subtitle || user.email} />

      <section className={styles.card}>
        <SectionHeader title="Account details" description="Your SCRIBE login information." />
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Name
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Email
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Role
            </dt>
            <dd className="mt-1 text-sm capitalize text-slate-900">{user.role}</dd>
          </div>
          {user.institution ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Institution
              </dt>
              <dd className="mt-1 text-sm text-slate-900">{user.institution}</dd>
            </div>
          ) : null}
          {user.ward ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Ward
              </dt>
              <dd className="mt-1 text-sm text-slate-900">{user.ward}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className={styles.card}>
        <SectionHeader
          title="Notification preferences"
          description="Stored locally for now. Backend delivery will be wired in a later step."
        />
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(event) => setEmailNotifications(event.target.checked)}
              className="rounded border-slate-300"
            />
            Email notifications for sync failures
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={alertNotifications}
              onChange={(event) => setAlertNotifications(event.target.checked)}
              className="rounded border-slate-300"
            />
            In-app alerts when an observation is flagged
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <Button variant="secondary" onClick={() => void handleLogout()} disabled={loggingOut}>
          {loggingOut ? 'Signing out…' : 'Log out'}
        </Button>
      </section>
    </div>
  )
}
