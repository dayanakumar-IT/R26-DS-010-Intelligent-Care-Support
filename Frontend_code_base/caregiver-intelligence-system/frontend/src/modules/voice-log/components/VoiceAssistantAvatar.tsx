import { Pause, Play, Volume2 } from 'lucide-react'
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Button } from '../../../shared/components/Button'

type SpeakState = 'idle' | 'speaking' | 'paused'

function hasSpeechSynthesis() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export type VoiceAssistantHandle = {
  speak: () => void
  stop: () => void
}

export const VoiceAssistantAvatar = forwardRef<VoiceAssistantHandle, {
  text: string
  title?: string
  subtitle?: string
  onStart?: () => void
  onStop?: () => void
  variant?: 'femaleCaregiver' | 'maleAssistant' | 'neutral'
  compactControls?: boolean
}>(({
  text,
  title = 'CareSense Assistant',
  subtitle = 'Reads the handover summary',
  onStart,
  onStop,
  variant = 'femaleCaregiver',
  compactControls = true,
}, ref) => {
  const isMale = variant === 'maleAssistant'
  const isFemale = variant === 'femaleCaregiver'
  const supported = hasSpeechSynthesis()
  /* unique prefix so SVG gradient IDs don't collide when multiple avatars render */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [state, setState] = useState<SpeakState>('idle')
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  const safeText = useMemo(() => text.trim(), [text])

  const stop = () => {
    if (!supported) return
    window.speechSynthesis.cancel()
    utterRef.current = null
    setState('idle')
    onStop?.()
  }

  const speak = () => {
    if (!supported) return
    if (!safeText) return

    // Reset any previous utterance
    window.speechSynthesis.cancel()

    const u = new SpeechSynthesisUtterance(safeText)
    utterRef.current = u

    u.rate = 1
    u.pitch = 1
    u.volume = 1

    u.onstart = () => {
      setState('speaking')
      onStart?.()
    }
    u.onend = () => {
      setState('idle')
      utterRef.current = null
      onStop?.()
    }
    u.onerror = () => {
      setState('idle')
      utterRef.current = null
      onStop?.()
    }

    window.speechSynthesis.speak(u)
  }

  useImperativeHandle(ref, () => ({ speak, stop }), [safeText])

  const togglePause = () => {
    if (!supported) return
    if (state === 'speaking') {
      window.speechSynthesis.pause()
      setState('paused')
      return
    }
    if (state === 'paused') {
      window.speechSynthesis.resume()
      setState('speaking')
    }
  }

  useEffect(() => {
    // Stop speech if the text changes while speaking
    if (state !== 'idle') stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeText])

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
  }, [supported])

  return (
    <div className="vl-assistant">
      <div className="vl-assistantMedia">
        <div
          className={['vl-heroWave', state === 'speaking' ? 'is-anim' : null].filter(Boolean).join(' ')}
          aria-hidden
        >
          {new Array(10).fill(0).map((_, i) => (
            <span key={`w-${i}`} />
          ))}
        </div>

        <div className="vl-assistantAvatarStack" aria-label="Voice assistant avatar">
          <div
            className={[
              'vl-avatar3d',
              state === 'speaking' ? 'is-speaking' : null,
              isFemale ? 'is-caregiver-female' : isMale ? 'is-assistant-male' : 'is-neutral',
            ]
              .filter(Boolean)
              .join(' ')}
          >
          <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={isMale ? 'Male caregiver avatar' : 'Female caregiver avatar'}>
            <defs>
              {/* gender-aware background glow */}
              <radialGradient id={`${uid}_bg`} cx="45%" cy="38%" r="70%">
                {isMale ? (
                  <>
                    <stop offset="0%"   stopColor="rgba(37,88,181,0.22)" />
                    <stop offset="55%"  stopColor="rgba(30,58,138,0.14)" />
                    <stop offset="100%" stopColor="rgba(17,34,85,0.55)"  />
                  </>
                ) : (
                  <>
                    <stop offset="0%"   stopColor="rgba(168,85,247,0.22)" />
                    <stop offset="55%"  stopColor="rgba(124,58,237,0.14)" />
                    <stop offset="100%" stopColor="rgba(91,33,182,0.55)"  />
                  </>
                )}
              </radialGradient>

              <radialGradient id={`${uid}_skin`} cx="50%" cy="35%" r="70%">
                <stop offset="0%"   stopColor="#FFF1E8" />
                <stop offset="55%"  stopColor="#F7D7C7" />
                <stop offset="100%" stopColor="#F2C4AD" />
              </radialGradient>

              <linearGradient id={`${uid}_hair`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"   stopColor={isMale ? '#1F2937' : '#3A2A24'} />
                <stop offset="100%" stopColor={isMale ? '#0B1220' : '#221815'} />
              </linearGradient>

              {/* male → navy blue  |  female → brand purple */}
              <linearGradient id={`${uid}_uni`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={isMale ? '#1E3A8A' : '#7C3AED'} />
                <stop offset="100%" stopColor={isMale ? '#1D4ED8' : '#5B21B6'} />
              </linearGradient>

              <linearGradient id={`${uid}_col`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#FFFFFF" />
                <stop offset="100%" stopColor={isMale ? '#DBEAFE' : '#EDE9FE'} />
              </linearGradient>
            </defs>

            {/* background circle */}
            <circle
              cx="48" cy="48" r="46"
              fill={`url(#${uid}_bg)`}
              stroke={isMale ? 'rgba(30,58,138,0.18)' : 'rgba(124,58,237,0.18)'}
              strokeWidth="1.5"
            />

            {/* ── hair ── */}
            {isMale ? (
              <>
                {/* low rounded cap */}
                <path
                  d="M28 36c2-12 10-20 20-20s18 8 20 20c-6-5-12-8-20-8s-14 3-20 8z"
                  fill={`url(#${uid}_hair)`}
                  opacity="0.96"
                />
                {/* side temple blocks */}
                <rect x="26" y="35" width="7"  height="16" rx="3" fill={`url(#${uid}_hair)`} />
                <rect x="63" y="35" width="7"  height="16" rx="3" fill={`url(#${uid}_hair)`} />
                {/* subtle side-fade highlight */}
                <path d="M32 40c2-8 7-13 16-14" stroke="rgba(255,255,255,0.08)" strokeWidth="5" strokeLinecap="round" />
              </>
            ) : (
              <>
                {/* long hair volume behind */}
                <ellipse cx="48" cy="44" rx="23" ry="27" fill={`url(#${uid}_hair)`} opacity="0.92" />
                {/* top cap */}
                <path
                  d="M28 35c2-12 10-19 20-19s18 7 20 19c-6-6-12-9-20-9s-14 3-20 9z"
                  fill={`url(#${uid}_hair)`}
                  opacity="0.97"
                />
                {/* side strands */}
                <path d="M29,46 C27,56 28,66 31,72" stroke="#2D1B0E" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M67,46 C69,56 68,66 65,72" stroke="#2D1B0E" strokeWidth="5" strokeLinecap="round" fill="none" />
                {/* bun top-right */}
                <circle cx="66" cy="21" r="9"   fill={`url(#${uid}_hair)`} />
                <circle cx="70" cy="19" r="4.5" fill="rgba(255,255,255,0.10)" />
              </>
            )}

            {/* ── face ── */}
            <ellipse
              cx="48" cy="44"
              rx={isMale ? 19 : 17}
              ry={isMale ? 21 : 19}
              fill={`url(#${uid}_skin)`}
            />

            {/* cheek blush */}
            <ellipse cx="36" cy="46" rx="4" ry="3" fill={isMale ? 'rgba(59,130,246,0.12)' : 'rgba(236,72,153,0.20)'} />
            <ellipse cx="60" cy="46" rx="4" ry="3" fill={isMale ? 'rgba(59,130,246,0.12)' : 'rgba(236,72,153,0.20)'} />

            {/* ── eyes ── */}
            {isMale ? (
              <>
                <circle cx="41" cy="40" r="3.8" fill="#0F172A" />
                <circle cx="55" cy="40" r="3.8" fill="#0F172A" />
              </>
            ) : (
              <>
                <ellipse cx="41" cy="40" rx="3.2" ry="3.8" fill="#1A0A2E" />
                <ellipse cx="55" cy="40" rx="3.2" ry="3.8" fill="#1A0A2E" />
              </>
            )}
            {/* eye shine */}
            <circle cx="42" cy="39" r="1.2" fill="#FFFFFF" opacity="0.90" />
            <circle cx="56" cy="39" r="1.2" fill="#FFFFFF" opacity="0.90" />

            {/* ── eyebrows ── */}
            {isMale ? (
              <>
                <path d="M37,35 L46,34" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" />
                <path d="M50,34 L59,35" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" />
              </>
            ) : (
              <>
                <path d="M37.5,35 Q40.5,32.5 45.5,34.5" stroke="#2D1B0E" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M50.5,34.5 Q55.5,32.5 58.5,35"  stroke="#2D1B0E" strokeWidth="2" strokeLinecap="round" fill="none" />
              </>
            )}

            {/* ── nose ── */}
            <path d="M48 42c-1 3-1 5 0 7" stroke="rgba(15,23,42,0.16)" strokeWidth="2" strokeLinecap="round" />

            {/* ── mouth (idle / speaking) ── */}
            <g className="vl-avatarMouth">
              <path
                className="vl-mouthIdle"
                d="M42 52h12"
                stroke="#7C2D12"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              <rect
                className="vl-mouthSpeak"
                x="43" y="49.5" width="10" height="6.5" rx="3.25"
                fill="#7C2D12"
                opacity="0"
              />
            </g>

            {/* ── neck ── */}
            <rect x="44" y="61" width="8" height="8" rx="3" fill={`url(#${uid}_skin)`} opacity="0.92" />

            {/* ── uniform ── */}
            <path d="M26 92c3-16 15-24 22-24h0c7 0 19 8 22 24" fill={`url(#${uid}_uni)`} opacity="0.96" />
            <path d="M38 68h20l-10 12z" fill={`url(#${uid}_col)`} opacity="0.95" />
          </svg>
          </div>

          <button
            type="button"
            className="vl-avatarPlayInline"
            onClick={() => {
              if (state === 'idle') speak()
              else stop()
            }}
            aria-label={state === 'idle' ? 'Play voice assistant' : 'Stop voice assistant'}
            disabled={!supported || !safeText}
            title={!supported ? 'Speech synthesis not available in this browser' : undefined}
          >
            {state === 'idle' ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="vl-assistantTextRow">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold tracking-tight text-[#0F172A]">{title}</div>
            <div className="mt-1 text-xs font-medium text-[#64748B]">{subtitle}</div>
          </div>
          <span className="vl-chip">
            <Volume2 size={14} />
            {!supported ? 'TTS Unavailable' : state === 'speaking' ? 'Speaking…' : 'TTS Ready'}
          </span>
        </div>

        {!compactControls ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              className={['vl-btn', state !== 'idle' ? 'vl-micPulse' : null].filter(Boolean).join(' ')}
              variant="primary"
              size="sm"
              onClick={speak}
              disabled={!supported || !safeText || state !== 'idle'}
              aria-label="Speak summary"
              title={!supported ? 'Speech synthesis not available in this browser' : undefined}
            >
              <span className="inline-flex items-center gap-2">
                <Play size={16} />
                Speak
              </span>
            </Button>

            <Button
              className="vl-btn"
              variant="secondary"
              size="sm"
              onClick={togglePause}
              disabled={!supported || state === 'idle'}
              aria-label={state === 'paused' ? 'Resume speaking' : 'Pause speaking'}
            >
              <span className="inline-flex items-center gap-2">
                <Pause size={16} />
                {state === 'paused' ? 'Resume' : 'Pause'}
              </span>
            </Button>

            <Button className="vl-btn" variant="ghost" size="sm" onClick={stop} disabled={!supported || state === 'idle'}>
              Stop
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
})

VoiceAssistantAvatar.displayName = 'VoiceAssistantAvatar'

