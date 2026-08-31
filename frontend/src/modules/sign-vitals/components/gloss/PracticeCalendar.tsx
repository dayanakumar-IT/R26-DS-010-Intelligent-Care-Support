import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

// Practised-day visual tiers, driven purely by the attempt count that
// GET /gloss/progress already returns.
type Tier = 0 | 1 | 2 | 3
function tierOf(count: number): Tier {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  return 3
}

const TIER_TILE: Record<Exclude<Tier, 0>, React.CSSProperties> = {
  1: { background: '#F3F1FF', color: '#4B3FC4', borderColor: '#E2DCFB' },
  2: { background: '#E8E3FF', color: '#3B2FB8', borderColor: '#CDC2FA' },
  3: {
    backgroundImage: 'linear-gradient(135deg,#E9E3FF,#DCD3FF)',
    color: '#2E239E',
    borderColor: '#B6A8F7',
    boxShadow: '0 3px 10px rgba(109,93,251,0.20)',
  },
}
const TIER_DOT: Record<Exclude<Tier, 0>, string> = {
  1: '#9A8CF7',
  2: '#6D5DFB',
  3: '#5046E5',
}

interface PracticeCalendarProps {
  /** date (YYYY-MM-DD) -> attempt count, from the existing progress data. */
  byDate: Map<string, number>
  selectedDate: string | null
  onSelectDate: (iso: string) => void
}

// Presentational only. Month view is local UI state; it just changes
// which cells render — no data is fetched or computed here.
export default function PracticeCalendar({ byDate, selectedDate, onSelectDate }: PracticeCalendarProps) {
  const today = new Date()
  const todayIso = isoOf(today.getFullYear(), today.getMonth(), today.getDate())
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const leadingBlanks = new Date(view.y, view.m, 1).getDay()
  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const monthPrefix = `${view.y}-${pad(view.m + 1)}`
  const practiceDays = [...byDate.entries()].filter(
    ([d, c]) => c > 0 && d.startsWith(monthPrefix),
  ).length

  const cells: Array<{ day: number; iso: string; count: number } | null> = []
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = isoOf(view.y, view.m, d)
    cells.push({ day: d, iso, count: byDate.get(iso) ?? 0 })
  }

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const next = v.m + delta
      return { y: v.y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 }
    })
  }

  return (
    <div className="overflow-hidden rounded-[20px] border-2 border-[#E4DEFB] bg-white shadow-[0_6px_20px_rgba(20,39,80,0.08)]">
      {/* Header strip */}
      <div
        className="flex items-center justify-between gap-3 border-b border-[#ECE7FB] px-5 py-4"
        style={{ backgroundImage: 'linear-gradient(120deg,#F6F3FF,#EEF3FF)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#6E5AE6] shadow-sm">
            <CalendarDays size={17} aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <p className="text-sm font-bold text-[#17223E]">Practice Activity</p>
            <p className="text-xs font-medium text-[#6E5AE6]">{monthLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[#DED9FB] bg-white text-[#5046E5] transition hover:bg-[#F1EEFF]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[#DED9FB] bg-white text-[#5046E5] transition hover:bg-[#F1EEFF]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-7 gap-2 border-b border-[#EEF1F6] pb-2 text-center text-[10px] font-bold uppercase tracking-wide text-[#9aa5bd]">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((cell, i) => {
            if (!cell) return <span key={`b${i}`} className="aspect-square" />
            const tier = tierOf(cell.count)
            const selected = cell.iso === selectedDate
            const isToday = cell.iso === todayIso
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => onSelectDate(cell.iso)}
                aria-pressed={selected}
                aria-label={`${cell.iso}${
                  tier > 0 ? `, ${cell.count} attempt${cell.count === 1 ? '' : 's'}` : ', no practice'
                }`}
                className="relative flex aspect-square flex-col items-center justify-center rounded-[12px] border text-[12.5px] font-bold transition duration-150 hover:-translate-y-0.5 hover:brightness-[0.98]"
                style={
                  selected
                    ? {
                        backgroundImage: 'linear-gradient(135deg,#6D5DFB,#4A3FDA)',
                        color: '#ffffff',
                        borderColor: '#ffffff',
                        boxShadow:
                          '0 6px 16px rgba(74,63,218,0.35), 0 0 0 3px rgba(109,93,251,0.20)',
                      }
                    : tier !== 0
                      ? TIER_TILE[tier]
                      : { background: '#F7F8FC', color: '#9aa5bd', borderColor: '#EEF1F6' }
                }
              >
                <span>{cell.day}</span>
                {tier !== 0 && (
                  <span
                    className="absolute bottom-1.5 rounded-full"
                    style={{
                      height: tier === 3 ? 5 : 4,
                      width: tier === 3 ? 5 : 4,
                      background: selected ? '#ffffff' : TIER_DOT[tier],
                    }}
                    aria-hidden="true"
                  />
                )}
                {tier === 3 && !selected && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[12px] ring-1 ring-inset ring-[#B6A8F7]"
                    aria-hidden="true"
                  />
                )}
                {isToday && !selected && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[12px] ring-2 ring-[#365FD9]/50"
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF1F6] pt-3 text-[11px] text-[#73809A]">
          <span className="font-semibold text-[#5046E5]">
            {practiceDays} practice day{practiceDays === 1 ? '' : 's'} this month
          </span>
          <span className="flex items-center gap-3" aria-hidden="true">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[4px] bg-[#F3F1FF] ring-1 ring-inset ring-[#E2DCFB]" />
              <span className="h-2.5 w-2.5 rounded-[4px] bg-[#E8E3FF] ring-1 ring-inset ring-[#CDC2FA]" />
              <span className="h-2.5 w-2.5 rounded-[4px] bg-[#DCD3FF] ring-1 ring-inset ring-[#B6A8F7]" />
              Practice done
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[4px] bg-[#F7F8FC] ring-1 ring-inset ring-[#EEF1F6]" />
              No practice
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
