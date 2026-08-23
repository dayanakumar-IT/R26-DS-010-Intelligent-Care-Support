import type {
  ColoredLandmark,
  LandmarkFlags,
  LandmarkPoint,
  LiveScores,
  NormalizedFrame,
  PracticeResult,
} from '../types/mediaPipe.types'

function scoreByDeviation(value: number, target: number, tolerance: number) {
  const deviation = Math.abs(value - target)
  return Math.max(0, Math.min(100, Math.round(100 - (deviation / tolerance) * 100)))
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
}

function getLandmark(points: LandmarkPoint[], fallbackX: number, fallbackY: number, index = 0) {
  return points[index] ?? { x: fallbackX, y: fallbackY, z: 0 }
}

export function scoreLiveLandmarks(
  pose: LandmarkPoint[],
  leftHand: LandmarkPoint[],
  rightHand: LandmarkPoint[],
  face: LandmarkPoint[],
  movementDelta: number,
): { scores: LiveScores; colorizedLandmarks: ColoredLandmark[]; flags: LandmarkFlags } {
  const leftWrist = getLandmark(leftHand, 0.42, 0.65)
  const rightWrist = getLandmark(rightHand, 0.58, 0.65)
  const leftElbow = getLandmark(pose, 0.4, 0.68, 13)
  const rightElbow = getLandmark(pose, 0.6, 0.68, 14)
  const faceNose = getLandmark(face, 0.5, 0.42)

  const inZoneLeft = leftWrist.y < 0.72 && leftWrist.y > 0.35 && leftWrist.x > 0.2 && leftWrist.x < 0.7
  const inZoneRight = rightWrist.y < 0.72 && rightWrist.y > 0.35 && rightWrist.x > 0.3 && rightWrist.x < 0.8
  const handPosition = average([
    scoreByDeviation(leftWrist.y, 0.52, 0.3),
    scoreByDeviation(rightWrist.y, 0.52, 0.3),
    inZoneLeft ? 92 : 55,
    inZoneRight ? 92 : 55,
  ])

  const leftFingerSpread = leftHand.length > 8 ? Math.abs(leftHand[4].x - leftHand[8].x) : 0.08
  const rightFingerSpread = rightHand.length > 8 ? Math.abs(rightHand[4].x - rightHand[8].x) : 0.08
  const handShape = average([
    scoreByDeviation(leftFingerSpread, 0.07, 0.06),
    scoreByDeviation(rightFingerSpread, 0.07, 0.06),
  ])

  const movementPath = movementDelta > 0.016 ? 84 : movementDelta > 0.009 ? 72 : 58
  const facialExpression = face.length > 0 ? (faceNose.y < 0.5 ? 78 : 66) : 54
  const timing = movementDelta > 0.03 ? 62 : movementDelta < 0.004 ? 60 : 88
  const overall = average([handShape, handPosition, movementPath, facialExpression, timing])

  const colorizedLandmarks: ColoredLandmark[] = [
    {
      ...leftWrist,
      isCorrect: inZoneLeft,
      correction: inZoneLeft ? undefined : { x: leftWrist.x, y: leftWrist.y, dx: 0.02, dy: -0.08 },
    },
    {
      ...rightWrist,
      isCorrect: inZoneRight,
      correction: inZoneRight ? undefined : { x: rightWrist.x, y: rightWrist.y, dx: -0.02, dy: -0.08 },
    },
    {
      ...leftElbow,
      isCorrect: leftElbow.y < 0.78,
      correction: leftElbow.y < 0.78 ? undefined : { x: leftElbow.x, y: leftElbow.y, dx: 0, dy: -0.06 },
    },
    {
      ...rightElbow,
      isCorrect: rightElbow.y < 0.78,
      correction: rightElbow.y < 0.78 ? undefined : { x: rightElbow.x, y: rightElbow.y, dx: 0, dy: -0.06 },
    },
  ]

  return {
    scores: { handShape, handPosition, movementPath, facialExpression, timing, overall },
    colorizedLandmarks,
    flags: {
      leftHandDetected: leftHand.length > 0,
      rightHandDetected: rightHand.length > 0,
      poseDetected: pose.length > 0,
    },
  }
}

export function buildPracticeResult(scores: LiveScores, recordedFrames: NormalizedFrame[]): PracticeResult {
  const recommendedFocus: string[] = []
  if (scores.handPosition < 70) {
    recommendedFocus.push('Use slow-motion tutorial for hand position control.')
  }
  if (scores.facialExpression < 70) {
    recommendedFocus.push('Practice non-manual cue expression drills.')
  }
  if (scores.overall < 70) {
    recommendedFocus.push('Revision recommended before moving to next sign.')
  } else {
    recommendedFocus.push('Great progress, next sign unlocked.')
  }

  return {
    predictedSign: 'HELP',
    message: scores.overall >= 80 ? 'Great Job!' : 'Good attempt, keep practicing.',
    explanation: `Your hand shape matched the reference well. Your hand position was slightly low, and your facial expression was neutral. Try raising your hand slightly and maintaining a more attentive caregiver expression. (${recordedFrames.length} landmark frames analyzed)`,
    scores,
    revisionRecommended: scores.overall < 70,
    recommendedFocus,
    revisionSigns:
      scores.overall < 70 || scores.facialExpression < 70 || scores.handPosition < 70
        ? ['HELP', 'PAIN', 'MEDICINE']
        : [],
  }
}
