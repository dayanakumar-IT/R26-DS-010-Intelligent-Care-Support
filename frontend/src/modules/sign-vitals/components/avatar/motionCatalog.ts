import qaJson from '../../assets/motion/motion_qa.json'
import trimsJson from '../../assets/motion/trim_proposals.json'
import { playRange, type MotionFile, type QaEntry, type TrimProposal } from './motionPlayback'

/**
 * motionCatalog.ts
 * GLOSS component — which signs have a 3D demonstration, and loading it.
 *
 * No three.js here, so the sign guide can decide whether to offer the
 * 3D Signer without loading it. Each motion file is its own lazy chunk.
 */

const LOADERS = import.meta.glob<{ default: MotionFile }>([
  '../../assets/motion/*.json',
  '!../../assets/motion/standard_skeleton.json',
  '!../../assets/motion/motion_qa.json',
  '!../../assets/motion/trim_proposals.json',
])
const QA = qaJson as Record<string, QaEntry>
const TRIMS = trimsJson as unknown as Record<string, TrimProposal>

// Same list as NOT_RECOMMENDED in backend sign_config.py: demonstration
// quality is limited, so these keep the 2D guide (docs/not_recommended_signs.md).
const KEEP_2D = new Set(['me', 'good', 'stand', 'welcome', 'arm'])

const PREVIEW_KEY = 'gloss.preview3d'

/**
 * DEV ONLY: `?preview3d=1` shows the 3D Signer for every sign (remembered
 * in this browser; `?preview3d=0` turns it off). Always false in
 * production builds, where import.meta.env.DEV is replaced by false.
 */
function devPreviewAll(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    const flag = new URLSearchParams(window.location.search).get('preview3d')
    if (flag !== null) localStorage.setItem(PREVIEW_KEY, flag === '0' ? '0' : '1')
    return localStorage.getItem(PREVIEW_KEY) === '1'
  } catch {
    return false
  }
}

const motionPath = (sign: string) => `../../assets/motion/${sign}.json`

export function hasMotion(sign: string): boolean {
  return motionPath(sign) in LOADERS
}

/** Whether the switcher offers the 3D Signer for this sign. */
export function offer3D(sign: string): boolean {
  if (!hasMotion(sign)) return false
  return devPreviewAll() || !KEEP_2D.has(sign)
}

/** Whether the 3D Signer is the default view: only signs approved on the review page. */
export function default3D(sign: string): boolean {
  if (!hasMotion(sign)) return false
  if (devPreviewAll()) return true
  return QA[sign]?.verdict === 'approved' && !KEEP_2D.has(sign)
}

export async function loadMotion(sign: string): Promise<MotionFile> {
  const loader = LOADERS[motionPath(sign)]
  if (!loader) throw new Error(`No motion file for ${sign}`)
  return (await loader()).default
}

/** Frames to play for this sign, with an approved trim applied. */
export function signPlayRange(sign: string, motion: MotionFile): [number, number] {
  return playRange(motion, QA[sign], TRIMS[sign])
}
