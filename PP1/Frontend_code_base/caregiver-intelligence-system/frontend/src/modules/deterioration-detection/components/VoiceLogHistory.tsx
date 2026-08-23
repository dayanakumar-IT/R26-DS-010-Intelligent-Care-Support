import { Mic } from 'lucide-react'
import type { VoiceLogEntry } from '../types/deterioration.types'

export function VoiceLogHistory({ entries }: { entries: VoiceLogEntry[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[#1F2937]">Voice log excerpts</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            De-identified clips scored by acoustic stress classifier (demo transcripts)
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
          <Mic size={12} aria-hidden />
          Acoustic
        </span>
      </div>

      <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {entries.map((log) => (
          <div
            key={log.id}
            className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 transition-colors hover:bg-gray-50"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#1F2937]">{log.recordedAt}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${log.stressProbability > 60 ? '#FEF2F2' : '#F5F3FF'}`,
                  color: log.stressProbability > 60 ? '#DC2626' : '#5B21B6',
                }}
              >
                Stress {log.stressProbability}%
              </span>
            </div>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400">{log.shiftContext}</p>
            <p className="mt-2 text-sm leading-snug text-gray-600">{log.excerpt}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
