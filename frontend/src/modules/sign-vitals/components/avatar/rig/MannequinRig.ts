import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { AvatarRig, BoneDef, PoseSample } from './AvatarRig.ts'

/**
 * MannequinRig.ts
 * GLOSS component — the default 3D signer, built entirely in code.
 *
 * The skeleton is THREE.Bone objects made from standard_skeleton.json:
 * VRM 1.0 humanoid names, T-pose rest, every rest rotation identity, so a
 * baked quaternion is written straight to `bone.quaternion` with no
 * retargeting. Because the bone offsets are the validated skeleton's own,
 * joint positions match the skeleton used to check the bakes exactly
 * (scripts/avatar/tests/avatar_fk.test.mjs).
 *
 * The body is an artist's mannequin: rounded pieces fixed rigidly to the
 * bones (no skinning). Each piece is modelled in its bone's rest frame:
 * +Y up, character faces +Z, character's right is -X.
 */

const COLOURS = {
  mannequin: '#d6d3d1', // neutral matte, deliberately not a skin tone
  shirt: '#0d9488', // CareSense teal
  shirtTrim: '#0f766e',
  trousers: '#334155',
  feature: '#44403c',
  brow: '#78716c',
  lip: '#a8a29e',
  mouth: '#57534e',
}

const UP = new THREE.Vector3(0, 1, 0)

/** Capsule along +Y from y=0 (radius r0) to y=len (radius r1), smooth ends. */
function taperedCapsule(r0: number, r1: number, len: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2)
    pts.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a)))
  }
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.cos(a)), len + r1 * Math.sin(a)))
  }
  return new THREE.LatheGeometry(pts, 20)
}

/** Rotationally symmetric body piece from [y, radius] pairs, closed at both ends. */
function latheBody(profile: Array<[number, number]>): THREE.LatheGeometry {
  const pts = profile.map(([y, r]) => new THREE.Vector2(Math.max(1e-4, r), y))
  return new THREE.LatheGeometry(pts, 32)
}

export class MannequinRig implements AvatarRig {
  readonly root = new THREE.Group()
  private readonly bones = new Map<string, THREE.Bone>()
  private readonly restHips = new THREE.Vector3()
  private readonly offsets = new Map<string, THREE.Vector3>()
  private readonly mats: Record<keyof typeof COLOURS, THREE.MeshStandardMaterial>
  private readonly face: {
    eyes: Record<'left' | 'right', THREE.Mesh>
    brows: Record<'left' | 'right', THREE.Mesh>
    upperLip: Record<'left' | 'right', THREE.Mesh>
    lowerLip: Record<'left' | 'right', THREE.Mesh>
    lowerLipGroup: THREE.Group
    inner: THREE.Mesh
  }

  constructor(skeleton: BoneDef[]) {
    this.root.name = 'MannequinRig'
    this.mats = Object.fromEntries(
      Object.entries(COLOURS).map(([k, c]) => [
        k,
        new THREE.MeshStandardMaterial({ color: c, roughness: k === 'feature' ? 0.6 : 0.85, metalness: 0 }),
      ]),
    ) as Record<keyof typeof COLOURS, THREE.MeshStandardMaterial>

    for (const [name, parent, offset] of skeleton) {
      const bone = new THREE.Bone()
      bone.name = name
      bone.position.set(...offset)
      this.offsets.set(name, new THREE.Vector3(...offset))
      this.bones.set(name, bone)
      if (parent === null) {
        this.restHips.set(...offset)
        this.root.add(bone)
      } else {
        const p = this.bones.get(parent)
        if (!p) throw new Error(`standard_skeleton.json: ${name} listed before its parent ${parent}`)
        p.add(bone)
      }
    }

    this.buildTorso()
    for (const side of ['left', 'right'] as const) {
      this.buildArm(side)
      this.buildHand(side)
    }
    this.face = this.buildHead()
  }

  // ---- building ----

