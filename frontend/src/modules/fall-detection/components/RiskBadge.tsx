import styles from './RiskBadge.module.css'

type Level = 'HIGH' | 'MODERATE' | 'NORMAL'

interface Props {
  level: Level
  score?: number
}

export default function RiskBadge({ level, score }: Props) {
  return (
    <span className={`${styles.badge} ${styles[level.toLowerCase() as Lowercase<Level>]}`}>
      {level}{score !== undefined ? ` · ${Math.round(score)}` : ''}
    </span>
  )
}
