import styles from '../styles/dashboard.module.css'

type BadgeVariant = 'normal' | 'alert' | 'pending' | 'synced' | 'failed' | 'processing' | 'completed'

interface StatusBadgeProps {
  variant: BadgeVariant
  label: string
  showDot?: boolean
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  normal: styles.statusNormal,
  alert: styles.statusAlert,
  pending: styles.statusPending,
  synced: styles.statusSynced,
  failed: styles.statusFailed,
  processing: styles.statusProcessing,
  completed: styles.statusCompleted,
}

export default function StatusBadge({ variant, label, showDot = true }: StatusBadgeProps) {
  return (
    <span className={`${styles.statusBadge} ${VARIANT_CLASSES[variant]}`}>
      {showDot ? <span className={styles.statusDot} aria-hidden="true" /> : null}
      {label}
    </span>
  )
}
