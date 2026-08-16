/** MediaPipe Tasks Vision — pinned to 0.10.14 per CareSense requirements. */
export const MEDIAPIPE_TASKS_VERSION = '0.10.14'

export const VISION_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VERSION}/wasm`

/** Google-hosted .task blobs (same as MediaPipe model cards). */
export const HAND_LANDMARKER_TASK_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
