import type { LandmarkFlags, HolisticResultsLike } from '../types/mediaPipe.types'
import cls from './signVitals.module.css'

export function LandmarkMiniPreview({
  results,
  flags,
}: {
  results: HolisticResultsLike | null
  flags: LandmarkFlags
}) {
  return (
    <div className={cls.miniPreview}>
      <strong>Landmark Detection</strong>
      <div>Left hand: {flags.leftHandDetected ? 'Detected' : 'Not detected'}</div>
      <div>Right hand: {flags.rightHandDetected ? 'Detected' : 'Not detected'}</div>
      <div>Pose: {flags.poseDetected ? 'Detected' : 'Not detected'}</div>
      <div>Face points: {results?.faceLandmarks?.length ?? 0}</div>
    </div>
  )
}
