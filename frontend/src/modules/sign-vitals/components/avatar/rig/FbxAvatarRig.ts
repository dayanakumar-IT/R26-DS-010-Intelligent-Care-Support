import * as THREE from 'three'
import type { AvatarRig, PoseSample } from './AvatarRig.ts'

/**
 * FbxAvatarRig.ts
 * GLOSS component — STUB for a future Mixamo-style FBX character.
 * Not used by the app; MannequinRig is the default. Kept so a skinned
 * character can be plugged into the same player later.
 *
 * To finish it:
 *  1. Load the file with three's FBXLoader (dynamic import below, so the
 *     loader never ships until this rig is used).
 *  2. Find each bone by MIXAMO_BONES[vrmName]. Mixamo FBX files are often
 *     in centimetres: scale the loaded group by 0.01.
 *  3. Rest-pose correction. Motion values are VRM 1.0 normalized: local
 *     rotations relative to a T-pose whose bones all have identity rest
 *     rotation in a +Y up, +Z forward world. Mixamo bones carry their own
 *     rest rotations and their bind pose may be an A-pose. First pose the
 *     model in a T-pose facing +Z, then store for each mapped bone:
 *        W  = its rest WORLD rotation,  Wp = its parent's rest world rotation.
 *     A VRM world rotation is G = Gp · q (all VRM rests are identity), and
 *     the Mixamo bone should end at world rotation G · W, so
 *        bone.quaternion = (Gp · Wp)⁻¹ · G · W = Wp⁻¹ · q · W.
 *     (Assumes the mapped parent is the bone's direct parent; unmapped
 *     in-between bones must stay at rest.) See MOTION_FORMAT.md, "Using a
 *     non-VRM rig".
 *  4. If the character faces -Z, rotate the loaded group by π about Y.
 *  5. Face: Mixamo characters rarely have ARKit blendshapes; map the
 *     MediaPipe names (jawOpen, eyeBlinkLeft, …) to the model's morph
 *     targets if it has them, otherwise ignore `pose.face`.
 */

/** VRM 1.0 humanoid bone -> Mixamo bone name (the `mixamorig:` prefix varies by export). */
export const MIXAMO_BONES: Record<string, string> = {
  hips: 'Hips',
  spine: 'Spine',
  chest: 'Spine1',
  upperChest: 'Spine2',
  neck: 'Neck',
  head: 'Head',
  ...Object.fromEntries(
    (['Left', 'Right'] as const).flatMap((S) => {
      const s = S.toLowerCase()
      return [
        [`${s}Shoulder`, `${S}Shoulder`],
        [`${s}UpperArm`, `${S}Arm`],
        [`${s}LowerArm`, `${S}ForeArm`],
        [`${s}Hand`, `${S}Hand`],
        [`${s}ThumbMetacarpal`, `${S}HandThumb1`],
        [`${s}ThumbProximal`, `${S}HandThumb2`],
        [`${s}ThumbDistal`, `${S}HandThumb3`],
        ...(['Index', 'Middle', 'Ring'] as const).flatMap((F) => [
          [`${s}${F}Proximal`, `${S}Hand${F}1`],
          [`${s}${F}Intermediate`, `${S}Hand${F}2`],
          [`${s}${F}Distal`, `${S}Hand${F}3`],
        ]),
        [`${s}LittleProximal`, `${S}HandPinky1`],
        [`${s}LittleIntermediate`, `${S}HandPinky2`],
        [`${s}LittleDistal`, `${S}HandPinky3`],
      ]
    }),
  ),
}

export class FbxAvatarRig implements AvatarRig {
  readonly root = new THREE.Group()
  private readonly bones = new Map<string, THREE.Bone>()

  /** Loads the FBX and indexes its bones. Rest-pose correction is not done yet. */
  static async load(url: string, prefix = 'mixamorig:'): Promise<FbxAvatarRig> {
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
    const model = await new FBXLoader().loadAsync(url)
    const rig = new FbxAvatarRig()
    model.scale.setScalar(0.01)
    rig.root.add(model)
    for (const [vrm, mixamo] of Object.entries(MIXAMO_BONES)) {
      const bone = model.getObjectByName(prefix + mixamo)
      if (bone instanceof THREE.Bone) rig.bones.set(vrm, bone)
    }
    return rig
  }

  applyPose(pose: PoseSample): void {
    void pose
    throw new Error('FbxAvatarRig is a stub: rest-pose correction is not implemented (see the notes above).')
  }

  boneWorldPosition(name: string, target: THREE.Vector3): THREE.Vector3 | null {
    const bone = this.bones.get(name)
    return bone ? bone.getWorldPosition(target) : null
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => m.dispose())
      }
    })
    this.root.removeFromParent()
  }
}
