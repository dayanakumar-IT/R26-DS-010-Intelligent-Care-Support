import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './ExplainCard.module.css'

export type ExplainCardTone = 'good' | 'watch' | 'info'

interface ExplainCardProps {
  emoji: string
  title: string
  headline: ReactNode
  meaning?: ReactNode
  tone?: ExplainCardTone
  // Extra content (a chart, tiles, a list) rendered under the meaning.
  children?: ReactNode
  // Revealed by the "Explain more" toggle — closed by default.
  explainMore?: ReactNode
  // Small grey note under everything else.
  note?: ReactNode
}

const TONE_CLASS: Record<ExplainCardTone, string> = {
  good: styles.toneGood,
  watch: styles.toneWatch,
  info: styles.toneInfo,
}

// The one shared template for every plain-English explanation card on the
// caregiver page. All wording passed in comes from ../explanationText.ts.
export default function ExplainCard({
  emoji,
  title,
  headline,
  meaning,
  tone = 'info',
  children,
  explainMore,
  note,
}: ExplainCardProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className={`${styles.card} ${TONE_CLASS[tone]}`}>
      <div className={styles.titleRow}>
        <span className={styles.emoji} aria-hidden="true">
          {emoji}
        </span>
        <p className={styles.title}>{title}</p>
      </div>
      <p className={styles.headline}>{headline}</p>
      {meaning && <p className={styles.meaning}>{meaning}</p>}
      {children}
      {note && <p className={styles.note}>{note}</p>}
      {explainMore && (
        <>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Explain less' : 'Explain more'}
            <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true">
              ›
            </span>
          </button>
          <div id={panelId} className={styles.more} hidden={!open}>
            {explainMore}
          </div>
        </>
      )}
    </div>
  )
}
