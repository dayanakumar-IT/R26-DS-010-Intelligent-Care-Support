import LiveClock from './LiveClock'
import styles from '../styles/dashboard.module.css'

interface ProfileStripProps {
  name: string
  role: string
  subtitle?: string
  badge?: React.ReactNode
  showClock?: boolean
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export default function ProfileStrip({ name, role, subtitle, badge, showClock = false }: ProfileStripProps) {
  return (
    <header className={styles.profileStrip}>
      <div className={styles.profileIdentity}>
        <div className={styles.avatar} aria-hidden="true">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <p className={styles.profileName}>{name}</p>
          <p className={styles.profileMeta}>
            {role}
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
        </div>
      </div>
      {(showClock || badge) ? (
        <div className={styles.profileActions}>
          {showClock ? <LiveClock /> : null}
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
      ) : null}
    </header>
  )
}
