export type GlossAttemptType = 'webcam' | 'multiple_choice'

export type GlossQualityTier = 'strong' | 'moderate' | 'weak'

export type GlossMasteryStatus =
  | 'new'
  | 'learning'
  | 'weak'
  | 'improving'
  | 'mastered'
  | 'needs_revision'

export interface GlossSign {
  id: string
  display_name: string
}

export interface GlossLandmark {
  x: number
  y: number
  z: number
}

export interface GlossReferenceFrame {
  landmarks: GlossLandmark[] // always exactly 49, in landmark_names.json order
}

export interface GlossSignReference {
  sign_id: string
  display_name: string
  frame_count: number
  frames: GlossReferenceFrame[]
}

export interface DeviatingGroup {
  group: string
  friendly_name: string
  deviation_score: number
}

export interface CorrectiveFeedback {
  summary: string
  top_deviating_groups: DeviatingGroup[]
}

export interface GlossMastery {
  id: string
  caregiver_profile_id: string
  sign_id: string
  attempts: number
  consecutive_strong_streak: number
  mastery_status: GlossMasteryStatus
  recognition_mismatch_count: number
  best_score: number | null
  last_score: number | null
  last_practiced_at: string | null
  has_verified_strong_execution: boolean
}

export interface GlossAttemptResult {
  attempt_id: string
  session_id: string
  is_correct_sign: boolean
  recognized_sign_id: string | null
  recognition_confidence: number | null
  quality_tier: GlossQualityTier | null
  execution_score: number | null
  corrective_feedback: CorrectiveFeedback
  mastery: GlossMastery
  next_recommended_sign_id: string
}
