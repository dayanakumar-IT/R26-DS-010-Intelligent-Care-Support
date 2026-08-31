import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  UserRound,
} from 'lucide-react'
import CategoryBadge from './CategoryBadge'
import StatusBadge from './StatusBadge'
import SummaryCollapsibleSection from './SummaryCollapsibleSection'
import styles from '../styles/dashboard.module.css'
import {
  formatSummaryTimestamp,
  parseHandoverSummary,
  type ParsedSection,
} from '../utils/parseSummary'

interface HandoverBriefViewProps {
  summaryText: string
}

function toCategoryKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_')
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.handoverMetaCard}>
      <p className={styles.handoverMetaLabel}>{label}</p>
      <p className={styles.handoverMetaValue}>{value}</p>
    </article>
  )
}

function HandoverSectionContent({ section }: { section: ParsedSection }) {
  if (section.kind === 'categories' && section.categories?.length) {
    return (
      <div className={styles.handoverCategoryChips}>
        {section.categories.map((item) => (
          <span key={item.name} className={styles.handoverCategoryChip}>
            <CategoryBadge category={toCategoryKey(item.name)} />
            <span className={styles.handoverCategoryChipCount}>{item.count}</span>
          </span>
        ))}
      </div>
    )
  }

  if (section.observations?.length) {
    const isAlertSection = section.kind === 'alerts' || section.emphasis === 'alert'
    return (
      <ul className={styles.handoverTimeline}>
        {section.observations.map((observation, index) => {
          const displayText = observation.text.replace(/^Alert raised\s+/i, '')
          const formattedTime = observation.time
            ? observation.time
            : /^\d{4}-\d{2}-\d{2}/.test(displayText)
              ? formatSummaryTimestamp(displayText)
              : displayText

          return (
            <li
              key={`${observation.text}-${index}`}
              className={`${styles.handoverTimelineItem} ${
                observation.alert || isAlertSection ? styles.handoverTimelineItemAlert : ''
              }`}
            >
              <div className={styles.handoverTimelineMarker} aria-hidden="true" />
              <div className={styles.handoverTimelineContent}>
                <div className={styles.handoverTimelineHeader}>
                  {observation.category ? (
                    <CategoryBadge category={toCategoryKey(observation.category)} />
                  ) : isAlertSection ? (
                    <StatusBadge variant="alert" label="Open alert" />
                  ) : null}
                  {observation.time ? (
                    <span className={styles.handoverTimelineTime}>{observation.time}</span>
                  ) : isAlertSection ? (
                    <span className={styles.handoverTimelineTime}>{formattedTime}</span>
                  ) : null}
                </div>
                <p className={styles.handoverTimelineText}>
                  {isAlertSection && !observation.category
                    ? `Requires supervisor review`
                    : observation.text.replace(/\s*\[ALERT\]\s*$/i, '')}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  if (section.lines?.length) {
    return (
      <div className={styles.summaryTextBlock}>
        {section.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    )
  }

  return <p className={styles.mutedText}>No items in this section.</p>
}

export default function HandoverBriefView({ summaryText }: HandoverBriefViewProps) {
  const [showRaw, setShowRaw] = useState(false)
  const parsed = useMemo(() => parseHandoverSummary(summaryText), [summaryText])

  const patient = parsed.meta.find((item) => item.label === 'Patient')
  const handoverDate = parsed.meta.find((item) => item.label === 'Handover date')
  const fromCaregiver = parsed.meta.find((item) => item.label === 'Previous caregiver')
  const toCaregiver = parsed.meta.find((item) => item.label === 'New caregiver')

  const alertSection = parsed.sections.find(
    (section) => section.kind === 'alerts' || section.emphasis === 'alert',
  )
  const alertCount = alertSection?.observations?.length ?? 0

  return (
    <div className={styles.handoverInteractive}>
      <header className={styles.handoverHero}>
        <div className={styles.handoverHeroTop}>
          <div>
            <h3 className={styles.handoverHeroTitle}>{parsed.title}</h3>
            {handoverDate ? (
              <p className={styles.handoverHeroMeta}>{handoverDate.value}</p>
            ) : null}
          </div>
          {alertCount > 0 ? (
            <div className={styles.handoverAlertPill}>
              <AlertTriangle size={14} aria-hidden="true" />
              {alertCount} open alert{alertCount === 1 ? '' : 's'}
            </div>
          ) : (
            <StatusBadge variant="normal" label="No open alerts" />
          )}
        </div>

        <div className={styles.handoverMetaGrid}>
          {patient ? <MetaCard label="Patient" value={patient.value} /> : null}
          {fromCaregiver ? <MetaCard label="From" value={fromCaregiver.value} /> : null}
          {toCaregiver ? (
            <MetaCard label="To" value={toCaregiver.value} />
          ) : (
            <MetaCard label="To" value="—" />
          )}
        </div>

        {fromCaregiver && toCaregiver ? (
          <div className={styles.handoverFlow}>
            <span className={styles.handoverFlowName}>
              <UserRound size={14} aria-hidden="true" />
              {fromCaregiver.value}
            </span>
            <ArrowRight size={16} className={styles.handoverFlowArrow} aria-hidden="true" />
            <span className={styles.handoverFlowName}>
              <UserRound size={14} aria-hidden="true" />
              {toCaregiver.value}
            </span>
          </div>
        ) : null}
      </header>

      {parsed.sections.map((section) => (
        <SummaryCollapsibleSection
          key={section.id}
          title={section.title}
          count={section.observations?.length ?? section.categories?.length}
          defaultOpen={section.defaultExpanded ?? section.emphasis === 'alert'}
          emphasis={section.emphasis}
        >
          <HandoverSectionContent section={section} />
        </SummaryCollapsibleSection>
      ))}

      <div className={styles.summaryRawToggle}>
        <button
          type="button"
          className={styles.summaryRawButton}
          onClick={() => setShowRaw((current) => !current)}
        >
          {showRaw ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {showRaw ? 'Hide full brief' : 'View full brief'}
        </button>
        {showRaw ? <pre className={styles.summaryRawText}>{summaryText}</pre> : null}
      </div>
    </div>
  )
}

export function HandoverBriefHint() {
  return (
    <p className={styles.handoverHint}>
      <ClipboardList size={14} aria-hidden="true" />
      Expand sections below to review recent observations and open alerts before starting care.
    </p>
  )
}
