import type { GlossReferenceFrame } from '../../types/gloss'

/**
 * avatarAnimation.ts
 * GLOSS component — reference-sequence playback timing + interpolation.
 *
 * gloss_sign_references stores no duration/fps metadata (checked in
 * Phase 0 — the schema only has frame_count), so there is no "true"
 * source frame rate to recover. DEFAULT_FPS below is a deliberate UI
 * choice for a watchable teaching pace, not a discovered fact.
 *
 * Interpolation happens on LANDMARK POSITIONS between the two nearest
 * reference frames (P = P0 + (P1-P0)*t) — never on already-solved bone
 * rotations — so avatarRigMapper.computeRigPose() is always fed a
 * single, coherent interpolated frame and solves quaternions fresh
 * from it. This avoids the "SLERP between unrelated Euler angles"
 * problem entirely, per the project's stated interpolation approach.
 */

export const DEFAULT_FPS = 24

export interface PlaybackPosition {
  frameIndexA: number
  frameIndexB: number
  t: number // 0..1, interpolation factor from frame A to frame B
  finished: boolean // true only when loop=false and playback has reached the end
}

export function computePlaybackPosition(
  elapsedSeconds: number,
  frameCount: number,
  playbackRate: number,
  loop: boolean,
  fps: number = DEFAULT_FPS,
): PlaybackPosition {
  if (frameCount < 2) {
    return { frameIndexA: 0, frameIndexB: 0, t: 0, finished: true }
  }

  const totalDuration = (frameCount - 1) / fps
  let playbackTime = Math.max(0, elapsedSeconds) * playbackRate

  let finished = false
  if (playbackTime >= totalDuration) {
    if (loop) {
      playbackTime = totalDuration === 0 ? 0 : playbackTime % totalDuration
    } else {
      playbackTime = totalDuration
      finished = true
    }
  }

  const framePosition = playbackTime * fps
  const frameIndexA = Math.min(Math.floor(framePosition), frameCount - 2)
  const frameIndexB = frameIndexA + 1
  const t = framePosition - frameIndexA

  return { frameIndexA, frameIndexB, t, finished }
}

export function interpolateFrame(
  frameA: GlossReferenceFrame,
  frameB: GlossReferenceFrame,
  t: number,
): GlossReferenceFrame {
  const landmarks = frameA.landmarks.map((a, i) => {
    const b = frameB.landmarks[i]!
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    }
  })
  return { landmarks }
}
