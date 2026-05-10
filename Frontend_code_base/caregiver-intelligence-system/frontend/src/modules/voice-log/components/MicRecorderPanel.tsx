import { Mic, Square, Loader2, CheckCircle2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../../shared/components/Button'
import type { Patient } from '../data/mockCareData'
import { StatusBadge } from './StatusBadge'

type RecorderState = 'Idle' | 'Listening' | 'Processing' | 'Saved'

const mockTranscription =
  'P008 had breakfast well, medicine given, walked with support, no symptoms reported.'

export function MicRecorderPanel({
  open,
  onClose,
  patient,
}: {
  open: boolean
  onClose: () => void
  patient?: Patient
}) {
  const [state, setState] = useState<RecorderState>('Idle')
  const [transcription, setTranscription] = useState('')

  const adlPreview = useMemo(() => {
    return [
      { k: 'Patient', v: patient?.id ?? 'P008' },
      { k: 'Breakfast', v: 'Taken Well' },
      { k: 'Medication', v: 'Given' },
      { k: 'Mobility', v: 'Walks with support' },
      { k: 'Symptoms', v: 'None reported' },
    ]
  }, [patient?.id])

  useEffect(() => {
    if (!open) return
    setState('Idle')
    setTranscription('')
  }, [open])

  if (!open) return null

  const badgeTone =
    state === 'Saved'
      ? 'good'
      : state === 'Processing'
        ? 'info'
        : state === 'Listening'
          ? 'danger'
          : 'neutral'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="vl-card w-full max-w-[980px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.88))',
        }}
      >
        <div className="vl-cardHeader">
          <div>
            <div className="vl-cardTitle flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-xl border"
                style={{
                  borderColor: 'rgba(15,23,42,0.10)',
                  background: 'rgba(108,77,255,0.10)',
                  color: 'var(--vl-primary)',
                }}
              >
                <Mic size={16} />
              </span>
              Voice Log Recorder
            </div>
            <div className="text-xs vl-subtle">
              Mock capture only — ready for backend wiring later.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label={state} tone={badgeTone as never} pulse={state === 'Listening'} />
            <Button className="vl-btn" variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="vl-cardBody">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="vl-card">
              <div className="vl-cardHeader">
                <div>
                  <div className="vl-cardTitle">Transcription</div>
                  <div className="text-xs vl-subtle">
                    Press <span className="vl-kbd">Start Recording</span> to simulate listening.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    className={['vl-btn', state === 'Listening' ? 'vl-micPulse' : null]
                      .filter(Boolean)
                      .join(' ')}
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setState('Listening')
                      setTranscription('')
                      window.setTimeout(() => setTranscription(mockTranscription), 650)
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Mic size={16} />
                      Start Recording
                    </span>
                  </Button>

                  <Button
                    className="vl-btn"
                    variant="secondary"
                    size="sm"
                    onClick={() => setState('Idle')}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Square size={16} />
                      Stop
                    </span>
                  </Button>
                </div>
              </div>
              <div className="vl-cardBody">
                <div
                  className="rounded-2xl border bg-white p-4"
                  style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                >
                  <p className="text-sm leading-6 text-[rgba(15,23,42,0.85)]">
                    {transcription || (
                      <span className="vl-subtle">
                        Waiting for voice input… (mock)
                      </span>
                    )}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs vl-subtle">
                    <Sparkles size={14} color="var(--vl-primary)" />
                    Auto extraction enabled
                    <span className="vl-chip">ADL</span>
                    <span className="vl-chip">Alerts</span>
                    <span className="vl-chip">Handover</span>
                  </div>
                  <Button
                    className="vl-btn"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setState('Processing')
                      window.setTimeout(() => setState('Saved'), 900)
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      {state === 'Processing' ? <Loader2 className="animate-spin" size={16} /> : null}
                      Save Log
                    </span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="vl-card">
              <div className="vl-cardHeader">
                <div>
                  <div className="vl-cardTitle">Structured ADL preview</div>
                  <div className="text-xs vl-subtle">From transcription (mock extraction)</div>
                </div>
                {state === 'Saved' ? (
                  <span className="vl-chip" style={{ background: 'rgba(22,163,74,0.10)' }}>
                    <CheckCircle2 size={14} color="var(--vl-success)" />
                    Saved
                  </span>
                ) : null}
              </div>
              <div className="vl-cardBody">
                <div className="grid gap-2">
                  {adlPreview.map((row) => (
                    <div
                      key={row.k}
                      className="flex items-center justify-between rounded-2xl border bg-white px-3 py-2"
                      style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                    >
                      <span className="text-xs font-semibold text-[rgba(15,23,42,0.60)]">
                        {row.k}
                      </span>
                      <span className="text-sm font-semibold text-[rgba(15,23,42,0.84)]">
                        {row.v}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border p-3 text-xs vl-subtle" style={{ borderColor: 'rgba(15,23,42,0.10)' }}>
                  Next: wire this to your ASR + extractor endpoint and persist into ADL reports + alerts.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

