import * as THREE from 'three'
import type { GlossLandmark, GlossReferenceFrame } from '../../types/gloss'
import { toHandVector3, toPoseVector3 } from './referenceCoordinates'

/**
 * avatarRigMapper.ts
 * GLOSS component — landmark positions -> bone-local quaternions.
 *
 * Deliberately independent of any specific avatar geometry (procedural
 * or future GLB) — this module only computes rotations. ProceduralAvatar.tsx
 * is the only piece that should ever need replacing to swap in a licensed
 * rigged model later; this mapper's output shape (RigPose) is meant to be
 * reusable as-is against a real GLTF skeleton's named bones.
 *
 * Method (per the project's rotation-solving requirements):
 *   - Every bone's rotation is derived fresh from the CURRENT frame's
 *     landmark positions only — never accumulated frame-over-frame, so
 *     there is no possibility of drift.
 *   - Each bone has a fixed BIND direction (its rest-pose direction,
 *     expressed in its PARENT's local frame). The target direction is
 *     computed from the actual landmark positions (in world/scene
 *     space), converted into the parent's local frame via the parent's
 *     inverse world quaternion, and THREE.Quaternion.setFromUnitVectors
 *     gives the local rotation from bind -> target. This composes
 *     correctly through the chain (shoulder -> elbow -> wrist -> fingers)
 *     exactly like a real skeletal rig, using quaternions throughout —
 *     no Euler-angle guessing.
 *   - Joint POSITIONS (other than the shoulder anchor) are NOT read
 *     directly from noisy per-frame landmark distances. Instead this
 *     rig uses fixed canonical bone lengths (BONE_LENGTHS below, in
 *     shoulder-width units) and forward kinematics through the
 *     hierarchy — the same "fixed bone length, only rotation animates"
 *     model a real GLTF skeleton uses. Only the two shoulder anchors
 *     (which barely move at all under GLOSS's normalization — see
 *     referenceCoordinates.ts) are taken directly from the data.
 *
 * Z handling (see referenceCoordinates.ts for the full empirical
 * justification): the arm chain (shoulder/elbow/wrist) uses
 * toPoseVector3(), which damps z heavily — this keeps the visually
 * dominant x/y arm movement (verified reliable) while not letting
 * MediaPipe's noisy pose-z distort arm depth. The hand root's WORLD
 * PLACEMENT still ends at the (damped) pose wrist, for a seamless
 * connection to the forearm. But finger articulation and palm
 * orientation are computed from the HAND's own landmarks via
 * toHandVector3() (undamped z) — MediaPipe's hand-model z is computed
 * relative to that hand's own wrist and stays locally consistent, so
 * relative finger depth is trustworthy even though absolute pose z is
 * not. These two z treatments are combined by computing finger/palm
 * geometry entirely in "hand-local" space (relative to the hand's own
 * landmark 0) and only ever applying the RESULT (a rotation) — never an
 * absolute position — to the rig, so the two z scales never need to be
 * mixed directly.
 */

// ---------------------------------------------------------------
// Fixed canonical bone lengths, in shoulder-width units (shoulder
// span = 1.0 by construction of GLOSS's normalization). Rough human
// proportions — precision here matters far less than correct
// DIRECTION, per the stated priority order.
// ---------------------------------------------------------------
export const BONE_LENGTHS = {
  upperArm: 0.42,
  forearm: 0.38,
  hand: 0.16,
  fingerSegment: 0.05,
  thumbSegment: 0.045,
}

export type FingerName = keyof FingerChains

// Thumb comes off the side of the palm, not the front — a fixed bind-pose
// tilt (not derived from data) gives it a distinct resting angle. Shared
// between ProceduralAvatar's JSX layout and applyRigPose's per-frame
// composition below, so the two never drift out of sync.
export const FINGER_BIND_TILT: Record<FingerName, THREE.Euler> = {
  thumb: new THREE.Euler(0, 0, THREE.MathUtils.degToRad(50)),
  index: new THREE.Euler(0, 0, 0),
  middle: new THREE.Euler(0, 0, 0),
  ring: new THREE.Euler(0, 0, 0),
  pinky: new THREE.Euler(0, 0, 0),
}

// Both arms hang straight down in bind pose — a single shared bind
// direction, no left/right mirroring needed (see docstring).
const ARM_BIND_DIR = new THREE.Vector3(0, -1, 0)
// Fingers point straight out of the palm in bind pose (local frame).
const FINGER_BIND_DIR = new THREE.Vector3(0, 0, 1)

export interface FingerChains {
  thumb: THREE.Quaternion[]
  index: THREE.Quaternion[]
  middle: THREE.Quaternion[]
  ring: THREE.Quaternion[]
  pinky: THREE.Quaternion[]
}

