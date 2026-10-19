import * as THREE from 'three'
import type { AvatarRig } from './rig/AvatarRig.ts'

/**
 * avatarStage.ts
 * GLOSS component — renderer, camera and lights for the 3D signer.
 *
 * The camera looks at the signer straight on (the character faces +Z),
 * framed head to waist.
 * The viewer can turn the view a limited amount; nothing else moves.
 */

const TARGET = new THREE.Vector3(0, 1.38, 0.12)
const DISTANCE = 1.75
export const DEFAULT_VIEW = { yaw: 0, pitch: 0.04 } // radians: straight on, eye level
export const VIEW_LIMITS = { yaw: 0.6, pitch: 0.3 }

export class AvatarStage {
  readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20)
  private readonly resize: ResizeObserver
  private view = { ...DEFAULT_VIEW }
  private readonly host: HTMLElement
  readonly rig: AvatarRig

  /** Throws if WebGL is unavailable; the caller falls back to the 2D guide. */
  constructor(host: HTMLElement, rig: AvatarRig) {
    this.host = host
    this.rig = rig
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    host.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color('#eef2f6')
    // Soft, even light: sky/ground fill plus a gentle key from the upper
    // front-left and a weak rim from behind to separate hands from the body.
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#cbd5e1', 1.6))
    const key = new THREE.DirectionalLight('#ffffff', 1.6)
    key.position.set(-1.2, 2.4, 2.2)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight('#e0f2fe', 0.6)
    rim.position.set(1.5, 2, -2)
    this.scene.add(rim)
    this.scene.add(rig.root)

    this.resize = new ResizeObserver(() => this.fit())
    this.resize.observe(host)
    this.fit()
  }

  private fit() {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.placeCamera()
    this.render()
  }

  private placeCamera() {
    const { yaw, pitch } = this.view
    // Narrow views need a wider field of view to keep both hands in frame.
    const d = DISTANCE * Math.max(1, 1.15 / this.camera.aspect)
    this.camera.position.set(
      TARGET.x + d * Math.sin(yaw) * Math.cos(pitch),
      TARGET.y + d * Math.sin(pitch),
      TARGET.z + d * Math.cos(yaw) * Math.cos(pitch),
    )
    this.camera.lookAt(TARGET)
  }

  /** Turn the view by (dYaw, dPitch) radians, within limits. */
  turn(dYaw: number, dPitch: number) {
    const clamp = (v: number, lim: number, base: number) => Math.min(base + lim, Math.max(base - lim, v))
    this.view.yaw = clamp(this.view.yaw + dYaw, VIEW_LIMITS.yaw, DEFAULT_VIEW.yaw)
    this.view.pitch = clamp(this.view.pitch + dPitch, VIEW_LIMITS.pitch, DEFAULT_VIEW.pitch)
    this.placeCamera()
    this.render()
  }

  resetView() {
    this.view = { ...DEFAULT_VIEW }
    this.placeCamera()
    this.render()
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  /** Frees GPU memory (geometries, materials, the WebGL context). */
  dispose() {
    this.resize.disconnect()
    this.rig.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}
