import { formatAvailableDateLabel } from '../utils/format'
import styles from '../styles/dashboard.module.css'

interface AvailableDateSelectProps {
  label: string
  value: string
  dates: string[]
  onChange: (value: string) => void
  disabled?: boolean
  emptyMessage?: string
}

export default function AvailableDateSelect({
  label,
  value,
  dates,
  onChange,
  disabled = false,
  emptyMessage = 'No dates with observations',
}: AvailableDateSelectProps) {
  const isDisabled = disabled || dates.length === 0

  return (
    <label className={styles.fieldGroup}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.fieldSelect}
        disabled={isDisabled}
        aria-label={label}
      >
        {dates.length === 0 ? (
          <option value="">{emptyMessage}</option>
        ) : (
          dates.map((date) => (
            <option key={date} value={date}>
              {formatAvailableDateLabel(date)}
            </option>
          ))
        )}
      </select>
    </label>
  )
}
