import { useId } from 'react'
import type { GlossMilestoneType } from '../../types/gloss'
import { categoryColors, type ColorFamily } from '../../utils/categoryColors'

/**
 * BadgeIcon.tsx
 * GLOSS component — original, calm badge artwork (inline SVG, no images).
 *
 *   level      round medallion, motif grows with the level
 *              (seed, two leaves, conversation, heart, star)
 *   category   hexagon with a simple object for the topic
 *   practice   soft shield with the count (or a memory card for first recall)
 *   monthly    calendar page with the number of active days
 *
 * Deliberately no drawn hands or signing gestures (a wrong handshape on a
 * badge would teach the wrong thing). Earned badges are filled with a soft
 * gradient and glow (category badges in their category's colour family);
 * locked badges are a quiet grey outline. marker: the always-coloured round
 * stage marker on My Journey (not a badge). No animation.
 */

const EARNED = {
  level: { ring: '#1e3a8a', fill: '#eef2ff', motif: '#1e3a8a', accent: '#c9a227' },
  category: { ring: '#0f766e', fill: '#ecfdf5', motif: '#0f766e', accent: '#14b8a6' },
  practice: { ring: '#475569', fill: '#f1f5f9', motif: '#334155', accent: '#94a3b8' },
  monthly: { ring: '#7c3aed', fill: '#f5f3ff', motif: '#5b21b6', accent: '#a78bfa' },
}
const LOCKED = { ring: '#94a3b8', fill: '#ffffff', motif: '#94a3b8', accent: '#e2e8f0' }

type Palette = typeof LOCKED

function LevelMotif({ k, p }: { k: string; p: Palette }) {
  switch (k) {
    case 'starter':
      return <circle cx="32" cy="34" r="5" fill={p.motif} />
    case 'learner':
      return (
        <g fill={p.motif}>
          <path d="M32 44 V30" stroke={p.motif} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M32 33 C24 33 21 27 21 22 C27 22 32 26 32 33 Z" />
          <path d="M32 31 C40 31 43 25 43 20 C37 20 32 24 32 31 Z" />
        </g>
      )
    case 'communicator':
      return (
        <g>
          <rect x="18" y="20" width="22" height="16" rx="5" fill="none" stroke={p.motif} strokeWidth="2.5" />
          <rect x="26" y="29" width="22" height="16" rx="5" fill={p.fill} stroke={p.motif} strokeWidth="2.5" />
          <g fill={p.motif}>
            <circle cx="32" cy="37" r="1.8" /><circle cx="37" cy="37" r="1.8" /><circle cx="42" cy="37" r="1.8" />
          </g>
        </g>
      )
    case 'care_signer':
      return (
        <path
          d="M32 45 C20 37 18 31 18 27 C18 22 22 19 26 19 C29 19 31 21 32 23 C33 21 35 19 38 19 C42 19 46 22 46 27 C46 31 44 37 32 45 Z"
          fill={p.motif}
        />
      )
    default: // master
      return (
        <path
          d="M32 17 L36.1 26.6 L46.5 27.4 L38.6 34.2 L41 44.4 L32 39 L23 44.4 L25.4 34.2 L17.5 27.4 L27.9 26.6 Z"
          fill={p.accent}
          stroke={p.motif}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )
  }
}

