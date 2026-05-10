export type LandmarkPoint = {
  x: number
  y: number
  z: number
  visibility?: number
}

export type LiveScores = {
  handShape: number
  handPosition: number
  movementPath: number
  facialExpression: number
  timing: number
  overall: number
}

export type LandmarkFlags = {
  leftHandDetected: boolean
  rightHandDetected: boolean
  poseDetected: boolean
}

export type CorrectionArrow = {
  x: number
  y: number
  dx: number
  dy: number
}

export type ColoredLandmark = LandmarkPoint & {
  isCorrect: boolean
  correction?: CorrectionArrow
}

export type NormalizedFrame = {
  frameIndex: number
  timestamp: number
  pose: LandmarkPoint[]
  leftHand: LandmarkPoint[]
  rightHand: LandmarkPoint[]
  face: LandmarkPoint[]
  scores: LiveScores
}

export type PracticeResult = {
  predictedSign: string
  message: string
  explanation: string
  scores: LiveScores
  revisionRecommended: boolean
  recommendedFocus: string[]
  revisionSigns: string[]
}

export type EngagementState = {
  emotion: 'focused' | 'bored' | 'fatigued'
  engagement: number
  isBored: boolean
  isFatigued: boolean
  sessionSeconds: number
}

export type PracticeRealtimeState = {
  scores: LiveScores
  flags: LandmarkFlags
  frameCount: number
  engagement: EngagementState
}

export type HolisticResultsLike = {
  poseLandmarks?: LandmarkPoint[]
  leftHandLandmarks?: LandmarkPoint[]
  rightHandLandmarks?: LandmarkPoint[]
  faceLandmarks?: LandmarkPoint[]
}
