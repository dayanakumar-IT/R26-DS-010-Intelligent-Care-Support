import '@mediapipe/camera_utils'
import '@mediapipe/holistic'
import type { HolisticResultsLike } from '../types/mediaPipe.types'

type MediaPipeWindow = Window & {
  Camera?: new (
    video: HTMLVideoElement,
    options: { onFrame: () => Promise<void>; width: number; height: number; facingMode?: 'user' | 'environment' },
  ) => { start: () => Promise<void>; stop: () => Promise<void> }
  Holistic?: new (options: { locateFile: (file: string) => string }) => {
    setOptions: (options: Record<string, unknown>) => void
    onResults: (cb: (results: HolisticResultsLike) => void) => void
    send: (input: { image: HTMLVideoElement }) => Promise<void>
    close: () => Promise<void>
  }
}

export function createMediaPipeService() {
  let camera: InstanceType<NonNullable<MediaPipeWindow['Camera']>> | null = null
  let holistic: InstanceType<NonNullable<MediaPipeWindow['Holistic']>> | null = null
  let facingMode: 'user' | 'environment' = 'user'

  function ensurePipeline(onResults: (results: HolisticResultsLike) => void) {
    const mpWindow = window as MediaPipeWindow
    if (!mpWindow.Holistic) {
      throw new Error('Holistic is unavailable')
    }
    const next = new mpWindow.Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    })
    next.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      selfieMode: true,
    })
    next.onResults(onResults)
    return next
  }

  return {
    async start(video: HTMLVideoElement, onResults: (results: HolisticResultsLike) => void) {
      const mpWindow = window as MediaPipeWindow
      if (!mpWindow.Camera) {
        throw new Error('Camera utils unavailable')
      }
      if (!holistic) {
        holistic = ensurePipeline(onResults)
      }
      camera = new mpWindow.Camera(video, {
        onFrame: async () => {
          if (holistic) {
            await holistic.send({ image: video })
          }
        },
        width: 640,
        height: 480,
        facingMode,
      })
      await camera.start()
    },
    async stop() {
      if (camera) {
        await camera.stop()
        camera = null
      }
    },
    toggleFacingMode() {
      facingMode = facingMode === 'user' ? 'environment' : 'user'
      return facingMode
    },
    async dispose() {
      await this.stop()
      if (holistic) {
        await holistic.close()
        holistic = null
      }
    },
  }
}
