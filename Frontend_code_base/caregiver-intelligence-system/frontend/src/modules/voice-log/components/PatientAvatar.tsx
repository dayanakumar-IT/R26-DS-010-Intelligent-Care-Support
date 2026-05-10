import { useId } from 'react'

/* ─────────────────────────────────────────────────────────────
   Female illustrated avatar
   Brand colour: #7C3AED (purple)
───────────────────────────────────────────────────────────── */
function FemaleAvatarSVG({ uid }: { uid: string }) {
  const ids = {
    bg:   `${uid}_fbg`,
    skin: `${uid}_fsk`,
    hair: `${uid}_fhr`,
    uni:  `${uid}_fun`,
  }
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-hidden>
      <defs>
        <radialGradient id={ids.bg} cx="50%" cy="40%" r="70%">
          <stop offset="0%"   stopColor="#9B59D0" />
          <stop offset="100%" stopColor="#6D1FCA" />
        </radialGradient>
        <radialGradient id={ids.skin} cx="50%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#FFEBD9" />
          <stop offset="100%" stopColor="#F2C4A0" />
        </radialGradient>
        <linearGradient id={ids.hair} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#2D1B0E" />
          <stop offset="100%" stopColor="#1A0F08" />
        </linearGradient>
        <linearGradient id={ids.uni} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
      </defs>

      {/* Background */}
      <circle cx="50" cy="50" r="50" fill={`url(#${ids.bg})`} />

      {/* Long hair behind head */}
      <ellipse cx="50" cy="46" rx="22" ry="27" fill={`url(#${ids.hair})`} />

      {/* Face */}
      <ellipse cx="50" cy="46" rx="17" ry="19" fill={`url(#${ids.skin})`} />

      {/* Hair top cap */}
      <path d="M28,38 Q28,19 50,19 Q72,19 72,38 Q62,27 50,27 Q38,27 28,38Z" fill={`url(#${ids.hair})`} />

      {/* Side hair strands */}
      <path d="M33,48 C30,59 31,69 34,75" stroke="#2D1B0E" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M67,48 C70,59 69,69 66,75" stroke="#2D1B0E" strokeWidth="5.5" strokeLinecap="round" fill="none" />

      {/* Cheek blush */}
      <ellipse cx="36" cy="50" rx="6"   ry="4"   fill="rgba(236,72,153,0.22)" />
      <ellipse cx="64" cy="50" rx="6"   ry="4"   fill="rgba(236,72,153,0.22)" />

      {/* Eyes */}
      <ellipse cx="42" cy="42" rx="4"   ry="4.5" fill="#1A0A2E" />
      <ellipse cx="58" cy="42" rx="4"   ry="4.5" fill="#1A0A2E" />
      {/* Eye shine */}
      <circle  cx="43.5" cy="40.5" r="1.5" fill="white" opacity="0.90" />
      <circle  cx="59.5" cy="40.5" r="1.5" fill="white" opacity="0.90" />

      {/* Eyebrows — arched */}
      <path d="M38,36 Q41,33 46,35" stroke="#2D1B0E" strokeWidth="2"   strokeLinecap="round" fill="none" />
      <path d="M54,35 Q59,33 62,36" stroke="#2D1B0E" strokeWidth="2"   strokeLinecap="round" fill="none" />

      {/* Nose */}
      <ellipse cx="50" cy="52" rx="3" ry="2" fill="rgba(180,100,60,0.22)" />

      {/* Smile */}
      <path d="M43,58 Q50,64 57,58" stroke="#C0736A" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Neck */}
      <rect x="44" y="63" width="12" height="8" rx="4" fill={`url(#${ids.skin})`} />

      {/* Scrubs uniform */}
      <path d="M16,100 Q20,76 36,70 L50,84 L64,70 Q80,76 84,100Z" fill={`url(#${ids.uni})`} />

      {/* V-collar */}
      <path d="M38,70 L50,84 L62,70 Q56,76 50,76 Q44,76 38,70Z" fill="white" opacity="0.88" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   Male illustrated avatar
   Brand colour: #1E3A8A (navy blue)
