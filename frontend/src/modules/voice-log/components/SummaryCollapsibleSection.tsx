import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import styles from '../styles/dashboard.module.css'

interface SummaryCollapsibleSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  emphasis?: 'default' | 'alert' | 'info'
  children: React.ReactNode
}

export default function SummaryCollapsibleSection({
  title,
  count,
  defaultOpen = true,
  emphasis = 'default',
  children,
}: SummaryCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  const emphasisClass =
    emphasis === 'alert'
      ? styles.summarySectionAlert
      : emphasis === 'info'
        ? styles.summarySectionInfo
        : ''

  return (
    <section
      className={`${styles.summarySection} ${emphasisClass} ${open ? styles.summarySectionOpen : ''}`}
    >
      <button
        type="button"
        className={styles.summarySectionHeader}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className={styles.summarySectionTitle}>
          {open ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
          <span className={styles.summarySectionTitleText}>{title}</span>
        </span>
        {count !== undefined ? (
          <span className={styles.summarySectionCount}>{count}</span>
        ) : (
          <span className={styles.summarySectionCountSpacer} aria-hidden="true" />
        )}
      </button>
      {open ? <div className={styles.summarySectionBody}>{children}</div> : null}
    </section>
  )
}
