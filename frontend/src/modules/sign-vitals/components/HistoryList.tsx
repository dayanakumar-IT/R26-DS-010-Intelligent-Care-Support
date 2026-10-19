import { useEffect, useState } from 'react'
import { Check, ChevronDown, ClipboardCheck, HelpCircle, RotateCcw, X } from 'lucide-react'
import { getGlossHistoryPage } from '../services/glossApi'
import type { GlossHistoryEntry } from '../types/gloss'
import { TIER_LABEL } from '../utils/progressLabels'

// Practice history (on the Progress tab, beside the calendar): newest
// first, a page at a time ("Load more"), or one calendar day when a day is
// selected. Compact cards (not a table), each with its mode tag.
// Status is conveyed by icon + text + pastel accent, never colour alone.
// quality_tier / execution_score are shown only for a webcam attempt
// whose sign matched and went through DTW.

type Status = 'loading' | 'ready' | 'error'
const PAGE = 20

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type Variant = 'correct' | 'mismatch' | 'not-recognised' | 'quiz-correct' | 'quiz-wrong'

function Tag({ children, title }: { children: string; title?: string }) {
  return (
    <span title={title} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-slate-600">
      {children}
    </span>
  )
}

function modeTag(entry: GlossHistoryEntry): string {
  if (entry.mode === 'free') return 'Check'
  if (entry.mode === 'recall') return 'Recall'
  return entry.attempt_type === 'multiple_choice' ? 'Quiz' : 'Practice'
}

function variantFor(entry: GlossHistoryEntry): Variant {
  if (entry.attempt_type === 'multiple_choice') {
    return entry.is_correct_sign ? 'quiz-correct' : 'quiz-wrong'
  }
  if (entry.not_recognised || entry.mode === 'free') return 'not-recognised'
  return entry.is_correct_sign ? 'correct' : 'mismatch'
}

const ACCENT: Record<Variant, { bg: string; fg: string }> = {
  correct: { bg: '#ecfdf5', fg: '#047857' },
  mismatch: { bg: '#fef2f2', fg: '#b91c1c' },
  'not-recognised': { bg: '#f1f5f9', fg: '#475569' },
  'quiz-correct': { bg: '#eff6ff', fg: '#1d4ed8' },
  'quiz-wrong': { bg: '#fff7ed', fg: '#c2410c' },
}

function StatusIcon({ variant }: { variant: Variant }) {
  if (variant === 'correct') return <Check size={16} />
  if (variant === 'mismatch') return <X size={16} />
  if (variant === 'not-recognised') return <HelpCircle size={16} />
  return <ClipboardCheck size={16} />
}

function HistoryRow({ entry }: { entry: GlossHistoryEntry }) {
  const variant = variantFor(entry)
  const accent = ACCENT[variant]

  return (
    <li className="flex items-start gap-3 rounded-[var(--radius-md)] border border-slate-200 bg-white p-3">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: accent.bg, color: accent.fg }}
      >
        <StatusIcon variant={variant} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-800">
          {entry.mode === 'free' ? 'Check my sign' : entry.target_display_name}
          <Tag>{modeTag(entry)}</Tag>
          {entry.earlier_version && <Tag title="Made with an earlier version of the camera check: counts as practice, not toward Demonstrated or levels">Earlier version</Tag>}
        </span>
        {entry.mode === 'free' && (
          <span className="text-xs text-slate-500">
            {entry.recognized_display_name ? `The camera thought: ${entry.recognized_display_name}` : 'No match among the 59 signs'}
            <span className="text-slate-400"> · Not counted towards progress</span>
          </span>
        )}
        {variant === 'correct' && (
          <span className="text-xs font-medium" style={{ color: accent.fg }}>
            Correct sign
          </span>
        )}
        {variant === 'mismatch' && (
          <span className="text-xs">
            <span className="font-medium" style={{ color: accent.fg }}>
              {entry.recognized_display_name
                ? `Recognised as ${entry.recognized_display_name}`
                : 'Not recognised'}
            </span>
            <span className="text-slate-400"> · Try again</span>
          </span>
        )}
        {variant === 'not-recognised' && entry.mode !== 'free' && (
          <span className="text-xs">
            <span className="font-medium" style={{ color: accent.fg }}>
              Not recognised
            </span>
            <span className="text-slate-400"> · Not counted towards progress</span>
          </span>
        )}
        {(variant === 'quiz-correct' || variant === 'quiz-wrong') && (
          <span className="text-xs font-medium" style={{ color: accent.fg }}>
            {variant === 'quiz-correct' ? 'Quiz: correct' : 'Quiz: wrong'}
          </span>
        )}

        {/* execution / mode sub-line */}
        {variant === 'correct' && entry.quality_tier ? (
          <span className="text-xs text-slate-500">Movement: {TIER_LABEL[entry.quality_tier]}</span>
        ) : variant === 'quiz-correct' || variant === 'quiz-wrong' ? (
          <span className="text-xs text-slate-500">Quiz answer · movement not scored</span>
        ) : null}
      </div>

      <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-slate-400">
        {formatWhen(entry.attempted_at)}
      </span>
    </li>
  )
}