function CategoryMotif({ k, p }: { k: string; p: Palette }) {
  const s = { fill: 'none', stroke: p.motif, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (k) {
    case 'greetings': // sunrise
      return (
        <g {...s}>
          <path d="M20 40 H44" /><path d="M24 40 A8 8 0 0 1 40 40" />
          <path d="M32 24 V27" /><path d="M21.5 28.5 L23.6 30.6" /><path d="M42.5 28.5 L40.4 30.6" />
        </g>
      )
    case 'food_drink': // cup
      return (
        <g {...s}>
          <path d="M22 26 H38 V36 A6 6 0 0 1 32 42 H28 A6 6 0 0 1 22 36 Z" />
          <path d="M38 29 H41 A3.5 3.5 0 0 1 41 36 H38" /><path d="M27 20 V22" /><path d="M32 19 V22" />
        </g>
      )
    case 'daily_actions': // clock
      return (
        <g {...s}>
          <circle cx="32" cy="32" r="11" /><path d="M32 25 V32 L37 35" />
        </g>
      )
    case 'body_parts': // standing figure, arms at the sides
      return (
        <g {...s}>
          <circle cx="32" cy="22" r="4" /><path d="M26 44 V33 A6 6 0 0 1 38 33 V44" />
        </g>
      )
    case 'health_medical': // medical cross
      return <path d="M28 20 H36 V28 H44 V36 H36 V44 H28 V36 H20 V28 H28 Z" fill={p.motif} />
    case 'emotion': // calm face
      return (
        <g {...s}>
          <circle cx="32" cy="32" r="11" /><path d="M27 35 Q32 39 37 35" />
          <circle cx="28" cy="29" r="0.8" fill={p.motif} /><circle cx="36" cy="29" r="0.8" fill={p.motif} />
        </g>
      )
    default: // emergency: bell
      return (
        <g {...s}>
          <path d="M24 38 V31 A8 8 0 0 1 40 31 V38 L42 41 H22 Z" /><path d="M30 44 A2.5 2.5 0 0 0 34 44" />
        </g>
      )
  }
}

function Frame({ kind, p, marker }: { kind: GlossMilestoneType; p: Palette; marker?: boolean }) {
  if (marker) return <circle cx="32" cy="32" r="28" fill={p.fill} stroke={p.ring} strokeWidth="2.5" />
  if (kind === 'category') {
    return <path d="M32 4 L56 18 V46 L32 60 L8 46 V18 Z" fill={p.fill} stroke={p.ring} strokeWidth="3" strokeLinejoin="round" />
  }
  if (kind === 'practice') {
    return <path d="M32 5 L54 13 V31 C54 45 44 54 32 59 C20 54 10 45 10 31 V13 Z" fill={p.fill} stroke={p.ring} strokeWidth="3" strokeLinejoin="round" />
  }
  if (kind === 'monthly') {
    return (
      <g>
        <rect x="9" y="12" width="46" height="44" rx="8" fill={p.fill} stroke={p.ring} strokeWidth="3" />
        <path d="M9 22 H55" stroke={p.ring} strokeWidth="3" />
        <path d="M21 8 V15 M43 8 V15" stroke={p.ring} strokeWidth="3" strokeLinecap="round" />
      </g>
    )
  }
  return (
    <g>
      <circle cx="32" cy="32" r="27" fill={p.fill} stroke={p.ring} strokeWidth="3" />
      <circle cx="32" cy="32" r="21.5" fill="none" stroke={p.accent} strokeWidth="1.5" strokeDasharray="2 3" />
    </g>
  )
}

interface BadgeIconProps {
  kind: GlossMilestoneType
  badgeKey: string
  earned: boolean
  size?: number
  label: string
  /** Round stage marker in the category colour (My Journey), not a badge. */
  marker?: boolean
  /** Colour family for an earned practice / monthly badge. */
  family?: ColorFamily
}

function palette(kind: GlossMilestoneType, badgeKey: string, earned: boolean, marker: boolean, family?: ColorFamily): Palette {
  if (earned && family) return { ring: family.solid, fill: family.soft, motif: family.dark, accent: family.light }
  if (kind === 'category' && (earned || marker)) {
    const f = categoryColors(badgeKey)
    return marker
      ? { ring: f.border, fill: f.soft, motif: f.solid, accent: f.light }
      : { ring: f.solid, fill: f.soft, motif: f.dark, accent: f.light }
  }
  return earned ? EARNED[kind as keyof typeof EARNED] ?? EARNED.level : LOCKED
}

export default function BadgeIcon({ kind, badgeKey, earned, size = 56, label, marker = false, family }: BadgeIconProps) {
  // useId() contains ':' — keep only safe characters for an SVG url(#id).
  const gradientId = `badge-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const base = palette(kind, badgeKey, earned, marker, family)
  const shine = earned && !marker
  // Earned: soft top-to-bottom gradient fill and a gentle glow in the ring colour.
  const p = shine ? { ...base, fill: `url(#${gradientId})` } : base
  const text = kind === 'practice' && badgeKey.startsWith('signs_') ? badgeKey.split('_')[1]
    : kind === 'monthly' ? badgeKey.split(':')[1] : null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={marker ? label : `${label}${earned ? '' : ' (not earned yet)'}`}
      style={shine ? { filter: `drop-shadow(0 2px 6px ${base.ring}55)`, overflow: 'visible' } : undefined}
    >
      {shine && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor={base.fill} />
            <stop offset="100%" stopColor={base.accent} stopOpacity="0.55" />
          </linearGradient>
        </defs>
      )}
      <Frame kind={kind} p={p} marker={marker} />
      {kind === 'level' && <LevelMotif k={badgeKey} p={p} />}
      {kind === 'category' && <CategoryMotif k={badgeKey} p={p} />}
      {kind === 'practice' && !text && (
        <g fill="none" stroke={p.motif} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
          <rect x="22" y="21" width="20" height="24" rx="3" /><path d="M27 33 L31 37 L38 29" />
        </g>
      )}
      {text && (
        <text x="32" y={kind === 'monthly' ? 46 : 38} textAnchor="middle" fontSize={text.length > 1 ? 17 : 19}
          fontWeight="700" fill={p.motif} fontFamily="system-ui, sans-serif">
          {text}
        </text>
      )}
    </svg>
  )
}
