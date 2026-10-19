import { useMemo } from 'react'
import { Check, ClipboardCheck, X } from 'lucide-react'
import SignDemoPanel from './SignDemoPanel'
import type { GlossSign } from '../types/gloss'

interface McqFallbackCardProps {
  targetSignId: string
  allSigns: GlossSign[]
  onSelect: (selectedSignId: string) => void
  disabled: boolean
  // Quiz session only: the checked answer, highlighted until the next sign.
  answer?: { selectedSignId: string; correct: boolean } | null
  // Quiz session only: questions answered / correct so far.
  progress?: { answered: number; correct: number }
}

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

const LETTERS = ['A', 'B', 'C', 'D']

// Camera-unavailable fallback. This is a LEARNING mode: the caregiver
// watches a teaching reference (validated reference video if one
// exists, otherwise the 3D avatar — reused via SignDemoPanel) and then
// confirms which sign it is. It deliberately does NOT claim to assess
// movement or execution quality — there is no camera and no DTW here,
// so no execution score is shown for a quiz answer.
export default function McqFallbackCard({
  targetSignId,
  allSigns,
  onSelect,
  disabled,
  answer = null,
  progress,
}: McqFallbackCardProps) {
  const targetSign = allSigns.find((sign) => sign.id === targetSignId)

  const options = useMemo(() => {
    const distractors = shuffled(allSigns.filter((sign) => sign.id !== targetSignId)).slice(0, 3)
    const correctOption: GlossSign = targetSign ?? { id: targetSignId, display_name: targetSignId }
    return shuffled([correctOption, ...distractors])
    // Only reshuffle when the target sign or catalogue changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSignId, allSigns])

  const locked = disabled || answer !== null
  const targetName = targetSign?.display_name ?? targetSignId.replace(/_/g, ' ')

  const optionClass = (optionId: string): string => {
    const base =
      'group flex w-full items-center gap-3 rounded-[14px] border-2 px-4 py-3.5 text-left text-base font-semibold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]'
    if (answer) {
      if (optionId === targetSignId) return `${base} border-emerald-400 bg-emerald-50 text-emerald-800`
      if (optionId === answer.selectedSignId) return `${base} border-rose-300 bg-rose-50 text-rose-700`
      return `${base} border-slate-200 bg-white text-slate-400 opacity-70`
    }
    return `${base} border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-[var(--brand-blue)] hover:bg-blue-50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0`
  }

  const badgeClass = (optionId: string): string => {
    const base = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold'
    if (answer && optionId === targetSignId) return `${base} bg-emerald-500 text-white`
    if (answer && optionId === answer.selectedSignId) return `${base} bg-rose-500 text-white`
    return `${base} bg-slate-100 text-slate-500 group-hover:bg-[var(--brand-blue)] group-hover:text-white`
  }

  return (
    <div className="flex flex-col gap-5 rounded-[22px] border border-[#D5E2F6] bg-white p-5 shadow-[0_4px_14px_rgba(15,35,70,0.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#2563EB]">
            <ClipboardCheck size={16} aria-hidden="true" />
            Quiz mode{progress ? ` · Question ${progress.answered + (answer ? 0 : 1)}` : ''}
          </span>
          <p className="text-base font-medium text-slate-700">Watch the demonstration, then choose the sign.</p>
          <p className="text-xs text-slate-400">
            Quiz mode checks that you can recognise the sign. It doesn&apos;t score how you move —
            use camera practice for execution feedback.
          </p>
        </div>
        {progress && progress.answered > 0 && (
          <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-sm font-semibold text-[var(--brand-blue)]">
            {progress.correct} of {progress.answered} correct
          </span>
        )}
      </div>

      {/* The demonstration is capped in width so the whole avatar (and its
          controls) fits on screen with the options below it. */}
      <div className="mx-auto w-full max-w-[520px] rounded-[18px] bg-[#F8FBFF] p-3">
        <SignDemoPanel key={targetSignId} signId={targetSignId} signDisplayName={targetSign?.display_name} />
      </div>

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
        <p className="text-center text-lg font-bold text-slate-900">Which sign was that?</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              disabled={locked}
              onClick={() => onSelect(option.id)}
              className={optionClass(option.id)}
            >
              <span className={badgeClass(option.id)}>
                {answer && option.id === targetSignId ? (
                  <Check size={16} aria-hidden="true" />
                ) : answer && option.id === answer.selectedSignId ? (
                  <X size={16} aria-hidden="true" />
                ) : (
                  LETTERS[index]
                )}
              </span>
              {option.display_name}
            </button>
          ))}
        </div>

        {answer && (
          <p
            role="status"
            className={`rounded-[14px] px-4 py-3 text-center text-sm font-medium ${
              answer.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
            }`}
          >
            {answer.correct ? 'Correct!' : <>Not quite — that was <span className="capitalize">&ldquo;{targetName}&rdquo;</span>.</>}{' '}
            {progress && 'Next sign coming up…'}
          </p>
        )}
      </div>
    </div>
  )
}
