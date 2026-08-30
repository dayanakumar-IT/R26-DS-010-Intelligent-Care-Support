import type { AdlRecord } from '../types'
import { getAdlDetailsForRecord } from '../utils/adlFields'
import styles from '../styles/dashboard.module.css'

interface AdlDetailsListProps {
  record: AdlRecord
}

export default function AdlDetailsList({ record }: AdlDetailsListProps) {
  const items = getAdlDetailsForRecord(record)
  if (items.length === 0) {
    return <span className={styles.mutedText}>—</span>
  }
  return (
    <ul className={styles.adlDetailsList}>
      {items.map((item) => (
        <li key={item.label} className={styles.adlDetailItem}>
          <span className={styles.adlDetailLabel}>{item.label}</span>
          <span className={styles.adlDetailValue}>{item.value}</span>
        </li>
      ))}
    </ul>
  )
}
