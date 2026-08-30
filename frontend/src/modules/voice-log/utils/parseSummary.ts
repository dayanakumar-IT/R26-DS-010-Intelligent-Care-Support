export interface ParsedStat {
  label: string
  value: string
  variant?: 'default' | 'alert' | 'accent'
}

export interface ParsedCategoryCount {
  name: string
  count: number
}

export interface ParsedObservation {
  time?: string
  category?: string
  text: string
  alert: boolean
}

export interface ParsedSection {
  id: string
  title: string
  kind: 'stats' | 'categories' | 'observations' | 'alerts' | 'text'
  stats?: ParsedStat[]
  categories?: ParsedCategoryCount[]
  observations?: ParsedObservation[]
  lines?: string[]
  defaultExpanded?: boolean
  emphasis?: 'default' | 'alert' | 'info'
}

export interface ParsedPeriodSummary {
  title: string
  patientCode?: string
  dateRange?: { start: string; end: string }
  caregiver?: string
  empty: boolean
  emptyMessage?: string
  overviewStats: ParsedStat[]
  sections: ParsedSection[]
}

export interface ParsedHandoverSummary {
  title: string
  meta: ParsedStat[]
  sections: ParsedSection[]
}

const SECTION_HEADER = /^──\s*(.+?)\s*──$/
const TITLE_BANNER = /^═+\s*(.+?)\s*═+$/
const OBSERVATION_LINE =
  /^\s*•\s*(?:(\d{1,2}:\d{2})\s*)?(?:\[([^\]]+)\]\s*)?(.+?)(\s*\[ALERT\])?\s*$/i
const CATEGORY_COUNT = /^\s*•\s*([^:]+):\s*(\d+)\s*$/i
const ALERT_LINE = /^\s*•\s*Alert raised\s+(.+)$/i
const META_LINE =
  /^(date range|current caregiver|patient|handover date|previous caregiver|new caregiver|caregiver):/i

function isSkippedMetaLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) {
    return true
  }
  if (TITLE_BANNER.test(trimmed)) {
    return true
  }
  if (/^period summary/i.test(trimmed)) {
    return true
  }
  if (META_LINE.test(trimmed)) {
    return true
  }
  return false
}

function isMetricStat(label: string): boolean {
  const lower = label.toLowerCase()
  return (
    lower.includes('observation') ||
    lower.includes('alert') ||
    lower.includes('flagged') ||
    lower.includes('activity') ||
    lower.includes('care activity')
  )
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseObservationLine(line: string): ParsedObservation | null {
  const match = line.match(OBSERVATION_LINE)
  if (!match) {
    return null
  }
  return {
    time: match[1] || undefined,
    category: match[2]?.trim() || undefined,
    text: match[3].trim(),
    alert: Boolean(match[4]),
  }
}

function parseCategoryLine(line: string): ParsedCategoryCount | null {
  const bulletMatch = line.match(CATEGORY_COUNT)
  if (bulletMatch) {
    return {
      name: bulletMatch[1].trim(),
      count: Number.parseInt(bulletMatch[2], 10),
    }
  }
  const plainMatch = line.trim().match(/^([^:]+):\s*(\d+)\s*$/)
  if (plainMatch) {
    return {
      name: plainMatch[1].trim(),
      count: Number.parseInt(plainMatch[2], 10),
    }
  }
  return null
}

function statVariant(label: string, value: string): ParsedStat['variant'] {
  const lower = label.toLowerCase()
  if (lower.includes('alert') || lower.includes('flagged')) {
    const num = Number.parseInt(value, 10)
    if (!Number.isNaN(num) && num > 0) {
      return 'alert'
    }
  }
  if (lower.includes('observation') || lower.includes('activity')) {
    return 'accent'
  }
  return 'default'
}

function sectionEmphasis(title: string): ParsedSection['emphasis'] {
  const lower = title.toLowerCase()
  if (lower.includes('alert') || lower.includes('flagged')) {
    return 'alert'
  }
  if (lower.includes('overview') || lower.includes('highlights')) {
    return 'info'
  }
  return 'default'
}

function sectionDefaultExpanded(title: string, kind: ParsedSection['kind']): boolean {
  const lower = title.toLowerCase()
  if (kind === 'alerts') {
    return true
  }
  if (lower.includes('overview') || lower.includes('highlights') || lower.includes('breakdown')) {
    return true
  }
  if (lower.includes('medication') || lower.includes('excerpt')) {
    return false
  }
  return kind !== 'observations'
}

function extractDateRange(text: string): { start: string; end: string } | undefined {
  const rangeMatch = text.match(
    /(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})|(\d{4}-\d{2}-\d{2})\s*–\s*(\d{4}-\d{2}-\d{2})/i,
  )
  if (!rangeMatch) {
    return undefined
  }
  const start = rangeMatch[1] ?? rangeMatch[3]
  const end = rangeMatch[2] ?? rangeMatch[4]
  if (!start || !end) {
    return undefined
  }
  return { start, end }
}