  private add(boneName: string, geo: THREE.BufferGeometry, mat: THREE.Material, at?: THREE.Vector3, along?: THREE.Vector3) {
    const bone = this.bones.get(boneName)
    if (!bone) return null
    const mesh = new THREE.Mesh(geo, mat)
    if (at) mesh.position.copy(at)
    if (along) mesh.quaternion.setFromUnitVectors(UP, along.clone().normalize())
    bone.add(mesh)
    return mesh
  }

  /** Capsule from a bone's origin to `end` (in that bone's frame). */
  private limb(boneName: string, end: THREE.Vector3, r0: number, r1: number, mat: THREE.Material) {
    return this.add(boneName, taperedCapsule(r0, r1, end.length()), mat, undefined, end)
  }

  private joint(boneName: string, r: number, mat: THREE.Material) {
    return this.add(boneName, new THREE.SphereGeometry(r, 20, 14), mat)
  }

  private off(name: string) {
    return this.offsets.get(name)?.clone() ?? new THREE.Vector3()
  }

  private buildTorso() {
    const { shirt, shirtTrim, trousers, mannequin } = this.mats
    const flat = (m: THREE.Mesh | null, z = 0.62) => m?.scale.set(1, 1, z)
    // Two shirt pieces, each closed inside the piece above it so no seam
    // or flicker shows: the abdomen (on the spine) and the chest with the
    // shoulders (on the upper chest, reaching down over the abdomen like
    // a loose top). Pelvis (trousers) on the hips, tucked under the shirt.
    flat(this.add('hips', latheBody([[-0.22, 0], [-0.22, 0.13], [-0.1, 0.142], [0.0, 0.136], [0.06, 0.124], [0.1, 0]]), trousers))
    flat(this.add('spine', latheBody([[-0.07, 0], [-0.07, 0.146], [-0.05, 0.142], [0.02, 0.134], [0.08, 0.124], [0.16, 0.116], [0.2, 0]]), shirt))
    flat(this.add('upperChest', latheBody([
      [-0.2, 0], [-0.2, 0.143], [-0.12, 0.143], [-0.02, 0.152], [0.05, 0.152], [0.095, 0.135], [0.125, 0.095], [0.142, 0.055], [0.15, 0],
    ]), shirt), 0.6)
    // Shirt hem just above the trousers.
    flat(this.add('spine', new THREE.TorusGeometry(0.146, 0.005, 6, 40).rotateX(Math.PI / 2), shirtTrim, new THREE.Vector3(0, -0.068, 0)))
    // Neck and collar.
    this.limb('neck', this.off('head'), 0.044, 0.041, mannequin)
    this.add('upperChest', new THREE.TorusGeometry(0.052, 0.007, 8, 28), shirtTrim, new THREE.Vector3(0, 0.141, 0.004), new THREE.Vector3(0, 0, 1))
  }

  private buildArm(side: 'left' | 'right') {
    const { shirt, shirtTrim, mannequin } = this.mats
    const S = (n: string) => `${side}${n}`
    // Shoulder: from the collarbone root out to the arm socket, in the shirt.
    this.limb(S('Shoulder'), this.off(S('UpperArm')), 0.05, 0.055, shirt)
    this.joint(S('UpperArm'), 0.056, shirt)
    // Upper arm with a short sleeve over its first 40%.
    const upper = this.off(S('LowerArm'))
    this.limb(S('UpperArm'), upper, 0.046, 0.037, mannequin)
    const sleeveLen = upper.length() * 0.4
    const dir = upper.clone().normalize()
    const sleeve = new THREE.CylinderGeometry(0.0525, 0.057, sleeveLen, 24, 1, true)
    this.add(S('UpperArm'), sleeve, shirt, dir.clone().multiplyScalar(sleeveLen / 2), dir)
    this.add(S('UpperArm'), new THREE.TorusGeometry(0.0525, 0.005, 8, 24), shirtTrim, dir.clone().multiplyScalar(sleeveLen))
      ?.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
    // Elbow, forearm, wrist.
    this.joint(S('LowerArm'), 0.037, mannequin)
    this.limb(S('LowerArm'), this.off(S('Hand')), 0.036, 0.026, mannequin)
    this.joint(S('Hand'), 0.027, mannequin)
  }

