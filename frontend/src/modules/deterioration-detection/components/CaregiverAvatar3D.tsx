import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import styles from './CaregiverAvatar3D.module.css'

export type RiskTier = 'high' | 'moderate' | 'low' | 'neutral'

interface CaregiverAvatar3DProps {
  riskTier: RiskTier
  // Defaults preserve the original Caregiver Profiles detail-view size.
  // Camera FOV/distance were tuned assuming this rough proportion, but
  // since the face is a plain centered sphere (no asymmetric features to
  // frame around), any width/height still comfortably fits it with margin
  // — the aspect ratio only changes how much *horizontal* breathing room
  // there is, never a clipping risk. Used with a smaller square size for
  // the compact avatars in Overview's Requires Attention cards and Team
  // Risk Heatmap's Most Improved/Largest Risk Increase callouts.
  width?: number
  height?: number
}

// Duplicated from styles/tokens.css (--risk-high/-moderate/-low/-neutral) —
// three.js materials need real color values, not CSS custom properties, so
// these have to be kept in sync by hand if that token file ever changes.
// Used directly, full-strength, as the sphere's own color — no skin-tone
// blend this time, per the "solid color, not a tint" request.
const RISK_COLOR: Record<RiskTier, number> = {
  high: 0xd92d20,
  moderate: 0xb45309,
  low: 0x15803d,
  neutral: 0x9ca3af,
}

// Idle-animation "tension" per risk tier: higher tension means a faster,
// smaller, twitchier idle bob; lower tension means a slower, calmer one.
// Neutral (no data) is still. Kept from the previous versions since it
// wasn't asked to be removed — color already carries the primary risk
// signal, this is just a small supporting touch.
const TENSION: Record<RiskTier, number> = {
  high: 1,
  moderate: 0.55,
  low: 0.15,
  neutral: 0,
}

const CANVAS_WIDTH = 240
const CANVAS_HEIGHT = 280
const HEAD_RADIUS = 0.7

// Where a point at (x, y) on the sphere's surface sits in Z (in front of
// the head) — solved from the sphere equation x² + y² + z² = r². Used to
// place the eyes/mouth flush against the actual surface instead of
// eyeballing a z offset.
function headSurfaceZ(x: number, y: number): number {
  return HEAD_RADIUS * Math.sqrt(Math.max(0, 1 - (x / HEAD_RADIUS) ** 2 - (y / HEAD_RADIUS) ** 2))
}

// A drastically minimal avatar, primitives only: one round sphere (solid
// risk color), two eyes, one smile curve. Nothing else — no hair, ears,
// neck, collar, or accent. No CapsuleGeometry, no OrbitControls (both
// r128-era constraints, though neither is relevant to a design this
// simple anymore). The head gently auto-sways so it still reads as 3D
// without needing input.
//
// Lazy-loaded by CaregiverProfiles via React.lazy so the three.js bundle is
// only fetched once a caregiver's detail view is actually opened, and this
// component itself is only ever mounted while that view is open (never on
// the caregiver list).
export default function CaregiverAvatar3D({
  riskTier,
  width: propWidth = CANVAS_WIDTH,
  height: propHeight = CANVAS_HEIGHT,
}: CaregiverAvatar3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || propWidth
    const height = container.clientHeight || propHeight

    const scene = new THREE.Scene()

    // A plain round sphere centered on the origin — no asymmetric features
    // (no hair overhang, no offset torso) to account for this time, so the
    // camera just looks straight at the center with a comfortable margin.
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100)
    camera.position.set(0, 0, 3.1)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Soft two-light setup: a hemisphere light for gentle all-over
    // sky/ground fill, plus one soft directional key light — enough to
    // avoid a flat look without adding anything beyond simple lighting.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.7))
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
    keyLight.position.set(1.5, 2, 3)
    scene.add(keyLight)

    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []

    // The sphere's own color IS the risk color, full strength — not a
    // tinted skin tone.
    const headMaterial = new THREE.MeshStandardMaterial({
      color: RISK_COLOR[riskTier],
      roughness: 0.55,
    })
    const faceDetailMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.35 })
    materials.push(headMaterial, faceDetailMaterial)

    const face = new THREE.Group()

    const headGeometry = new THREE.SphereGeometry(HEAD_RADIUS, 24, 18)
    const head = new THREE.Mesh(headGeometry, headMaterial)
    face.add(head)
    geometries.push(headGeometry)

    // Eyes — two small dark spheres set just proud of the surface,
    // positioned naturally above center.
    const eyeY = HEAD_RADIUS * 0.18
    const eyeX = HEAD_RADIUS * 0.35
    const eyeZ = headSurfaceZ(eyeX, eyeY) - 0.03
    const eyeGeometry = new THREE.SphereGeometry(0.09, 12, 10)
    const leftEye = new THREE.Mesh(eyeGeometry, faceDetailMaterial)
    leftEye.position.set(-eyeX, eyeY, eyeZ)
    face.add(leftEye)
    const rightEye = new THREE.Mesh(eyeGeometry, faceDetailMaterial)
    rightEye.position.set(eyeX, eyeY, eyeZ)
    face.add(rightEye)
    geometries.push(eyeGeometry)

    // Mouth — a thin tube following a quadratic Bezier curve, dipping
    // clearly below its endpoints for an unambiguous smile (a shallower
    // curve here previously read as a flat, mustache-like line — this
    // amplitude is deliberately generous so it's unmistakably a smile).
    // Kept as one fixed shape regardless of risk tier, since color already
    // carries the primary signal.
    const mouthY = -HEAD_RADIUS * 0.22
    const mouthHalfWidth = HEAD_RADIUS * 0.32
    const mouthZ = headSurfaceZ(0, mouthY) - 0.02
    const mouthDip = HEAD_RADIUS * 0.13
    const mouthCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-mouthHalfWidth, mouthY, mouthZ),
      new THREE.Vector3(0, mouthY - mouthDip, mouthZ),
      new THREE.Vector3(mouthHalfWidth, mouthY, mouthZ),
    )
    const mouthGeometry = new THREE.TubeGeometry(mouthCurve, 12, 0.02, 6, false)
    const mouth = new THREE.Mesh(mouthGeometry, faceDetailMaterial)
    face.add(mouth)
    geometries.push(mouthGeometry)

    scene.add(face)

    const tension = TENSION[riskTier]

    let frameId = 0
    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()
      const bobSpeed = 1 + tension * 1.8
      const bobAmount = 0.015 + tension * 0.012
      face.position.y = Math.sin(t * bobSpeed) * bobAmount
      // Gentle side-to-side sway (not a full spin, and not OrbitControls)
      // so the head still reads as genuinely 3D at rest.
      face.rotation.y = Math.sin(t * 0.3) * 0.3
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      renderer.dispose()
      for (const material of materials) material.dispose()
      for (const geometry of geometries) geometry.dispose()
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [riskTier, propWidth, propHeight])

  return (
    <div ref={containerRef} className={styles.canvasHost} style={{ width: propWidth, height: propHeight }} />
  )
}
