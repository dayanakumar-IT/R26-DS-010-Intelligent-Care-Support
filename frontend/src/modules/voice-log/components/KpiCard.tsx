import type { LucideIcon } from 'lucide-react'
import styles from '../styles/dashboard.module.css'

interface KpiCardProps {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  accent?: boolean
}

export default function KpiCard({ label, value, hint, icon: Icon, accent = false }: KpiCardProps) {
  return (
    <article className={`${styles.kpiCard} ${accent ? styles.kpiCardAccent : ''}`}>
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIcon} aria-hidden="true">
          <Icon size={16} />
        </span>
      </div>
      <p className={`${styles.kpiValue} ${accent ? styles.kpiValueAccent : ''}`}>{value}</p>
      {hint ? <p className={styles.kpiHint}>{hint}</p> : null}
    </article>
  )
}