  private buildHand(side: 'left' | 'right') {
    const { mannequin } = this.mats
    const S = (n: string) => `${side}${n}`
    const sx = side === 'right' ? -1 : 1
    // Rounded palm from the wrist to the knuckles (palm faces -Y at rest).
    this.add(S('Hand'), new RoundedBoxGeometry(0.1, 0.03, 0.088, 4, 0.013), mannequin, new THREE.Vector3(sx * 0.052, -0.002, 0.001))
    // Fleshy base of the thumb.
    this.limb(S('Hand'), this.off(S('ThumbMetacarpal')).add(new THREE.Vector3(sx * 0.012, 0, 0.004)), 0.019, 0.016, mannequin)
    // Four fingers and the thumb: three capsules each, the last one
    // running from the distal joint to the fingertip (0.8 x the distal
    // offset, the same tip the validation skeleton draws).
    const radii: Record<string, [number, number, number]> = {
      Thumb: [0.0135, 0.0118, 0.0105],
      Index: [0.0102, 0.0094, 0.0086],
      Middle: [0.0105, 0.0097, 0.0088],
      Ring: [0.0099, 0.0091, 0.0083],
      Little: [0.0088, 0.0081, 0.0074],
    }
    for (const [finger, r] of Object.entries(radii)) {
      const segs = finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal']
      segs.forEach((seg, i) => {
        const bone = S(finger + seg)
        const next = segs[i + 1]
        const end = next ? this.off(S(finger + next)) : this.off(bone).multiplyScalar(0.8)
        this.limb(bone, end, r[i], r[Math.min(2, i + 1)] * (next ? 1 : 0.92), mannequin)
      })
    }
  }

  private buildHead() {
    const { mannequin, feature, lip, mouth } = this.mats
    const browMat = this.mats.brow
    // Egg-shaped head on the head bone: centre and radii (metres).
    const C = new THREE.Vector3(0, 0.076, 0.012)
    const R = new THREE.Vector3(0.085, 0.114, 0.099)
    const head = this.add('head', new THREE.SphereGeometry(1, 40, 30), mannequin, C)
    head?.scale.copy(R)
    // A point on the face surface at (x, y) in head-bone space.
    const surface = (x: number, y: number, sink = 0.001) => {
      const k = 1 - (x / R.x) ** 2 - ((y - C.y) / R.y) ** 2
      return new THREE.Vector3(x, y, C.z + R.z * Math.sqrt(Math.max(0, k)) - sink)
    }
    const onFace = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, sink?: number) => {
      const p = surface(x, y, sink)
      const g = new THREE.Group()
      g.position.copy(p)
      g.rotation.y = Math.asin(Math.max(-1, Math.min(1, x / R.x))) * 0.8 // follow the curve of the face
      const m = new THREE.Mesh(geo, mat)
      g.add(m)
      this.bones.get('head')?.add(g)
      return { g, m }
    }

    // Ears and a soft nose.
    for (const sx of [-1, 1]) {
      const ear = this.add('head', new THREE.SphereGeometry(1, 14, 10), mannequin, new THREE.Vector3(sx * R.x * 0.97, C.y - 0.002, C.z - 0.012))
      ear?.scale.set(0.007, 0.019, 0.012)
    }
    const nose = onFace(new THREE.SphereGeometry(1, 14, 10), mannequin, 0, C.y - 0.012, 0.004)
    nose.m.scale.set(0.011, 0.019, 0.014)
    nose.m.position.y = -0.004

    const eyeY = C.y + 0.012
    const browY = eyeY + 0.026
    const mouthY = C.y - 0.056
    const sides = { left: 1, right: -1 } as const // character's left is +X
    const eyes = {} as Record<'left' | 'right', THREE.Mesh>
    const brows = {} as Record<'left' | 'right', THREE.Mesh>
    const upperLip = {} as Record<'left' | 'right', THREE.Mesh>
    const lowerLip = {} as Record<'left' | 'right', THREE.Mesh>

    const browGeo = taperedCapsule(0.0032, 0.0024, 0.026)
    browGeo.rotateZ(-Math.PI / 2) // lie along +X, pivot at the inner end
    const lipGeo = taperedCapsule(0.0034, 0.0026, 0.019)
    lipGeo.rotateZ(-Math.PI / 2)

