import * as THREE from 'three'
import type { MotionFile } from '../motionPlayback.ts'

/**
 * AvatarRig.ts
 * GLOSS component — the one place where motion meets a character.
 *
 * A rig takes one sampled frame of VRM 1.0 normalized motion (local bone
 * rotations, hips position, face blendshapes) and shows it. The player
 * and the stage only talk to this interface, so another character can be
 * plugged in later (see FbxAvatarRig.ts). MannequinRig is the default.
 *
 * Relative imports here and in the rig files keep their `.ts` extension so
 * scripts/avatar/tests can load them in Node.
 */

export type BoneDef = [name: string, parent: string | null, offset: [number, number, number]]

export interface PoseSample {
  /** Local rotation per VRM 1.0 humanoid bone; missing bones stay at rest. */
  bones: Record<string, THREE.Quaternion>
  /** Added to the hips' rest offset (metres). */
  hips: THREE.Vector3
  /** MediaPipe blendshape name -> 0..1. */
  face: Record<string, number>
}

export interface AvatarRig {
  readonly root: THREE.Object3D
  applyPose(pose: PoseSample): void
  /** World position of a humanoid bone, or null if the rig has no such bone. */
  boneWorldPosition(name: string, target: THREE.Vector3): THREE.Vector3 | null
  dispose(): void
}

const qa = new THREE.Quaternion()
const qb = new THREE.Quaternion()

/**
 * The pose at a fractional frame: bone rotations slerped (shortest path),
 * hips and blendshapes interpolated linearly between the two nearest
 * frames. `last` caps the second frame so a trimmed range never blends
 * into frames outside it.
 */
export function samplePose(motion: MotionFile, frame: number, last = motion.frames - 1, out?: PoseSample): PoseSample {
  const i0 = Math.max(0, Math.min(last, Math.floor(frame)))
  const i1 = Math.min(last, i0 + 1)
  const t = Math.min(1, Math.max(0, frame - i0))
  const pose = out ?? { bones: {}, hips: new THREE.Vector3(), face: {} }

  for (const [name, track] of Object.entries(motion.bones)) {
    const a = track[i0]
    const b = track[i1] ?? a
    if (!a) continue
    const q = (pose.bones[name] ??= new THREE.Quaternion())
    qa.set(a[0], a[1], a[2], a[3])
    qb.set(b[0], b[1], b[2], b[3])
    // Files store 4 decimals, so values are not exactly unit length;
    // normalise so the rig gets a pure rotation.
    q.slerpQuaternions(qa, qb, t).normalize()
  }

  const h0 = motion.hips_position[i0] ?? [0, 0, 0]
  const h1 = motion.hips_position[i1] ?? h0
  pose.hips.set(h0[0], h0[1], h0[2]).lerp(new THREE.Vector3(h1[0], h1[1], h1[2]), t)

  for (const [name, track] of Object.entries(motion.blendshapes)) {
    const a = track[i0] ?? 0
    pose.face[name] = a + ((track[i1] ?? a) - a) * t
  }
  return pose
}
