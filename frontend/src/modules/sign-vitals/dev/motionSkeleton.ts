import * as THREE from 'three'
import skeletonJson from '../assets/motion/standard_skeleton.json'
import type { MotionFile } from '../components/avatar/motionPlayback'

// Dev-only: rebuild the standard skeleton from baked VRM 1.0 local rotations
// (same forward kinematics as scripts/avatar/lib/rig.mjs).

export type { MotionFile } from '../components/avatar/motionPlayback'

type BoneDef = [name: string, parent: string | null, offset: [number, number, number]]
export const SKELETON_BONES = skeletonJson.bones as BoneDef[]

const OFFSET = Object.fromEntries(SKELETON_BONES.map(([n, , o]) => [n, new THREE.Vector3(...o)]))

export interface Pose {
  pos: Record<string, THREE.Vector3>
  world: Record<string, THREE.Quaternion>
}

export function poseAt(motion: MotionFile, frame: number): Pose {
  const pos: Record<string, THREE.Vector3> = {}
  const world: Record<string, THREE.Quaternion> = {}
  for (const [name, parent, offset] of SKELETON_BONES) {
    const q = motion.bones[name]?.[frame]
    const local = q ? new THREE.Quaternion(q[0], q[1], q[2], q[3]) : new THREE.Quaternion()
    if (parent === null) {
      const h = motion.hips_position[frame] ?? [0, 0, 0]
      pos[name] = new THREE.Vector3(...offset).add(new THREE.Vector3(...h))
      world[name] = local
    } else {
      pos[name] = OFFSET[name].clone().applyQuaternion(world[parent]).add(pos[parent])
      world[name] = world[parent].clone().multiply(local)
    }
  }
  return { pos, world }
}

// Segments to draw: parent -> child, plus a short tip for bones with no child.
export function segments(pose: Pose): Array<{ name: string; a: THREE.Vector3; b: THREE.Vector3 }> {
  const out: Array<{ name: string; a: THREE.Vector3; b: THREE.Vector3 }> = []
  for (const [name, parent] of SKELETON_BONES) {
    if (parent) out.push({ name, a: pose.pos[parent], b: pose.pos[name] })
    const isTip = /Distal$/.test(name)
    if (isTip) {
      const tip = OFFSET[name].clone().multiplyScalar(0.8).applyQuaternion(pose.world[name])
      out.push({ name, a: pose.pos[name], b: pose.pos[name].clone().add(tip) })
    }
  }
  return out
}

export const HEAD_FORWARD = new THREE.Vector3(0, 0, 1)
