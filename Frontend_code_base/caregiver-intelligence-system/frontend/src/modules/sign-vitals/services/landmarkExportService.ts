import type { HolisticResultsLike, LiveScores, NormalizedFrame } from '../types/mediaPipe.types'

function cloneLandmarks(points?: HolisticResultsLike['poseLandmarks']) {
  return (points ?? []).map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    visibility: point.visibility,
  }))
}

export function toNormalizedFrame(
  frameIndex: number,
  timestamp: number,
  results: HolisticResultsLike,
  scores: LiveScores,
): NormalizedFrame {
  return {
    frameIndex,
    timestamp,
    pose: cloneLandmarks(results.poseLandmarks),
    leftHand: cloneLandmarks(results.leftHandLandmarks),
    rightHand: cloneLandmarks(results.rightHandLandmarks),
    face: cloneLandmarks(results.faceLandmarks),
    scores,
  }
}
