import type { ReactNode } from 'react'
import styles from '../styles/dashboard.module.css'

interface FormattedFullTextProps {
  text: string
}

const TITLE_BANNER_RE = /^═+\s*(.+?)\s*═+$/
const SECTION_HEADER_RE = /^──\s*(.+?)\s*──$/
const BULLET_RE = /^\s*•\s*(.+)$/
// "Date range: ..." / "Caregivers: ..." style lines, only recognized before
// the first section heading (the meta block at the top of the summary).
const META_LINE_RE = /^([A-Za-z][A-Za-z ]*):\s*(.+)$/
// Same observation-line shape used by the backend and parseSummary.ts:
// optional date/time, optional [Category], the text, optional [ALERT].
const OBSERVATION_ITEM_RE =
  /^(?:((?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4},\s*)?\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*)?(?:\[([^\]]+)\]\s*)?(.+?)(\s*\[ALERT\])?\s*$/i

type Block =
  | { type: 'title' | 'heading' | 'paragraph'; content: string }
  | { type: 'meta'; label: string; value: string }
  | { type: 'list'; content: string[] }

function toBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let currentList: string[] | null = null
  let sawHeading = false

  const flushList = () => {
    if (currentList && currentList.length > 0) {
      blocks.push({ type: 'list', content: currentList })
    }
    currentList = null
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      continue
    }

    const titleMatch = line.match(TITLE_BANNER_RE)
    if (titleMatch) {
      flushList()
      blocks.push({ type: 'title', content: titleMatch[1]! })
      continue
    }

    const headingMatch = line.match(SECTION_HEADER_RE)
    if (headingMatch) {
      flushList()
      sawHeading = true
      blocks.push({ type: 'heading', content: headingMatch[1]! })
      continue
    }

    const bulletMatch = line.match(BULLET_RE)
    if (bulletMatch) {
      currentList ??= []
      currentList.push(bulletMatch[1]!)
      continue
    }

    flushList()

    if (!sawHeading) {
      const metaMatch = line.match(META_LINE_RE)
      if (metaMatch) {
        blocks.push({ type: 'meta', label: metaMatch[1]!.trim(), value: metaMatch[2]!.trim() })
        continue
      }
    }

    blocks.push({ type: 'paragraph', content: line })
  }
  flushList()
  return blocks
}

function renderListItem(item: string, key: number): ReactNode {
  const match = item.match(OBSERVATION_ITEM_RE)
  if (!match) {
    return <li key={key}>{item}</li>
  }
  const [, time, category, text, alert] = match
  return (
    <li key={key} className={alert ? styles.fullTextListItemAlert : undefined}>
      {time ? <span className={styles.fullTextItemTime}>{time}</span> : null}
      {category ? <span className={styles.fullTextItemCategory}>{category}</span> : null}
      <span className={styles.fullTextItemText}>{text}</span>
      {alert ? <span className={styles.fullTextItemAlertBadge}>Alert</span> : null}
    </li>
  )
}

/** Renders the complete backend summary text as headings/meta rows/styled
 * list rows instead of a raw monospace dump — used by "View full text" so
 * nothing from the original text is lost, just formatted readably. */
export default function FormattedFullText({ text }: FormattedFullTextProps) {
  const blocks = toBlocks(text)
  return (
    <div className={styles.fullTextCard}>
      {blocks.map((block, index) => {
        if (block.type === 'title') {
          return (
            <h3 key={index} className={styles.fullTextTitle}>
              {block.content}
            </h3>
          )
        }
        if (block.type === 'heading') {
          return (
            <h4 key={index} className={styles.fullTextHeading}>
              {block.content}
            </h4>
          )
        }
        if (block.type === 'meta') {
          return (
            <p key={index} className={styles.fullTextMeta}>
              <span className={styles.fullTextMetaLabel}>{block.label}</span>
              <span className={styles.fullTextMetaValue}>{block.value}</span>
            </p>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className={styles.fullTextList}>
              {block.content.map((item, itemIndex) => renderListItem(item, itemIndex))}
            </ul>
          )
        }
        return (
          <p key={index} className={styles.fullTextParagraph}>
            {block.content}
          </p>
        )
      })}
    </div>
  )
}