export interface HandRig {
  /** Relative to the forearm. */
  localQuat: THREE.Quaternion
  fingers: FingerChains
}

export interface ArmRig {
  /** World anchor for the shoulder joint — the only position not derived via fixed-length forward kinematics. */
  shoulderPosition: THREE.Vector3
  /** Relative to the torso (identity — torso is kept stable/neutral). */
  upperArmLocalQuat: THREE.Quaternion
  /** Relative to the upper arm. */
  forearmLocalQuat: THREE.Quaternion
  hand: HandRig
}

export interface RigPose {
  left: ArmRig
  right: ArmRig
}

function localQuatFromDirection(
  bindDir: THREE.Vector3,
  targetDirWorld: THREE.Vector3,
  parentWorldQuat: THREE.Quaternion,
): THREE.Quaternion {
  const targetLength = targetDirWorld.length()
  if (targetLength < 1e-6) {
    // Degenerate (near-zero-length) segment for this frame — hold the
    // bind pose rather than divide by ~zero / produce a NaN rotation.
    return new THREE.Quaternion()
  }
  const invParent = parentWorldQuat.clone().invert()
  const localTargetDir = targetDirWorld.clone().normalize().applyQuaternion(invParent)
  return new THREE.Quaternion().setFromUnitVectors(bindDir, localTargetDir)
}

function computeFingerChain(
  handLandmarks: GlossLandmark[],
  indices: [number, number, number, number],
  handWorldQuat: THREE.Quaternion,
): THREE.Quaternion[] {
  const points = indices.map((i) => toHandVector3(handLandmarks[i]))
  const quats: THREE.Quaternion[] = []
  let parentWorldQuat = handWorldQuat
  for (let i = 0; i < points.length - 1; i++) {
    const targetDir = points[i + 1].clone().sub(points[i])
    const localQuat = localQuatFromDirection(FINGER_BIND_DIR, targetDir, parentWorldQuat)
    quats.push(localQuat)
    parentWorldQuat = parentWorldQuat.clone().multiply(localQuat)
  }
  return quats
}

function computeHandRig(handLandmarks: GlossLandmark[], forearmWorldQuat: THREE.Quaternion): HandRig {
  // Palm-orientation estimation (see PHASE 6 / wrist-orientation spec):
  // wrist -> index MCP and wrist -> pinky MCP give two independent
  // vectors spanning the palm plane; their cross product estimates the
  // palm normal, which is far more informative than rotating toward a
  // single "middle finger" vector alone.
  const wrist = toHandVector3(handLandmarks[0])
  const indexMcp = toHandVector3(handLandmarks[5])
  const pinkyMcp = toHandVector3(handLandmarks[17])

  const toIndex = indexMcp.clone().sub(wrist)
  const toPinky = pinkyMcp.clone().sub(wrist)

  if (toIndex.length() < 1e-6 || toPinky.length() < 1e-6) {
    // Not enough hand detail this frame — hold bind pose for the hand only.
    const identity = new THREE.Quaternion()
    return {
      localQuat: identity,
      fingers: {
        thumb: [identity, identity, identity],
        index: [identity, identity, identity],
        middle: [identity, identity, identity],
        ring: [identity, identity, identity],
        pinky: [identity, identity, identity],
      },
    }
  }

  const palmNormal = new THREE.Vector3().crossVectors(toIndex, toPinky).normalize()
  const handForward = toIndex.clone().normalize()
  const handRight = new THREE.Vector3().crossVectors(palmNormal, handForward).normalize()
  // Re-orthogonalize forward against right+normal for a clean, exact basis.
  const handForwardOrtho = new THREE.Vector3().crossVectors(handRight, palmNormal).normalize()

  const basis = new THREE.Matrix4().makeBasis(handRight, palmNormal, handForwardOrtho)
  const handWorldQuat = new THREE.Quaternion().setFromRotationMatrix(basis)
  const localQuat = forearmWorldQuat.clone().invert().multiply(handWorldQuat)

  const fingers: FingerChains = {
    thumb: computeFingerChain(handLandmarks, [1, 2, 3, 4], handWorldQuat),
    index: computeFingerChain(handLandmarks, [5, 6, 7, 8], handWorldQuat),
    middle: computeFingerChain(handLandmarks, [9, 10, 11, 12], handWorldQuat),
    ring: computeFingerChain(handLandmarks, [13, 14, 15, 16], handWorldQuat),
    pinky: computeFingerChain(handLandmarks, [17, 18, 19, 20], handWorldQuat),
  }

  return { localQuat, fingers }
}

