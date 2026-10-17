import { Search } from 'lucide-react'
import styles from '../styles/dashboard.module.css'

interface TableSearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/** Search box placed above a table — filters rows as you type. Reuses the
 * same search field styling as the existing patient-list search. */
export default function TableSearchBox({
  value,
  onChange,
  placeholder = 'Search…',
}: TableSearchBoxProps) {
  return (
    <label className={styles.searchField}>
      <Search size={16} className={styles.searchIcon} aria-hidden="true" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.searchInput}
      />
    </label>
  )
}
