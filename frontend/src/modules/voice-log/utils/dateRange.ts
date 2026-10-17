export function defaultPeriodFromAvailable(dates: string[]): { start: string; end: string } {
  if (dates.length === 0) {
    return { start: '', end: '' }
  }
  const end = dates[dates.length - 1]!
  const startIndex = Math.max(0, dates.length - 7)
  return { start: dates[startIndex]!, end }
}

export function sanitizePeriodSelection(
  dates: string[],
  start: string,
  end: string,
): { start: string; end: string } {
  if (dates.length === 0) {
    return { start: '', end: '' }
  }

  const validStarts = dates.filter((date) => !end || date <= end)
  const validEnds = dates.filter((date) => !start || date >= start)

  let nextStart = dates.includes(start) ? start : validStarts[validStarts.length - 1] ?? dates[0]!
  let nextEnd = dates.includes(end) ? end : validEnds[validEnds.length - 1] ?? dates[dates.length - 1]!

  if (nextStart > nextEnd) {
    nextStart = nextEnd
  }

  return { start: nextStart, end: nextEnd }
}

export function filterDatesForStart(dates: string[], maxEnd?: string): string[] {
  if (!maxEnd) {
    return dates
  }
  return dates.filter((date) => date <= maxEnd)
}

export function filterDatesForEnd(dates: string[], minStart?: string): string[] {
  if (!minStart) {
    return dates
  }
  return dates.filter((date) => date >= minStart)
}
