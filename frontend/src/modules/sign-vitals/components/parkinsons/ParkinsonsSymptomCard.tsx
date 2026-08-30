import { useCallback, useState } from 'react'
import { Activity, Brain, Eye, PlayCircle } from 'lucide-react'
import type { PkSymptom } from '../../types/parkinsons'
import { getSymptomDemoVideo } from '../../services/parkinsonsApi'
import ParkinsonsVideoPlayer from './ParkinsonsVideoPlayer'

interface ParkinsonsSymptomCardProps {
  symptom: PkSymptom
}

export default function ParkinsonsSymptomCard({ symptom }: ParkinsonsSymptomCardProps) {
  const [showVideo, setShowVideo] = useState(false)
  const fetchUrl = useCallback(
    () => getSymptomDemoVideo(symptom.symptom_id),
    [symptom.symptom_id],
  )

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-5 shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
          <Activity size={18} />
        </span>
        <h3 className="text-base font-semibold text-slate-900">{symptom.display_name}</h3>
      </div>

      <p className="text-sm leading-relaxed text-slate-600">{symptom.definition}</p>

      {symptom.learning_tip && (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <Eye size={15} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            <span className="font-medium text-slate-500">Look for: </span>
            {symptom.learning_tip}
          </span>
        </div>
      )}

      {symptom.memory_trick && (
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <Brain size={13} className="mt-0.5 shrink-0 text-violet-400" />
          <span>{symptom.memory_trick}</span>
        </div>
      )}

      <div className="mt-auto pt-1">
        {showVideo ? (
          <ParkinsonsVideoPlayer fetchUrl={fetchUrl} />
        ) : symptom.has_video ? (
          <button
            type="button"
            onClick={() => setShowVideo(true)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <PlayCircle size={14} />
            Watch example
          </button>
        ) : (
          <span className="text-xs text-slate-400">Video coming soon</span>
        )}
      </div>
    </div>
  )
}
