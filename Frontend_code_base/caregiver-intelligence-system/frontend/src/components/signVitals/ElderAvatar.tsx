import cls from './elderAvatar.module.css'

export type ElderPose = 'restingTremor' | 'seated' | 'maskedFace' | 'slowMovement' | 'balanceCue'

type ElderAvatarProps = {
  pose?: ElderPose
  className?: string
}

const poseCls: Record<ElderPose, string> = {
  restingTremor: '',
  seated: '',
  maskedFace: cls.poseMasked,
  slowMovement: cls.poseSlowMovement,
  balanceCue: cls.poseBalance,
}

export function ElderAvatar({ pose = 'seated', className }: ElderAvatarProps) {
  const tremor = pose === 'restingTremor'
  const poseExtra = poseCls[pose] ?? ''
  const balance = pose === 'balanceCue'

  return (
    <div
      className={[cls.root, poseExtra, balance ? cls.poseBalance : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <svg className={cls.svg} viewBox="0 0 220 260" role="img" aria-label="Educational elder avatar for motor cue tutoring">
        <defs>
          <linearGradient id="eldSkin" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8d9c4" />
            <stop offset="100%" stopColor="#ebb896" />
          </linearGradient>
          <linearGradient id="eldSweater" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7a9aaf" />
            <stop offset="100%" stopColor="#4f7188" />
          </linearGradient>
          <linearGradient id="chairC" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a8b8c9" />
            <stop offset="100%" stopColor="#7e8ea3" />
          </linearGradient>
        </defs>

        <g className={cls.torso}>
          <path d="M36 172 H184 Q186 246 174 248 H46 Q34 246 36 172 Z" fill="url(#chairC)" opacity="0.42" />

          {/* Seated torso */}
          <ellipse cx="110" cy="168" rx="52" ry="62" fill="url(#eldSweater)" />
          <rect x="70" y="188" width="80" height="58" rx="10" fill="url(#eldSweater)" />

          {/* Head */}
          <ellipse cx="110" cy="72" rx="36" ry="42" fill="url(#eldSkin)" />
          <path
            className={cls.browLine}
            d="M92 62 H128"
            stroke="#8d6e63"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />
          <ellipse cx="96" cy="78" rx="4" ry="5" fill="#4a4a55" />
          <ellipse cx="124" cy="78" rx="4" ry="5" fill="#4a4a55" />
          <path
            className={cls.mouthLine}
            d="M98 98 Q110 102 122 98"
            fill="none"
            stroke="#a67c61"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Left hand on armrest */}
          <g className={cls.handL}>
            <rect x="52" y="132" width="18" height="52" rx="8" fill="url(#eldSkin)" />
            <circle cx="58" cy="192" r="12" fill="url(#eldSkin)" />
          </g>

          {/* Right hand — tremor emphasis */}
          <g className={tremor ? cls.tremorLines : undefined}>
            <rect x="160" y="136" width="16" height="48" rx="7" fill="url(#eldSkin)" />
            <circle cx="170" cy="192" r="11" fill="url(#eldSkin)" />
          </g>
        </g>

        {tremor ? (
          <g aria-hidden opacity="0.75">
            <path
              className={cls.tremorDash}
              d="M178 154 L182 174 M168 164 L176 178 M188 160 L172 172"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="170" cy="168" r="14" fill="none" stroke="rgba(16,185,129,0.35)" strokeWidth="2" strokeDasharray="5 9">
              <animateTransform attributeName="transform" type="rotate" from="0 170 168" to="360 170 168" dur="14s" repeatCount="indefinite" />
            </circle>
          </g>
        ) : null}
      </svg>
    </div>
  )
}