───────────────────────────────────────────────────────────── */
function MaleAvatarSVG({ uid }: { uid: string }) {
  const ids = {
    bg:   `${uid}_mbg`,
    skin: `${uid}_msk`,
    hair: `${uid}_mhr`,
    uni:  `${uid}_mun`,
  }
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-hidden>
      <defs>
        <radialGradient id={ids.bg} cx="50%" cy="40%" r="70%">
          <stop offset="0%"   stopColor="#2558B5" />
          <stop offset="100%" stopColor="#122366" />
        </radialGradient>
        <radialGradient id={ids.skin} cx="50%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#FFEBD9" />
          <stop offset="100%" stopColor="#F2C4A0" />
        </radialGradient>
        <linearGradient id={ids.hair} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1F2937" />
          <stop offset="100%" stopColor="#0B1220" />
        </linearGradient>
        <linearGradient id={ids.uni} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>

      {/* Background */}
      <circle cx="50" cy="50" r="50" fill={`url(#${ids.bg})`} />

      {/* Short hair — side blocks */}
      <rect x="28" y="35" width="8" height="17" rx="3" fill={`url(#${ids.hair})`} />
      <rect x="64" y="35" width="8" height="17" rx="3" fill={`url(#${ids.hair})`} />

      {/* Face */}
      <ellipse cx="50" cy="47" rx="19" ry="21" fill={`url(#${ids.skin})`} />

      {/* Hair top — low rounded cap */}
      <path d="M30,40 Q30,21 50,21 Q70,21 70,40 Q62,29 50,29 Q38,29 30,40Z" fill={`url(#${ids.hair})`} />

      {/* Temple / sideburn */}
      <path d="M31,43 C30,47 30,52 31,56" stroke="#1F2937" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M69,43 C70,47 70,52 69,56" stroke="#1F2937" strokeWidth="4.5" strokeLinecap="round" fill="none" />

      {/* Light cheek shadow */}
      <ellipse cx="36" cy="51" rx="5" ry="3.5" fill="rgba(59,130,246,0.13)" />
      <ellipse cx="64" cy="51" rx="5" ry="3.5" fill="rgba(59,130,246,0.13)" />

      {/* Eyes */}
      <circle cx="42" cy="43" r="4.2" fill="#0F172A" />
      <circle cx="58" cy="43" r="4.2" fill="#0F172A" />
      {/* Eye shine */}
      <circle cx="43.5" cy="41.5" r="1.5" fill="white" opacity="0.90" />
      <circle cx="59.5" cy="41.5" r="1.5" fill="white" opacity="0.90" />

      {/* Eyebrows — straight, heavier */}
      <path d="M37,37 L46,36" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M54,36 L63,37" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" fill="none" />

      {/* Nose */}
      <path d="M50,46 L48,52 C49,54 51,54 52,52Z" fill="rgba(160,100,60,0.25)" />

      {/* Smile */}
      <path d="M43,59 Q50,65 57,59" stroke="#B87333" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Neck */}
      <rect x="44" y="65" width="12" height="8" rx="4" fill={`url(#${ids.skin})`} />

      {/* Scrubs uniform — navy */}
      <path d="M16,100 Q20,76 36,72 L50,86 L64,72 Q80,76 84,100Z" fill={`url(#${ids.uni})`} />

      {/* V-collar */}
      <path d="M38,72 L50,86 L62,72 Q56,78 50,78 Q44,78 38,72Z" fill="white" opacity="0.88" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   Public component
───────────────────────────────────────────────────────────── */
export function PatientAvatar({
  name,
  gender,
  size = 40,
}: {
  name: string
  gender: 'Female' | 'Male'
  size?: number
}) {
  /* useId gives a unique prefix per component instance → no SVG gradient-ID collisions */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isFemale = gender === 'Female'

  return (
    <div
      className="relative inline-block shrink-0 rounded-full"
      style={{
        width:  size,
        height: size,
        /* 2-px gradient ring */
        padding: 2,
        background: isFemale
          ? 'linear-gradient(135deg,#A855F7 0%,#7C3AED 50%,#5B21B6 100%)'
          : 'linear-gradient(135deg,#3B82F6 0%,#1E3A8A 50%,#122366 100%)',
        boxShadow: isFemale
          ? '0 4px 16px rgba(124,58,237,0.30)'
          : '0 4px 16px rgba(30,58,138,0.30)',
      }}
      aria-label={`${name} ${gender} avatar`}
      title={name}
    >
      <div className="h-full w-full overflow-hidden rounded-full" style={{ background: '#fff' }}>
        {isFemale
          ? <FemaleAvatarSVG uid={uid} />
          : <MaleAvatarSVG  uid={uid} />}
      </div>
    </div>
  )
}
