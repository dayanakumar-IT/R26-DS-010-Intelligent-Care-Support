import { useState } from 'react'
import type { ReactNode } from 'react'
import Icon from '../../../shared/components/Icon'
import styles from './CollapsibleSection.module.css'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

// Generic expand/collapse wrapper used by Risk Analysis's three sections
// (Current Assessment, Why this assessment?, Risk History). State is plain
// component state — intentionally not persisted anywhere — so it resets to
// defaultOpen on every fresh mount (e.g. switching caregivers, since the
// panel that renders these is remounted via key={caregiverId}), matching
// "persist collapse state only for the current session."
export default function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon
          name="chevron-right"
          size={16}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
        <span className={styles.title}>{title}</span>
      </button>

      {isOpen && <div className={styles.body}>{children}</div>}
    </div>
  )
}
