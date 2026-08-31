import { useMemo } from 'react'
import SignDemoPanel from './SignDemoPanel'
import type { GlossSign } from '../types/gloss'

interface McqFallbackCardProps {
  targetSignId: string
  allSigns: GlossSign[]
  onSelect: (selectedSignId: string) => void
  disabled: boolean
}

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

// Camera-unavailable fallback. This is a LEARNING mode: the caregiver
// watches a teaching reference (validated reference video if one
// exists, otherwise the 3D avatar — reused via SignDemoPanel) and then
// confirms which sign it is. It deliberately does NOT claim to assess
// movement or execution quality — there is no camera and no DTW here,
// so no execution score is shown for a quiz answer.
export default function McqFallbackCard({ targetSignId, allSigns, onSelect, disabled }: McqFallbackCardProps) {
  const targetSign = allSigns.find((sign) => sign.id === targetSignId)

  const options = useMemo(() => {
    const distractors = shuffled(allSigns.filter((sign) => sign.id !== targetSignId)).slice(0, 3)
    const correctOption: GlossSign = targetSign ?? { id: targetSignId, display_name: targetSignId }
    return shuffled([correctOption, ...distractors])
    // Only reshuffle when the target sign or catalogue changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSignId, allSigns])

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-slate-700">Watch the demonstration, then answer.</p>
        <p className="text-xs text-slate-400">
          Quiz mode checks that you can recognise the sign. It doesn&apos;t score how you move —
          use camera practice for execution feedback.
        </p>
      </div>

      <SignDemoPanel key={targetSignId} signId={targetSignId} signDisplayName={targetSign?.display_name} />

      <p className="text-sm font-medium text-slate-700">Which sign was that?</p>
      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.id)}
            className="rounded-[var(--radius-md)] border border-slate-200 px-4 py-3 text-left text-sm capitalize text-slate-700 transition hover:border-[var(--brand-blue)] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {option.display_name}
          </button>
        ))}
      </div>
    </div>
  )
}