    for (const [side, sx] of Object.entries(sides) as Array<['left' | 'right', 1 | -1]>) {
      const eye = onFace(new THREE.SphereGeometry(1, 16, 12), feature, sx * 0.032, eyeY, 0.003)
      eye.m.scale.set(0.0095, 0.0075, 0.004)
      eyes[side] = eye.m
      const brow = onFace(browGeo, browMat, sx * 0.016, browY, 0.0005)
      brow.m.scale.x = sx // mirror so the brow runs outward on both sides
      brows[side] = brow.m
    }

    // Mouth: two lip halves each for upper and lower lip, pivoting at the
    // centre so the corners can curve up (smile) or down (frown); the
    // lower lip drops and a dark opening grows as the jaw opens.
    const mouthAnchor = onFace(new THREE.BufferGeometry(), mouth, 0, mouthY, 0.0015).g
    const lowerLipGroup = new THREE.Group()
    mouthAnchor.add(lowerLipGroup)
    for (const [side, sx] of Object.entries(sides) as Array<['left' | 'right', 1 | -1]>) {
      const u = new THREE.Mesh(lipGeo, lip)
      u.scale.x = sx
      mouthAnchor.add(u)
      upperLip[side] = u
      const l = new THREE.Mesh(lipGeo, lip)
      l.scale.x = sx
      lowerLipGroup.add(l)
      lowerLip[side] = l
    }
    const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mouth)
    inner.scale.set(0.017, 0.001, 0.003)
    inner.position.z = -0.002
    inner.visible = false
    mouthAnchor.add(inner)
    return { eyes, brows, upperLip, lowerLip, lowerLipGroup, inner }
  }

  // ---- playback ----

  applyPose(pose: PoseSample): void {
    for (const [name, bone] of this.bones) {
      const q = pose.bones[name]
      if (q) bone.quaternion.copy(q)
      else bone.quaternion.identity()
    }
    this.bones.get('hips')?.position.copy(this.restHips).add(pose.hips)
    this.applyFace(pose.face)
  }

  /** Subtle face: brows, blinks, jaw and mouth corners from MediaPipe blendshapes. */
  private applyFace(face: Record<string, number>) {
    const v = (n: string) => Math.min(1, Math.max(0, face[n] ?? 0))
    const f = this.face
    const innerUp = v('browInnerUp')
    for (const side of ['left', 'right'] as const) {
      const Side = side === 'left' ? 'Left' : 'Right'
      const down = v(`browDown${Side}`)
      // Rotation about Z with the mesh mirrored by scale.x: a positive angle
      // drops the inner end on either side.
      const brow = f.brows[side]
      brow.position.y = 0.004 * innerUp - 0.004 * down
      brow.rotation.z = (0.22 * down - 0.2 * innerUp) * (side === 'left' ? 1 : -1)

      f.eyes[side].scale.y = 0.0075 * (1 - 0.85 * v(`eyeBlink${Side}`))

      const curve = (0.3 * v(`mouthSmile${Side}`) - 0.28 * v(`mouthFrown${Side}`)) * (side === 'left' ? 1 : -1)
      f.upperLip[side].rotation.z = curve
      f.lowerLip[side].rotation.z = curve
    }
    const open = 0.016 * v('jawOpen')
    f.lowerLipGroup.position.y = -0.0045 - open
    f.inner.visible = open > 0.0008
    f.inner.position.y = -0.00225 - open / 2
    f.inner.scale.y = Math.max(0.001, open / 2 + 0.0015)
  }

  boneWorldPosition(name: string, target: THREE.Vector3): THREE.Vector3 | null {
    const bone = this.bones.get(name)
    if (!bone) return null
    bone.updateWorldMatrix(true, false)
    return bone.getWorldPosition(target)
  }

  dispose(): void {
    const geos = new Set<THREE.BufferGeometry>()
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) geos.add(o.geometry)
    })
    geos.forEach((g) => g.dispose())
    Object.values(this.mats).forEach((m) => m.dispose())
    this.root.removeFromParent()
  }
}
