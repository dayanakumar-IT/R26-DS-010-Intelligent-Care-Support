import type { NormalizedFrame } from '../types/mediaPipe.types'

export function createFrameBufferService(limit = 30) {
  let recording = false
  let frames: NormalizedFrame[] = []

  return {
    start() {
      recording = true
      frames = []
    },
    stop() {
      recording = false
    },
    reset() {
      recording = false
      frames = []
    },
    append(frame: NormalizedFrame) {
      if (!recording || frames.length >= limit) {
        return false
      }
      frames.push(frame)
      if (frames.length >= limit) {
        recording = false
        return true
      }
      return false
    },
    getFrames() {
      return [...frames]
    },
    isRecording() {
      return recording
    },
    progress() {
      return { current: frames.length, total: limit }
    },
    isFull() {
      return frames.length >= limit
    },
  }
}
