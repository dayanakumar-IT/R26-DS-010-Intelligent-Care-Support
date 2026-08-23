import { useMemo, useState } from 'react'
import cls from './caregiverAvatar.module.css'

export type CaregiverPose =
  | 'neutral'
  | 'thankYou'
  | 'help'
  | 'eat'
  | 'drink'
  | 'raisedHand'
  | 'teaching'

type CaregiverAvatarProps = {
  pose?: CaregiverPose
  /** Derive pose from lesson word — overrides `pose` if set */
  lessonWord?: string
  compact?: boolean
  showControls?: boolean
  className?: string
  replayKey?: number | string
}

function wordToPose(word: string): CaregiverPose {
  const u = word.trim().toUpperCase()
  if (u.includes('THANK')) return 'thankYou'
  if (u === 'HELP') return 'help'
  if (u === 'EAT') return 'eat'
  if (u === 'DRINK') return 'drink'
  return 'neutral'
}

export function CaregiverAvatar({
  pose = 'neutral',
  lessonWord,
  compact,
  showControls = false,
  className,
  replayKey,
}: CaregiverAvatarProps) {
  const resolvedPose = lessonWord ? wordToPose(lessonWord) : pose

  const [view, setView] = useState<'front' | 'side'>('front')
  const [slow, setSlow] = useState(false)
  const [replayBump, setReplayBump] = useState(0)

  const poseCls = useMemo(() => {
    const map: Record<CaregiverPose, string> = {
      neutral: cls.poseNeutral,
      thankYou: cls.poseThankYou,
      help: cls.poseHelp,
      eat: cls.poseEat,
      drink: cls.poseDrink,
      raisedHand: cls.poseRaisedHand,
      teaching: cls.poseTeaching,
    }
    return map[resolvedPose] ?? cls.poseNeutral
  }, [resolvedPose])

  const showArc =
    resolvedPose === 'thankYou' ||
    resolvedPose === 'help' ||
    resolvedPose === 'raisedHand' ||
    resolvedPose === 'eat' ||
    resolvedPose === 'drink'

  return (
    <div
      key={`${replayKey ?? 0}-${replayBump}-${resolvedPose}`}
      className={[
        cls.root,
        view === 'side' ? cls.side : '',
        slow ? cls.slow : '',
        compact ? cls.compact : '',
        poseCls,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        className={cls.svg}
        viewBox="0 0 200 260"
        role="img"
        aria-label="CareSense caregiver tutor avatar demonstrating a sign"
      >
        <defs>
          <linearGradient id="caSkin" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffeadd" />
            <stop offset="100%" stopColor="#f5c4a8" />
          </linearGradient>
          <linearGradient id="caTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#17141f" />
            <stop offset="100%" stopColor="#0d0c12" />
          </linearGradient>
          <linearGradient id="caHair" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a3f36" />
            <stop offset="100%" stopColor="#2e2620" />
          </linearGradient>
          <radialGradient id="caCheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffb8a8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffb8a8" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="100" cy="248" rx="78" ry="9" fill="rgba(124,58,237,0.06)" />

        {/* Torso — black caregiver top */}
        <path
          d="M64 138 L56 226 Q54 246 74 248 L126 248 Q146 246 144 226 L136 138 Q100 120 64 138Z"
          fill="url(#caTop)"
        />
        <path d="M78 154 L122 154 L118 218 L82 218 Z" fill="rgba(255,255,255,0.045)" />

        {/* Neck */}
        <rect x="86" y="112" width="28" height="34" rx="8" fill="url(#caSkin)" />

        {/* Hair + bun */}
        <ellipse cx="100" cy="78" rx="38" ry="42" fill="url(#caHair)" />
        <circle cx="128" cy="52" r="16" fill="url(#caHair)" />
        <ellipse cx="128" cy="48" rx="14" ry="12" fill="rgba(60,52,46,0.35)" />

        {/* Face */}
        <ellipse cx="100" cy="92" rx="30" ry="34" fill="url(#caSkin)" />
        <ellipse cx="86" cy="98" rx="10" ry="8" fill="url(#caCheek)" />
        <ellipse cx="114" cy="98" rx="10" ry="8" fill="url(#caCheek)" />

        {/* Eyes */}
        <ellipse cx="89" cy="88" rx="4" ry="5" fill="#3d3d48" />
        <ellipse cx="111" cy="88" rx="4" ry="5" fill="#3d3d48" />
        <ellipse cx="90" cy="86" rx="1.6" ry="2" fill="#ffffff" opacity="0.85" />
        <ellipse cx="112" cy="86" rx="1.6" ry="2" fill="#ffffff" opacity="0.85" />

        {/* Friendly smile */}
        <path d="M90 106 Q100 114 110 106" fill="none" stroke="#c47a66" strokeWidth="2" strokeLinecap="round" />

        {/* Brow */}
        <path d="M82 82 Q89 79 96 82" stroke="rgba(60,52,46,0.35)" strokeWidth="1.2" fill="none" />
        <path d="M104 82 Q111 79 118 82" stroke="rgba(60,52,46,0.35)" strokeWidth="1.2" fill="none" />

        {/* Left arm (supporting) */}
        <path
          d="M64 146 Q48 170 42 206 L46 226 Q54 232 62 226 L68 200 Q74 174 76 146Z"
          fill="url(#caSkin)"
        />

        {/* Right arm — signing */}
        <g className={[cls.armR, cls.handGlow].join(' ')}>
          <path
            d="M136 140 Q164 154 174 182 L166 218 Q154 226 146 218 L138 188 Q134 164 134 146Z"
            fill="url(#caSkin)"
          />
          <ellipse cx="174" cy="202" rx="20" ry="18" fill="url(#caSkin)" transform="rotate(-6 174 202)" />

          {(resolvedPose === 'help' || resolvedPose === 'raisedHand') && (
            <path
              d="M158 190 L172 174 L182 188 L174 206 Z"
              fill="rgba(253,236,227,0.35)"
              stroke="#e8b4a0"
              strokeWidth="1"
            />
          )}
        </g>

        {showArc ? (
          <path
            className={[cls.arc, cls.arcAnim].join(' ')}
            d="M148 92 Q174 118 178 154"
          />
        ) : null}
      </svg>

      {showControls ? (
        <div className={cls.controls}>
          <button type="button" className={[cls.btn, view === 'front' ? cls.btnActive : ''].join(' ')} onClick={() => setView('front')}>
            View from Front
          </button>
          <button type="button" className={[cls.btn, view === 'side' ? cls.btnActive : ''].join(' ')} onClick={() => setView('side')}>
            View from Side
          </button>
          <button type="button" className={[cls.btn, slow ? cls.btnActive : ''].join(' ')} onClick={() => setSlow((s) => !s)}>
            Slow Motion
          </button>
          <button type="button" className={cls.btn} onClick={() => setReplayBump((n) => n + 1)}>
            Replay
          </button>
        </div>
      ) : null}
    </div>
  )
}