function computeArmRig(
  shoulder: GlossLandmark,
  elbow: GlossLandmark,
  wrist: GlossLandmark,
  handLandmarks: GlossLandmark[],
): ArmRig {
  const shoulderPos = toPoseVector3(shoulder)
  const elbowPos = toPoseVector3(elbow)
  const wristPos = toPoseVector3(wrist)

  const torsoWorldQuat = new THREE.Quaternion() // identity — torso kept stable/neutral, see module docstring

  const upperArmTargetDir = elbowPos.clone().sub(shoulderPos)
  const upperArmLocalQuat = localQuatFromDirection(ARM_BIND_DIR, upperArmTargetDir, torsoWorldQuat)
  const upperArmWorldQuat = torsoWorldQuat.clone().multiply(upperArmLocalQuat)

  const forearmTargetDir = wristPos.clone().sub(elbowPos)
  const forearmLocalQuat = localQuatFromDirection(ARM_BIND_DIR, forearmTargetDir, upperArmWorldQuat)
  const forearmWorldQuat = upperArmWorldQuat.clone().multiply(forearmLocalQuat)

  const hand = computeHandRig(handLandmarks, forearmWorldQuat)

  return { shoulderPosition: shoulderPos, upperArmLocalQuat, forearmLocalQuat, hand }
}

/**
 * Computes the full rig pose (bone-local quaternions + shoulder anchors)
 * for one reference frame. Landmark indices follow landmark_names.json /
 * preprocessing.py's POSE_ORDER exactly (verified in Phase 0 — see
 * referenceCoordinates.ts): 0=nose, 1=left_shoulder, 2=right_shoulder,
 * 3=left_elbow, 4=right_elbow, 5=left_wrist, 6=right_wrist,
 * 7-27=left_hand (MediaPipe's standard 21-point order: 0=wrist,
 * 1-4=thumb, 5-8=index, 9-12=middle, 13-16=ring, 17-20=pinky),
 * 28-48=right_hand (same 21-point order).
 *
 * The nose landmark (index 0) is deliberately unused — per the project
 * spec, head/torso motion is not fabricated from data that can't
 * support it; the head stays in a stable neutral pose (see
 * ProceduralAvatar.tsx).
 */
export function computeRigPose(frame: GlossReferenceFrame): RigPose {
  const lm = frame.landmarks
  const leftShoulder = lm[1]!
  const rightShoulder = lm[2]!
  const leftElbow = lm[3]!
  const rightElbow = lm[4]!
  const leftWrist = lm[5]!
  const rightWrist = lm[6]!
  const leftHand = lm.slice(7, 28)
  const rightHand = lm.slice(28, 49)

  return {
    left: computeArmRig(leftShoulder, leftElbow, leftWrist, leftHand),
    right: computeArmRig(rightShoulder, rightElbow, rightWrist, rightHand),
  }
}

// ---------------------------------------------------------------
// Applying a RigPose to a geometry layer's Object3D refs. Kept in this
// (non-component) file rather than ProceduralAvatar.tsx so that file
// can stay component-only (required for React Fast Refresh) — a
// future GLB layer can import this same function unchanged.
// ---------------------------------------------------------------
export type RefMap = Map<string, THREE.Object3D | null>

export function applyRigPose(refs: RefMap, pose: RigPose) {
  const applyArm = (side: 'left' | 'right', arm: ArmRig) => {
    const shoulder = refs.get(`${side}.shoulder`)
    const upperArm = refs.get(`${side}.upperArm`)
    const forearm = refs.get(`${side}.forearm`)
    const hand = refs.get(`${side}.hand`)

    shoulder?.position.copy(arm.shoulderPosition)
    upperArm?.quaternion.copy(arm.upperArmLocalQuat)
    forearm?.quaternion.copy(arm.forearmLocalQuat)
    hand?.quaternion.copy(arm.hand.localQuat)

    for (const name of Object.keys(arm.hand.fingers) as FingerName[]) {
      const quats = arm.hand.fingers[name]
      for (let i = 0; i < 3; i++) {
        const segRef = refs.get(`${side}.hand.finger.${name}.${i}`)
        // Compose the data-derived rotation on top of this finger's fixed
        // bind-pose tilt (thumb's sideways rest angle) rather than
        // overwrite it — matches "derive from bind pose + current target".
        if (segRef) {
          const tilt = new THREE.Quaternion().setFromEuler(FINGER_BIND_TILT[name])
          segRef.quaternion.copy(i === 0 ? tilt.clone().multiply(quats[i]!) : quats[i]!)
        }
      }
    }
  }

  applyArm('left', pose.left)
  applyArm('right', pose.right)
}