function extractPatientCode(text: string): string | undefined {
  const codeMatch = text.match(/(?:Patient|Period Summary)[^A-Z0-9]*([A-Z]\d+)/i)
  return codeMatch?.[1]
}

const IMPLICIT_SECTION = /^(by category|category breakdown|recent highlights|recent observations|open alerts|flagged items|medication observations|patient overview|overview|recent adl breakdown|recent period summary excerpt):?\s*$/i

function parseSections(lines: string[]): ParsedSection[] {
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null
  let preambleStats: ParsedStat[] = []

  const flush = () => {
    if (!current) {
      return
    }
    sections.push(current)
    current = null
  }

  const startSection = (title: string) => {
    flush()
    const kind: ParsedSection['kind'] = (() => {
      const lower = title.toLowerCase()
      if (lower.includes('breakdown') || lower.includes('by category') || lower.includes('adl')) {
        return 'categories'
      }
      if (lower.includes('alert')) {
        return 'alerts'
      }
      if (
        lower.includes('observation') ||
        lower.includes('highlights') ||
        lower.includes('medication') ||
        lower.includes('flagged')
      ) {
        return 'observations'
      }
      if (lower.includes('overview')) {
        return 'stats'
      }
      return 'text'
    })()

    current = {
      id: slugify(title),
      title: title.replace(/:+$/, '').trim(),
      kind,
      stats: kind === 'stats' ? [] : undefined,
      categories: kind === 'categories' ? [] : undefined,
      observations: kind === 'observations' || kind === 'alerts' ? [] : undefined,
      lines: kind === 'text' ? [] : undefined,
      defaultExpanded: sectionDefaultExpanded(title, kind),
      emphasis: sectionEmphasis(title),
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line.trim() || line.includes('End of')) {
      continue
    }

    if (isSkippedMetaLine(line)) {
      continue
    }

    const sectionMatch = line.match(SECTION_HEADER)
    if (sectionMatch) {
      startSection(sectionMatch[1].trim())
      continue
    }

    const implicitMatch = line.match(IMPLICIT_SECTION)
    if (implicitMatch) {
      startSection(implicitMatch[1])
      continue
    }

    const observation = parseObservationLine(line)
    if (observation) {
      if (!current) {
        current = {
          id: 'observations',
          title: 'Observations',
          kind: 'observations',
          observations: [],
          defaultExpanded: true,
        }
      }
      if (!current.observations) {
        current.observations = []
        current.kind = 'observations'
      }
      current.observations.push(observation)
      continue
    }

    const category = parseCategoryLine(line)
    if (category) {
      if (!current) {
        current = {
          id: 'category-breakdown',
          title: 'Category breakdown',
          kind: 'categories',
          categories: [],
          defaultExpanded: true,
        }
      }
      if (!current.categories) {
        current.categories = []
        current.kind = 'categories'
      }
      current.categories.push(category)
      continue
    }

    const alertMatch = line.match(ALERT_LINE)
    if (alertMatch) {
      if (!current) {
        current = {
          id: 'open-alerts',
          title: 'Open alerts',
          kind: 'alerts',
          observations: [],
          defaultExpanded: true,
          emphasis: 'alert',
        }
      }
      if (!current.observations) {
        current.observations = []
      }
      current.observations.push({
        text: `Alert raised ${alertMatch[1].trim()}`,
        alert: true,
      })
      continue
    }

    const kvMatch = line.match(/^([^:]+):\s*(.+)$/)
    if (kvMatch && !line.startsWith('http')) {
      const label = kvMatch[1].trim()
      const value = kvMatch[2].trim()

      if (current?.kind === 'categories' && /^\d+$/.test(value)) {
        if (!current.categories) {
          current.categories = []
        }
        current.categories.push({ name: label, count: Number.parseInt(value, 10) })
        continue
      }

      const stat: ParsedStat = { label, value, variant: statVariant(label, value) }

      if (current?.kind === 'stats' && current.stats) {
        current.stats.push(stat)
      } else if (!current && isMetricStat(label)) {
        preambleStats.push(stat)
      } else if (current?.lines) {
        current.lines.push(line)
      } else if (current) {
        current.lines = [line]
        current.kind = 'text'
      }
      continue
    }

    if (current?.lines) {
      current.lines.push(line)
    }
  }

  flush()

  if (preambleStats.length > 0) {
    sections.unshift({
      id: 'overview',
      title: 'Overview',
      kind: 'stats',
      stats: preambleStats,
      defaultExpanded: true,
      emphasis: 'info',
    })
  }

  return sections
}

