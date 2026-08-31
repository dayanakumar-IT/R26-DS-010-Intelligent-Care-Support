import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { PkSymptom } from '../../types/parkinsons'
import { getParkinsonsSymptoms } from '../../services/parkinsonsApi'
import ParkinsonsSymptomCard from './ParkinsonsSymptomCard'

interface ParkinsonsSymptomExplorerProps {
  onBack: () => void
}

export default function ParkinsonsSymptomExplorer({ onBack }: ParkinsonsSymptomExplorerProps) {
  const [symptoms, setSymptoms] = useState<PkSymptom[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getParkinsonsSymptoms()
      .then((res) => {
        if (active) setSymptoms(res.symptoms)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load symptoms.')
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex w-full flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-sm font-medium text-[#6E5AE6] transition hover:text-[#5046E5]"
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-[28px] font-bold leading-tight text-[#17223E]">Explore symptoms</h2>
        <p className="max-w-2xl text-[15px] text-[#73809A]">
          Short educational cards for each movement pattern, with what to look for and a memory trick.
        </p>
      </div>

      {error && (
        <p className="rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {!symptoms && !error && (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-[18px] border border-[#E7EAF2] bg-white/70"
            />
          ))}
        </div>
      )}

      {symptoms && symptoms.length === 0 && (
        <p className="rounded-[18px] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          No symptom content is available yet.
        </p>
      )}

      {symptoms && symptoms.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {symptoms.map((s) => (
            <ParkinsonsSymptomCard key={s.symptom_id} symptom={s} />
          ))}
        </div>
      )}
    </div>
  )
}
