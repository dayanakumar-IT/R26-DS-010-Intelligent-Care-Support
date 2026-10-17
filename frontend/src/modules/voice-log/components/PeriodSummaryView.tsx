import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CalendarRange,
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
  parsePeriodSummary,
  type ParsedCategoryCount,
  type ParsedObservation,
  type ParsedSection,
  type ParsedStat,
} from '../utils/parseSummary'

interface PeriodSummaryViewProps {
  summaryText: string
  audioUrl?: string | null
}

function toCategoryKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_')
}

function StatCard({ stat }: { stat: ParsedStat }) {
  const variantClass =
    stat.variant === 'alert'
      ? styles.summaryStatAlert
      : stat.variant === 'accent'
        ? styles.summaryStatAccent
        : ''
  return (
    <article className={`${styles.summaryStatCard} ${variantClass}`}>
      <p className={styles.summaryStatValue}>{stat.value}</p>
      <p className={styles.summaryStatLabel}>{stat.label}</p>
    </article>
  )
}

function CategoryBreakdown({ categories }: { categories: ParsedCategoryCount[] }) {
  const max = Math.max(...categories.map((item) => item.count), 1)
  return (
    <ul className={styles.summaryCategoryList}>
      {categories.map((item) => (
        <li key={item.name} className={styles.summaryCategoryRow}>
          <div className={styles.summaryCategoryHeader}>
            <CategoryBadge category={toCategoryKey(item.name)} />
            <span className={styles.summaryCategoryCount}>{item.count}</span>
          </div>
          <div className={styles.summaryCategoryTrack} aria-hidden="true">
            <span
              className={styles.summaryCategoryFill}
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ObservationCard({ observation }: { observation: ParsedObservation }) {
  return (
    <article
      className={`${styles.summaryObservationCard} ${
        observation.alert ? styles.summaryObservationCardAlert : ''
      }`}
    >
      <div className={styles.summaryObservationHeader}>
        {observation.time ? (
          <span className={styles.summaryObservationTime}>{observation.time}</span>
        ) : null}
        {observation.category ? (
          <CategoryBadge category={toCategoryKey(observation.category)} />
        ) : null}
        {observation.alert ? <StatusBadge variant="alert" label="Alert" /> : null}
      </div>
      <p className={styles.summaryObservationText}>{observation.text}</p>
    </article>
  )
}

function SectionContent({ section }: { section: ParsedSection }) {
  if (section.kind === 'stats' && section.stats?.length) {
    return (
      <div className={styles.summaryStatGrid}>
        {section.stats.map((stat) => (
          <StatCard key={`${stat.label}-${stat.value}`} stat={stat} />
        ))}
      </div>
    )
  }

  if (section.kind === 'categories' && section.categories?.length) {
    return <CategoryBreakdown categories={section.categories} />
  }

  if (section.observations?.length) {
    return (
      <div className={styles.summaryObservationList}>
        {section.observations.map((observation, index) => (
          <ObservationCard
            key={`${observation.time ?? 't'}-${observation.text}-${index}`}
            observation={{
              ...observation,
              text: observation.alert
                ? observation.text.replace(/\s*\[ALERT\]\s*$/i, '')
                : observation.text,
            }}
          />
        ))}
      </div>
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

export default function PeriodSummaryView({ summaryText, audioUrl }: PeriodSummaryViewProps) {
  const [showRaw, setShowRaw] = useState(false)
  const parsed = useMemo(() => parsePeriodSummary(summaryText), [summaryText])

  const headlineStats = useMemo(() => {
    const metrics = parsed.overviewStats.filter((stat) =>
      /observation|alert|flagged|activity/i.test(stat.label),
    )
    if (metrics.length > 0) {
      return metrics.slice(0, 4)
    }
    return []
  }, [parsed.overviewStats])

  const categorySection = parsed.sections.find((section) => section.kind === 'categories')
  const detailSections = parsed.sections.filter(
    (section) => section.kind !== 'categories' && section.kind !== 'stats',
  )

  if (parsed.empty) {
    return (
      <div className={styles.summaryEmpty}>
        <CalendarRange size={28} aria-hidden="true" />
        <p className={styles.summaryEmptyTitle}>No activity in this period</p>
        <p className={styles.summaryEmptyDescription}>
          {parsed.emptyMessage ?? 'No observations were recorded during the selected date range.'}
        </p>
        {parsed.dateRange ? (
          <p className={styles.summaryEmptyMeta}>
            {parsed.dateRange.start} → {parsed.dateRange.end}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.summaryInteractive}>
      <header className={styles.summaryHero}>
        <div className={styles.summaryHeroText}>
          <h3 className={styles.summaryHeroTitle}>{parsed.title}</h3>
          <div className={styles.summaryHeroMetaRow}>
            {parsed.dateRange ? (
              <p className={styles.summaryHeroMeta}>
                <CalendarRange size={14} aria-hidden="true" />
                {parsed.dateRange.start} → {parsed.dateRange.end}
              </p>
            ) : null}
            {parsed.caregiver ? (
              <p className={styles.summaryHeroMeta}>
                <UserRound size={14} aria-hidden="true" />
                {parsed.caregiver}
              </p>
            ) : null}
          </div>
        </div>
        {headlineStats.length > 0 ? (
          <div className={styles.summaryHeroStats}>
            {headlineStats.map((stat) => (
              <StatCard key={`${stat.label}-${stat.value}`} stat={stat} />
            ))}
          </div>
        ) : null}
      </header>

      {categorySection?.categories?.length ? (
        <SummaryCollapsibleSection
          title={categorySection.title}
          count={categorySection.categories.length}
          defaultOpen={categorySection.defaultExpanded}
          emphasis="info"
        >
          <CategoryBreakdown categories={categorySection.categories} />
        </SummaryCollapsibleSection>
      ) : null}

      {detailSections.map((section) => (
        <SummaryCollapsibleSection
          key={section.id}
          title={section.title}
          count={section.observations?.length ?? section.categories?.length}
          defaultOpen={section.defaultExpanded}
          emphasis={section.emphasis}
        >
          <SectionContent section={section} />
        </SummaryCollapsibleSection>
      ))}

      {audioUrl ? (
        <div className={styles.summaryAudio}>
          <p className={styles.summaryPanelTitle}>Listen to summary</p>
          <audio controls src={audioUrl} className={styles.summaryAudioPlayer}>
            <track kind="captions" />
          </audio>
        </div>
      ) : null}

      <div className={styles.summaryRawToggle}>
        <button
          type="button"
          className={styles.summaryRawButton}
          onClick={() => setShowRaw((current) => !current)}
        >
          {showRaw ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {showRaw ? 'Hide full text' : 'View full text'}
        </button>
        {showRaw ? <pre className={styles.summaryRawText}>{summaryText}</pre> : null}
      </div>
    </div>
  )
}

export function PeriodSummaryQuickStats({ summaryText }: { summaryText: string }) {
  const parsed = useMemo(() => parsePeriodSummary(summaryText), [summaryText])
  const observations =
    parsed.overviewStats.find((stat) => stat.label.toLowerCase().includes('observation'))?.value ??
    '—'
  const alerts =
    parsed.overviewStats.find((stat) => stat.label.toLowerCase().includes('alert'))?.value ?? '0'

  return (
    <div className={styles.summaryQuickStats}>
      <span className={styles.summaryQuickStat}>
        <ClipboardList size={14} aria-hidden="true" />
        {observations} observations
      </span>
      <span className={styles.summaryQuickStat}>
        <Activity size={14} aria-hidden="true" />
        {parsed.sections.length} sections
      </span>
      {Number.parseInt(alerts, 10) > 0 ? (
        <span className={`${styles.summaryQuickStat} ${styles.summaryQuickStatAlert}`}>
          <AlertTriangle size={14} aria-hidden="true" />
          {alerts} alerts
        </span>
      ) : null}
    </div>
  )
}
