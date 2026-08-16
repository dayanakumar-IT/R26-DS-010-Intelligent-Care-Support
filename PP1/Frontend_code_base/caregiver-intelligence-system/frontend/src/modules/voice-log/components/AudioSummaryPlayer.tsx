import { Volume2, Play, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../shared/components/Button'

function hasSpeechSynthesis() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export function AudioSummaryPlayer({
  label = 'Handover audio',
  onPlaySummary,
  playing: playingProp,
  onPlayingChange,
  resetKey,
  className,
  ttsText,
}: {
  label?: string
  onPlaySummary?: () => void
  playing?: boolean
  onPlayingChange?: (playing: boolean) => void
  resetKey?: string | number
  className?: string
  ttsText?: string
}) {
  const [playingLocal, setPlayingLocal] = useState(false)
  const [progress, setProgress] = useState(0)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)
  const ttsSupported = hasSpeechSynthesis()

  const controlled = typeof playingProp === 'boolean'
  const playing = controlled ? (playingProp as boolean) : playingLocal

  const setPlaying = (next: boolean) => {
    if (!controlled) setPlayingLocal(next)
    onPlayingChange?.(next)
  }

  const durationMs   = 24_000
  const stepMs       = 250
  const progressStep = Math.round((stepMs / durationMs) * 100)
  const waveBars     = useMemo(() => new Array(8).fill(0), [])

  /* reset progress whenever the selected summary changes */
  useEffect(() => { setProgress(0) }, [resetKey])

  /* stop speech when ttsText changes mid-playback */
  useEffect(() => {
    if (ttsText && playing) {
      if (ttsSupported) window.speechSynthesis.cancel()
      utterRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsText])

  /* progress bar ticker */
  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + progressStep)
        if (next >= 100) { setPlaying(false); return 100 }
        return next
      })
    }, stepMs)
    return () => window.clearInterval(t)
  }, [playing, progressStep])

  /* ── helpers ─────────────────────────────────────────── */

  /** Cancel any in-flight speech — works whether TTS is internal or external */
  const cancelSpeech = () => {
    if (!ttsSupported) return
    window.speechSynthesis.cancel()
    utterRef.current = null
  }

  const startInternalTts = (): boolean => {
    if (!ttsSupported) return false
    const text = (ttsText ?? '').trim()
    if (!text) return false
    cancelSpeech()
    const u = new SpeechSynthesisUtterance(text)
    utterRef.current = u
    u.rate = 1; u.pitch = 1; u.volume = 1
    u.onend   = () => { setPlaying(false); utterRef.current = null }
    u.onerror = () => { setPlaying(false); utterRef.current = null }
    window.speechSynthesis.speak(u)
    return true
  }

  const handleStop = () => {
    cancelSpeech()   // always cancel — catches both internal and external TTS
    setProgress(0)
    setPlaying(false)
  }

  const handlePlay = () => {
    cancelSpeech()   // clear any stale speech first
    setProgress(0)
    setPlaying(true)
    if (ttsText) {
      const ok = startInternalTts()
      if (!ok) setPlaying(false)
    } else {
      onPlaySummary?.()
    }
  }

  const handleToggle = () => {
    if (playing) {
      handleStop()
    } else {
      handlePlay()
    }
  }

  /* ── render ──────────────────────────────────────────── */
  return (
    <div className={['vl-card', className].filter(Boolean).join(' ')}>
      <div className="vl-cardHeader">
        <div>
          <div className="vl-cardTitle">{label}</div>
          <div className="text-xs vl-subtle">
            {ttsText ? 'TTS audio output enabled' : 'Waveform mock + player controls'}
          </div>
        </div>
        <span className="vl-chip">
          <Volume2 size={14} />
          {ttsText ? (ttsSupported ? 'Voice enabled' : 'TTS unavailable') : 'Voice enabled'}
        </span>
      </div>

      <div className="vl-cardBody">
        {/* ── main audio row: circle btn + wave/progress ── */}
        <div className="vl-audioRow">
          <Button
            className="vl-audioIconBtn"
            variant="secondary"
            onClick={handleToggle}
            aria-label={playing ? 'Stop audio' : 'Play audio'}
          >
            {playing ? <Square size={16} fill="currentColor" /> : <Play size={18} />}
          </Button>

          <div className="vl-audioWaveWrap">
            <div className="vl-wave vl-audioWave" aria-hidden>
              {waveBars.map((_, i) => (
                <span key={i} style={{ animationPlayState: playing ? 'running' : 'paused' }} />
              ))}
            </div>
            <div className="vl-audioProgressTrack">
              <div className="vl-audioProgressFill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* ── action buttons row (below waveform) ── */}
        <div className="vl-audioActions">
          <Button
            className="vl-btn"
            variant="primary"
            size="sm"
            onClick={handlePlay}
            disabled={ttsText ? !ttsSupported || !(ttsText ?? '').trim() : false}
          >
            Play Summary
          </Button>
          <Button
            className="vl-btn"
            variant="ghost"
            size="sm"
            onClick={handleStop}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  )
}
