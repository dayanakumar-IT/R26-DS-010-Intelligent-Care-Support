import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { BONE_LENGTHS, FINGER_BIND_TILT, type FingerChains, type RefMap } from './avatarRigMapper'

/**
 * ProceduralAvatar.tsx
 * GLOSS component — TEMPORARY geometry layer: a simple rigged humanoid
 * built from Three.js primitives (capsules/cylinders/spheres), not a
 * licensed model. This is the ONLY layer that should need replacing
 * when a proper rigged GLB is approved later — it consumes the same
 * RigPose shape avatarRigMapper.ts produces (via applyRigPose, which
 * lives in that file so this one can stay component-only for Fast
 * Refresh), reusable as-is against a real GLTF skeleton's named bones.
 *
 * Visual priorities, per spec: correct arm movement > wrist
 * orientation > hand orientation > readable finger articulation >
 * smooth motion > visual polish. This is why proportions here are
 * rough and materials are flat/neutral — polish is deliberately last.
 *
 * Ref handling: refs are never dereferenced (`.current`) during the
 * render body — only inside ref callbacks (which React invokes post-
 * commit) and inside the mount effect below — per React's rule that
 * ref reads must happen outside of render.
 */

const SKIN_COLOR = '#d8b491'
const CLOTHING_COLOR = '#3b5fc4'
const BONE_RADIUS = 0.02
const FINGER_RADIUS = 0.007

type FingerName = keyof FingerChains
const FINGER_NAMES: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky']
// Local X spread across the palm (bind pose), roughly knuckle order thumb->pinky.
const FINGER_X_OFFSET: Record<FingerName, number> = {
  thumb: -0.075,
  index: -0.045,
  middle: -0.015,
  ring: 0.015,
  pinky: 0.045,
}

function boneMesh(length: number, radius = BONE_RADIUS, color = SKIN_COLOR) {
  return (
    <mesh position={[0, -length / 2, 0]}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function renderFinger(side: 'left' | 'right', name: FingerName, refs: RefObject<RefMap>) {
  const length = name === 'thumb' ? BONE_LENGTHS.thumbSegment : BONE_LENGTHS.fingerSegment
  const key = (i: number) => `${side}.hand.finger.${name}.${i}`

  return (
    <group
      key={name}
      position={[FINGER_X_OFFSET[name], 0, BONE_LENGTHS.hand * 0.5]}
      rotation={FINGER_BIND_TILT[name]}
    >
      <group ref={(el) => refs.current.set(key(0), el)}>
        {boneMesh(length, FINGER_RADIUS)}
        <group position={[0, -length, 0]} ref={(el) => refs.current.set(key(1), el)}>
          {boneMesh(length, FINGER_RADIUS)}
          <group position={[0, -length, 0]} ref={(el) => refs.current.set(key(2), el)}>
            {boneMesh(length * 0.85, FINGER_RADIUS)}
          </group>
        </group>
      </group>
    </group>
  )
}

function renderArm(side: 'left' | 'right', refs: RefObject<RefMap>) {
  const shoulderKey = `${side}.shoulder`
  const upperArmKey = `${side}.upperArm`
  const forearmKey = `${side}.forearm`
  const handKey = `${side}.hand`

  return (
    <group key={side} ref={(el) => refs.current.set(shoulderKey, el)}>
      {/* Shoulder cap */}
      <mesh>
        <sphereGeometry args={[BONE_RADIUS * 1.4, 10, 8]} />
        <meshStandardMaterial color={CLOTHING_COLOR} />
      </mesh>

      <group ref={(el) => refs.current.set(upperArmKey, el)}>
        {boneMesh(BONE_LENGTHS.upperArm, BONE_RADIUS * 1.15, CLOTHING_COLOR)}

        <group position={[0, -BONE_LENGTHS.upperArm, 0]} ref={(el) => refs.current.set(forearmKey, el)}>
          {boneMesh(BONE_LENGTHS.forearm, BONE_RADIUS, SKIN_COLOR)}

          <group position={[0, -BONE_LENGTHS.forearm, 0]} ref={(el) => refs.current.set(handKey, el)}>
            {/* Palm */}
            <mesh position={[0, -BONE_LENGTHS.hand * 0.4, 0]}>
              <boxGeometry args={[0.09, BONE_LENGTHS.hand * 0.8, 0.025]} />
              <meshStandardMaterial color={SKIN_COLOR} />
            </mesh>
            <group position={[0, -BONE_LENGTHS.hand * 0.8, 0]}>
              {FINGER_NAMES.map((name) => renderFinger(side, name, refs))}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

interface ProceduralAvatarProps {
  onReady: (refs: RefMap) => void
}

export default function ProceduralAvatar({ onReady }: ProceduralAvatarProps) {
  const refs = useRef<RefMap>(new Map())

  useEffect(() => {
    onReady(refs.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <group>
      {/* Stable, neutral torso + head — no landmarks drive these (see
          avatarRigMapper.ts docstring: the 7 available upper-body
          landmarks don't include hips/spine/head, so this project's
          "do not fabricate unavailable motion" rule keeps them static). */}
      <mesh position={[0, -0.55, 0]}>
        <capsuleGeometry args={[0.22, 0.55, 4, 8]} />
        <meshStandardMaterial color={CLOTHING_COLOR} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color={SKIN_COLOR} />
      </mesh>

      {/* Shoulder anchors are positioned imperatively per-frame (see
          avatarRigMapper.ts's applyRigPose) directly from reference
          data — which is already ~(-0.5,0,z)/(0.5,0,z) by construction
          of GLOSS's shoulder-width normalization (see
          referenceCoordinates.ts). No static positional wrapper here:
          one previously existed and double-applied that same ~0.5
          offset on top of the data-driven position, pushing both
          shoulders out to +-1.0 and off-screen (this was the root
          cause of "arms not rendering" — fixed by removing it). */}
      {renderArm('left', refs)}
      {renderArm('right', refs)}
    </group>
  )
}