// One quiz session (camera unavailable): its answers share a session id
// and are listed as one row; opening it shows the word list.
type HistoryItem =
  | { kind: 'attempt'; entry: GlossHistoryEntry }
  | { kind: 'quiz'; sessionId: string; entries: GlossHistoryEntry[] }

function groupQuizSessions(entries: GlossHistoryEntry[]): HistoryItem[] {
  const items: HistoryItem[] = []
  const quizBySession = new Map<string, GlossHistoryEntry[]>()
  for (const entry of entries) {
    if (entry.attempt_type === 'multiple_choice' && entry.mode !== 'recall' && entry.session_id) {
      const group = quizBySession.get(entry.session_id)
      if (group) {
        group.push(entry)
        continue
      }
      const fresh = [entry]
      quizBySession.set(entry.session_id, fresh)
      items.push({ kind: 'quiz', sessionId: entry.session_id, entries: fresh })
      continue
    }
    items.push({ kind: 'attempt', entry })
  }
  return items
}

function QuizSessionRow({ entries }: { entries: GlossHistoryEntry[] }) {
  const [open, setOpen] = useState(false)
  const correct = entries.filter((e) => e.is_correct_sign).length
  const newest = entries[0]
  const oldest = entries[entries.length - 1]
  // Entries are newest first; the word list reads in the order answered.
  const inOrder = [...entries].reverse()

  return (
    <li className="rounded-[var(--radius-md)] border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 rounded-[var(--radius-md)] p-3 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]"
      >
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: ACCENT['quiz-correct'].bg, color: ACCENT['quiz-correct'].fg }}
        >
          <ClipboardCheck size={16} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-800">
            Quiz session
            <Tag>Quiz</Tag>
          </span>
          <span className="text-xs font-medium" style={{ color: ACCENT['quiz-correct'].fg }}>
            {entries.length} word{entries.length === 1 ? '' : 's'} · {correct} correct
          </span>
          <span className="text-xs text-slate-500">
            {open ? 'Hide the words' : 'Show the words'} · movement not scored
          </span>
        </div>

        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap pt-0.5 text-[11px] text-slate-400">
          {entries.length > 1 && oldest.attempted_at !== newest.attempted_at
            ? `${formatWhen(oldest.attempted_at)} – ${new Date(newest.attempted_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
            : formatWhen(newest.attempted_at)}
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <ol className="flex flex-col gap-1.5 border-t border-slate-100 px-3 pb-3 pt-2">
          {inOrder.map((entry, index) => {
            const variant: Variant = entry.is_correct_sign ? 'quiz-correct' : 'quiz-wrong'
            return (
              <li key={entry.attempt_id} className="flex items-center gap-2.5 rounded-[10px] bg-slate-50 px-3 py-2 text-sm">
                <span className="w-5 shrink-0 text-right text-xs text-slate-400">{index + 1}.</span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: ACCENT[variant].bg, color: ACCENT[variant].fg }}
                >
                  {entry.is_correct_sign ? <Check size={13} /> : <X size={13} />}
                </span>
                <span className="font-semibold capitalize text-slate-800">{entry.target_display_name}</span>
                <span className="ml-auto text-xs" style={{ color: ACCENT[variant].fg }}>
                  {entry.is_correct_sign
                    ? 'Correct'
                    : entry.recognized_display_name
                      ? `You chose ${entry.recognized_display_name}`
                      : 'Wrong'}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </li>
  )
}

function dayBounds(dateKey: string): { start: string; end: string } {
  const [y, m, d] = dateKey.split('-').map(Number)
  return { start: new Date(y, m - 1, d).toISOString(), end: new Date(y, m - 1, d + 1).toISOString() }
}

function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

interface HistoryListProps {
  /** Local YYYY-MM-DD from the calendar: show that day only. */
  selectedDate: string | null
  onClearDate: () => void
}

export default function HistoryList({ selectedDate, onClearDate }: HistoryListProps) {
  const [status, setStatus] = useState<Status>('loading')
  const [entries, setEntries] = useState<GlossHistoryEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let isMounted = true
    const day = selectedDate ? dayBounds(selectedDate) : null
    getGlossHistoryPage(day ? { limit: 100, ...day } : { limit: PAGE })
      .then((page) => {
        if (!isMounted) return
        setEntries(page.attempts)
        setHasMore(page.has_more)
        setStatus('ready')
      })
      .catch(() => {
        if (isMounted) setStatus('error')
      })
    return () => {
      isMounted = false
    }
  }, [selectedDate, reloadToken])

  const checks = entries.filter((e) => e.mode === 'free').length
  const counted = entries.length - checks

  const loadMore = () => {
    const last = entries[entries.length - 1]
    if (!last) return
    setLoadingMore(true)
    const day = selectedDate ? dayBounds(selectedDate) : null
    getGlossHistoryPage({ limit: day ? 100 : PAGE, before: last.attempted_at, ...(day ?? {}) })
      .then((page) => {
        setEntries((prev) => [...prev, ...page.attempts])
        setHasMore(page.has_more)
      })
      .catch(() => setStatus('error'))
      .finally(() => setLoadingMore(false))
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Practice history">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[#17223E]">Practice History</h3>
        {selectedDate ? (
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-[#EEF5FF] px-2.5 py-0.5 font-medium text-[#1d4ed8]">{dayLabel(selectedDate)}</span>
            {status === 'ready' && entries.length > 0 && (
              // Same count as the calendar (practice, recall, quiz); Check my
              // sign is listed too but never counted.
              <span>
                {counted} attempt{counted === 1 ? '' : 's'}
                {checks > 0 && ` + ${checks} Check my sign`}
                {hasMore && '…'}
              </span>
            )}
            <button
              type="button"
              onClick={onClearDate}
              className="font-medium text-[#2563EB] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]"
            >
              Show all days
            </button>
          </span>
        ) : (
          <span className="text-sm text-slate-500">Newest first · pick a day on the calendar to filter</span>
        )}
      </div>

      {status === 'loading' && <p className="text-sm text-slate-500">Loading your practice history…</p>}

      {status === 'error' && (
        <div className="flex flex-col items-start gap-2 text-sm text-rose-600">
          <p>Couldn&apos;t load your history right now.</p>
          <button
            type="button"
            onClick={() => {
              setStatus('loading')
              setReloadToken((n) => n + 1)
            }}
            className="flex items-center gap-1 text-sm font-medium underline"
          >
            <RotateCcw size={14} />
            Try again
          </button>
        </div>
      )}

      {status === 'ready' &&
        (entries.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[#E1E7F0] bg-white px-4 py-5 text-sm text-[#4B5873]">
            {selectedDate ? 'No practice on this day.' : 'No attempts yet. Your practice history will appear here.'}
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {groupQuizSessions(entries).map((item) =>
                item.kind === 'quiz' ? (
                  <QuizSessionRow key={`quiz-${item.sessionId}`} entries={item.entries} />
                ) : (
                  <HistoryRow key={item.entry.attempt_id} entry={item.entry} />
                ),
              )}
            </ul>
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="self-center rounded-[var(--radius-md)] border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-blue)]"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        ))}
    </section>
  )
}
