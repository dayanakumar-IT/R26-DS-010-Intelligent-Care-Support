/**
 * motionPlayback.ts
 * GLOSS component — baked motion file type and playback timing.
 *
 * Pure functions with no three.js and no Vite APIs, so the sign guide can
 * use them without loading three.js, and scripts/avatar/tests can run
 * them in Node. Motion files are display only: grading never reads them.
 * Format: scripts/avatar/MOTION_FORMAT.md.
 */

export type Quat = [number, number, number, number]

export interface MotionFile {
  sign: string
  fps: number
  frames: number
  format_version: string
  convention: string
  source: { dataset: string; video_id: string; frame_range: [number, number] }
  extraction_versions: Record<string, unknown>
  quality_flags: Array<{ type: string; part: string; frames: [number, number]; note: string }>
  bones: Record<string, Quat[]>
  hips_position: Array<[number, number, number]>
  blendshapes: Record<string, number[]>
}

export interface QaEntry {
  verdict?: 'approved' | 'rejected'
  trim?: 'approved' | 'rejected'
}

export interface TrimProposal {
  frames: number
  proposed_range: [number, number]
}

/**
 * Frames [first, last] of the file to play. An approved trim is applied
 * here unless bake.mjs has already cut the file (it then carries a
 * `trimmed` flag and no longer has the proposal's frame count).
 */
export function playRange(motion: MotionFile, qa?: QaEntry, proposal?: TrimProposal): [number, number] {
  const whole: [number, number] = [0, motion.frames - 1]
  if (qa?.trim !== 'approved' || !proposal) return whole
  if (motion.quality_flags.some((f) => f.type === 'trimmed')) return whole
  if (motion.frames !== proposal.frames) return whole
  const [a, b] = proposal.proposed_range
  return [Math.max(0, a), Math.min(motion.frames - 1, b)]
}

/**
 * Fractional frame shown `seconds` after the start of the range, using
 * the file's own fps (frame i plays at i / fps, as in the video). Each
 * frame is held for 1 / fps, so one loop lasts exactly as long as the
 * clip: (last - first + 1) / fps.
 */
export function frameAtTime(
  seconds: number,
  fps: number,
  range: [number, number],
  loop: boolean,
): { frame: number; finished: boolean } {
  const [first, last] = range
  const count = last - first + 1
  let pos = Math.max(0, seconds) * fps
  let finished = false
  if (pos >= count) {
    if (loop) pos %= count
    else {
      pos = count - 1
      finished = true
    }
  }
  return { frame: first + Math.min(pos, count - 1), finished }
}