export function parsePeriodSummary(text: string): ParsedPeriodSummary {
  const lines = text.split('\n')
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean)

  const emptyMessage = nonEmpty.find((line) =>
    /no observations were recorded/i.test(line),
  )
  if (emptyMessage) {
    return {
      title: nonEmpty[0] ?? 'Period summary',
      patientCode: extractPatientCode(text),
      dateRange: extractDateRange(text),
      empty: true,
      emptyMessage,
      overviewStats: [],
      sections: [],
    }
  }

  let title = 'Period summary'
  const metaLines: string[] = []

  for (const line of nonEmpty) {
    const banner = line.match(TITLE_BANNER)
    if (banner) {
      title = banner[1].trim()
      continue
    }
    if (/^period summary/i.test(line) && !title.includes('—')) {
      title = line
      continue
    }
    if (line.startsWith('Date range:') || line.startsWith('Current caregiver:')) {
      metaLines.push(line)
    }
  }

  const sections = parseSections(lines)
  const overviewSection =
    sections.find(
      (section) => section.kind === 'stats' && section.title.toLowerCase() === 'overview',
    ) ??
    sections.find(
      (section) =>
        section.kind === 'stats' &&
        section.stats?.some((stat) => isMetricStat(stat.label)),
    )
  const overviewStats =
    overviewSection?.stats?.filter((stat) => isMetricStat(stat.label)) ?? []

  const caregiverLine = metaLines.find((line) => line.startsWith('Current caregiver:'))
  const caregiver = caregiverLine?.split(':').slice(1).join(':').trim()

  return {
    title,
    patientCode: extractPatientCode(text),
    dateRange: extractDateRange(text),
    caregiver: caregiver || undefined,
    empty: false,
    overviewStats,
    sections: sections.filter(
      (section) =>
        section.id !== 'overview' &&
        !(section.kind === 'stats' && section.title.toLowerCase() === 'overview'),
    ),
  }
}

export function parseHandoverSummary(text: string): ParsedHandoverSummary {
  const lines = text.split('\n')
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean)

  let title = 'Handover brief'
  const meta: ParsedStat[] = []

  for (const line of nonEmpty) {
    const banner = line.match(TITLE_BANNER)
    if (banner) {
      title = banner[1].trim()
      continue
    }
    const kvMatch = line.match(/^([^:]+):\s*(.+)$/)
    if (
      kvMatch &&
      ['Patient', 'Handover date', 'Previous caregiver', 'New caregiver'].includes(
        kvMatch[1].trim(),
      )
    ) {
      meta.push({
        label: kvMatch[1].trim(),
        value: kvMatch[2].trim(),
        variant: kvMatch[1].trim() === 'Patient' ? 'accent' : 'default',
      })
    }
  }

  const sections = parseSections(lines)

  return {
    title,
    meta,
    sections,
  }
}

export function formatSummaryTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
