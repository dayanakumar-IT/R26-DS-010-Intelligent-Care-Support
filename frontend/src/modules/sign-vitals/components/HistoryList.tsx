import { useEffect, useState } from 'react'
import { Check, ClipboardCheck, RotateCcw, X } from 'lucide-react'
import { cachedGlossHistory, peekGlossHistory } from '../services/glossCache'
import type { GlossHistoryEntry } from '../types/gloss'

// Task 4 — visual polish only. GET /gloss/history and its data are
// unchanged. Chronological, newest first, compact cards (not a table).
// Status is conveyed by icon + text + pastel accent, never colour alone.
// quality_tier / execution_score are shown only for a webcam attempt
// whose sign matched and went through DTW.

type Status = 'loading' | 'ready' | 'error'
const REQUESTED_LIMIT = 30

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

const TIER_LABEL: Record<string, string> = {
  strong: 'Strong execution',
  moderate: 'Getting there',
  weak: 'Needs work',
}

type Variant = 'correct' | 'mismatch' | 'quiz-correct' | 'quiz-wrong'

function variantFor(entry: GlossHistoryEntry): Variant {
  if (entry.attempt_type === 'multiple_choice') {
    return entry.is_correct_sign ? 'quiz-correct' : 'quiz-wrong'
  }
  return entry.is_correct_sign ? 'correct' : 'mismatch'
}

const ACCENT: Record<Variant, { bg: string; fg: string }> = {
  correct: { bg: '#ecfdf5', fg: '#047857' },
  mismatch: { bg: '#fef2f2', fg: '#b91c1c' },
  'quiz-correct': { bg: '#eff6ff', fg: '#1d4ed8' },
  'quiz-wrong': { bg: '#fff7ed', fg: '#c2410c' },
}

function StatusIcon({ variant }: { variant: Variant }) {
  if (variant === 'correct') return <Check size={16} />
  if (variant === 'mismatch') return <X size={16} />
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
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-800">
          {entry.target_display_name}
        </span>

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
        {(variant === 'quiz-correct' || variant === 'quiz-wrong') && (
          <span className="text-xs font-medium" style={{ color: accent.fg }}>
            {variant === 'quiz-correct' ? 'Correct quiz answer' : 'Wrong quiz answer'}
          </span>
        )}

        {/* execution / mode sub-line */}
        {variant === 'correct' && entry.quality_tier ? (
          <span className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>{TIER_LABEL[entry.quality_tier] ?? entry.quality_tier}</span>
            {entry.execution_score != null && (
              <span className="font-semibold text-slate-600">
                {Math.round(entry.execution_score * 100)}%
              </span>
            )}
          </span>
        ) : variant === 'quiz-correct' || variant === 'quiz-wrong' ? (
          <span className="text-[11px] text-slate-400">Recognition practice · movement not scored</span>
        ) : null}
      </div>

      <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-slate-400">
        {formatWhen(entry.attempted_at)}
      </span>
    </li>
  )
}

export default function HistoryList() {
  // Seed from the session cache so returning to this tab is instant.
  const cachedEntries = peekGlossHistory(REQUESTED_LIMIT)
  const [status, setStatus] = useState<Status>(cachedEntries !== undefined ? 'ready' : 'loading')
  const [entries, setEntries] = useState<GlossHistoryEntry[]>(cachedEntries ?? [])
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let isMounted = true
    if (peekGlossHistory(REQUESTED_LIMIT) === undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('loading')
    }
    cachedGlossHistory(REQUESTED_LIMIT)
      .then((data) => {
        if (!isMounted) return
        setEntries(data)
        setStatus('ready')
      })
      .catch(() => {
        if (isMounted) setStatus('error')
      })
    return () => {
      isMounted = false
    }
  }, [reloadToken])

  const header = (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-base font-semibold text-slate-900">Practice History</h2>
      <p className="text-xs text-slate-400">
        Your most recent learning attempts
        {status === 'ready' && entries.length > 0 && ` · showing latest ${entries.length}`}
      </p>
    </div>
  )

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="text-sm text-slate-500">Loading your recent attempts…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <div className="flex flex-col items-start gap-2 text-sm text-rose-600">
          <p>Couldn&apos;t load your history right now.</p>
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            className="flex items-center gap-1 text-xs font-medium underline"
          >
            <RotateCcw size={12} />
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {header}
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No attempts yet. Your practice history will appear here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <HistoryRow key={entry.attempt_id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  )
}