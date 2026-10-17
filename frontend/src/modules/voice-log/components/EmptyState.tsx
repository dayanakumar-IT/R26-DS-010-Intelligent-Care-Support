import type { LucideIcon } from 'lucide-react'
import styles from '../styles/dashboard.module.css'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export default function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateIcon}>
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3 className={styles.emptyStateTitle}>{title}</h3>
      <p className={styles.emptyStateDescription}>{description}</p>
    </div>
  )
}
