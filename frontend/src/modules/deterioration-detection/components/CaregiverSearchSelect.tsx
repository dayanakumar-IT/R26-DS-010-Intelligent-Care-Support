import { useState } from 'react'
import { useDeteriorationData } from '../context/useDeteriorationData'
import type { CaregiverListItem } from '../services/api'
import WardChip from './WardChip'
import styles from './CaregiverSearchSelect.module.css'

interface CaregiverSearchSelectProps {
  caregivers: CaregiverListItem[]
  selectedId: string
  onSelect: (id: string) => void
}

// Kept local to this module (not shared/components/) since it's purpose-built
// around CaregiverListItem — reusable across this module's own tabs later,
// not meant as a generic app-wide combobox.
export default function CaregiverSearchSelect({
  caregivers,
  selectedId,
  onSelect,
}: CaregiverSearchSelectProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Reused from context, already fetched for the Overview tab's KPI cards —
  // reuses the same "no scored data yet" signal (a null
  // latest_risk_probability) to flag caregivers here, rather than a second
  // network call or a separate definition of "no data".
  const { riskSummary } = useDeteriorationData()
  const noDataIds = new Set(
    riskSummary
      ? riskSummary.caregivers
          .filter((c) => c.latest_risk_probability === null)
          .map((c) => c.caregiver_id)
      : [],
  )

  const selected = caregivers.find((caregiver) => caregiver.id === selectedId) ?? null

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? caregivers.filter((caregiver) =>
        caregiver.display_name.toLowerCase().includes(normalizedQuery),
      )
    : caregivers

  const handleSelect = (caregiver: CaregiverListItem) => {
    onSelect(caregiver.id)
    setQuery('')
    setIsOpen(false)
  }

  const handleBlur = () => {
    // Deferred so a result's onMouseDown (which also preventDefault()s the
    // blur) has already run by the time this closes the list.
    window.setTimeout(() => {
      setIsOpen(false)
      setQuery('')
    }, 150)
  }

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor="caregiver-search">
        Caregiver
      </label>
      <input
        id="caregiver-search"
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="caregiver-search-results"
        autoComplete="off"
        className={styles.input}
        placeholder={selected ? selected.display_name : 'Search caregivers…'}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false)
            setQuery('')
            event.currentTarget.blur()
          }
        }}
      />

      {isOpen && (
        <div id="caregiver-search-results" className={styles.results} role="listbox">
          {filtered.length === 0 ? (
            <p className={styles.noResults}>No caregivers match &quot;{query}&quot;</p>
          ) : (
            filtered.map((caregiver) => (
              <button
                key={caregiver.id}
                type="button"
                role="option"
                aria-selected={caregiver.id === selectedId}
                className={`${styles.resultItem} ${
                  caregiver.id === selectedId ? styles.resultItemActive : ''
                }`}
                // onMouseDown (not onClick) + preventDefault so this fires
                // before the input's onBlur closes the list.
                onMouseDown={(event) => {
                  event.preventDefault()
                  handleSelect(caregiver)
                }}
              >
                <span className={styles.resultMain}>
                  <span className={styles.resultName}>{caregiver.display_name}</span>
                  {noDataIds.has(caregiver.id) && (
                    <span className={styles.noDataBadge}>No data yet</span>
                  )}
                </span>
                {caregiver.ward && <WardChip ward={caregiver.ward} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
