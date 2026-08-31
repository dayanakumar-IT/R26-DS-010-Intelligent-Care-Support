import { useCallback, useState, type CSSProperties } from 'react'
import {
  Activity,
  Brain,
  Eye,
  Footprints,
  Lightbulb,
  Link as LinkIcon,
  PlayCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { PkSymptom } from '../../types/parkinsons'
import { getSymptomDemoVideo } from '../../services/parkinsonsApi'
import ParkinsonsVideoPlayer from './ParkinsonsVideoPlayer'

interface ParkinsonsSymptomCardProps {
  symptom: PkSymptom
}

interface Accent {
  border: string
  iconBg: string
  accent: string
  tint: string
  lookForBg: string
  lookForBorder: string
  blob: string
  memIcon: LucideIcon
}

// Soft pastel accent per symptom — visual only.
const ACCENTS: Record<string, Accent> = {
  bradykinesia: {
    border: '#F3C8D5',
    iconBg: '#F05D85',
    accent: '#D83C6A',
    tint: '#FFF9FB',
    lookForBg: '#FFF1F5',
    lookForBorder: '#F6D2DE',
    blob: '#F05D85',
    memIcon: Brain,
  },
  tremor: {
    border: '#DDD2FF',
    iconBg: '#7857E8',
    accent: '#6A46DE',
    tint: '#FBF9FF',
    lookForBg: '#F4F0FF',
    lookForBorder: '#DFD6FB',
    blob: '#7857E8',
    memIcon: Sparkles,
  },
  rigidity: {
    border: '#BFE8E5',
    iconBg: '#179C98',
    accent: '#0E8C88',
    tint: '#F7FEFD',
    lookForBg: '#EDFBFA',
    lookForBorder: '#C6EAE7',
    blob: '#179C98',
    memIcon: LinkIcon,
  },
  postural_instability: {
    border: '#DDD1FA',
    iconBg: '#7C4FE0',
    accent: '#6E3ED6',
    tint: '#FCFAFF',
    lookForBg: '#F5F0FE',
    lookForBorder: '#DFD3FA',
    blob: '#7C4FE0',
    memIcon: Lightbulb,
  },
  freezing_of_gait: {
    border: '#FFD4BB',
    iconBg: '#F47A3B',
    accent: '#E56A2C',
    tint: '#FFF9F5',
    lookForBg: '#FFF3EB',
    lookForBorder: '#FBD8C3',
    blob: '#F47A3B',
    memIcon: Footprints,
  },
  shuffling_gait: {
    border: '#C9DEFF',
    iconBg: '#2675DD',
    accent: '#1E67CC',
    tint: '#F7FBFF',
    lookForBg: '#EEF5FF',
    lookForBorder: '#CFE0FA',
    blob: '#2675DD',
    memIcon: Footprints,
  },
}

const FALLBACK: Accent = {
  border: '#E1E7F0',
  iconBg: '#6E5AE6',
  accent: '#5A48C8',
  tint: '#FBFBFF',
  lookForBg: '#F4F3FF',
  lookForBorder: '#E1DBF8',
  blob: '#6E5AE6',
  memIcon: Lightbulb,
}

export default function ParkinsonsSymptomCard({ symptom }: ParkinsonsSymptomCardProps) {
  const [showVideo, setShowVideo] = useState(false)
  const fetchUrl = useCallback(() => getSymptomDemoVideo(symptom.symptom_id), [symptom.symptom_id])

  const a = ACCENTS[symptom.symptom_id] ?? FALLBACK
  const MemIcon = a.memIcon

  const watchBtnStyle: CSSProperties & Record<string, string> = {
    borderColor: a.accent,
    color: a.accent,
    '--pk-tint': a.lookForBg,
    '--pk-accent': a.accent,
  }

  return (
    <article
      className="relative flex flex-col gap-3.5 overflow-hidden rounded-[18px] border p-6 shadow-[0_4px_14px_rgba(26,39,80,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_7px_20px_rgba(26,39,80,0.09)]"
      style={{ borderColor: a.border, background: a.tint }}
    >
      {/* decorative wave/blob — bottom-right, very subtle */}
      <span
        className="pointer-events-none absolute -bottom-12 -right-12 h-40 w-40 rounded-full"
        style={{ background: a.blob, opacity: 0.07 }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -bottom-4 right-6 h-16 w-24 rounded-[999px]"
        style={{ background: a.blob, opacity: 0.05 }}
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-3.5">
        <span
          className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-[14px] text-white"
          style={{ background: a.iconBg }}
          aria-hidden="true"
        >
          <Activity size={28} />
        </span>
        <h3 className="text-[21px] font-bold leading-tight text-[#17223E]">{symptom.display_name}</h3>
      </div>

      <p className="relative max-w-[60ch] text-[14.5px] leading-[1.55] text-[#4A5878]">
        {symptom.definition}
      </p>

      {symptom.learning_tip && (
        <div
          className="relative flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-sm"
          style={{ background: a.lookForBg, borderColor: a.lookForBorder }}
        >
          <Eye size={15} className="mt-0.5 shrink-0" style={{ color: a.accent }} aria-hidden="true" />
          <span className="text-[#3B4A6B]">
            <span className="font-bold" style={{ color: a.accent }}>
              Look for:{' '}
            </span>
            {symptom.learning_tip}
          </span>
        </div>
      )}

      {symptom.memory_trick && (
        <div className="relative flex items-start gap-2 text-[12.5px] text-[#73809A]">
          <MemIcon size={14} className="mt-0.5 shrink-0" style={{ color: a.accent }} aria-hidden="true" />
          <span>{symptom.memory_trick}</span>
        </div>
      )}

      <div className="relative mt-auto pt-1">
        {showVideo ? (
          <ParkinsonsVideoPlayer fetchUrl={fetchUrl} />
        ) : symptom.has_video ? (
          <button
            type="button"
            onClick={() => setShowVideo(true)}
            style={watchBtnStyle}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-transparent px-3.5 py-2 text-[13px] font-semibold transition hover:bg-[var(--pk-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pk-accent)] focus-visible:ring-offset-1"
          >
            <PlayCircle size={15} aria-hidden="true" />
            Watch example
          </button>
        ) : (
          <span className="text-xs text-[#94a3b8]">Video coming soon</span>
        )}
      </div>
    </article>
  )
}
