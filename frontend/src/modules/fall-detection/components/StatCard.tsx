import styles from './StatCard.module.css'

interface Props {
  label: string
  value: number | string
  sub?: string
  accent?: 'red' | 'amber' | 'blue' | 'green'
}

export default function StatCard({ label, value, sub, accent = 'blue' }: Props) {
  return (
    <div className={`${styles.card} ${styles[accent]}`}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  )
}
