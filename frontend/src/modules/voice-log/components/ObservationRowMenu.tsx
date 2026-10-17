import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import type { AdlRecord } from '../types'
import styles from '../styles/dashboard.module.css'

interface ObservationRowMenuProps {
  record: AdlRecord
  onEdit?: (record: AdlRecord) => void
  onDelete?: (record: AdlRecord) => void
}

export default function ObservationRowMenu({ record, onEdit, onDelete }: ObservationRowMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  if (!onEdit && !onDelete) {
    return null
  }

  return (
    <div className={styles.rowMenu} ref={menuRef}>
      <button
        type="button"
        className={styles.rowMenuTrigger}
        onClick={() => setOpen((current) => !current)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>

      {open ? (
        <div className={styles.rowMenuDropdown} role="menu">
          {onEdit ? (
            <button
              type="button"
              role="menuitem"
              className={styles.rowMenuItem}
              onClick={() => {
                setOpen(false)
                onEdit(record)
              }}
            >
              <Pencil size={14} aria-hidden="true" />
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              role="menuitem"
              className={`${styles.rowMenuItem} ${styles.rowMenuItemDanger}`}
              onClick={() => {
                setOpen(false)
                void onDelete(record)
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
