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
  // Optional rights-clear reference video URL, for signs that have one —
  // the backend does not populate this yet. The 3D avatar (driven by
  // `frames` above) remains the primary reference demonstration; a video
  // is only ever an optional teaching supplement, never a replacement,
  // and must come from an approved/rights-clear source — never sourced
  // or guessed by the frontend. Absent/null means "no video available",
  // which SignDemoPanel handles gracefully.
  video_url?: string | null
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
  // Task 6 instrumentation — per-stage backend timings in ms. Additive
  // and optional; the UI only uses it for a dev/diagnostic readout.
  timings?: Record<string, number>
  // Diagnostic summary — additive, optional. Explains a recognition
  // result: predicted vs expected, confidence, top-3, capture quality,
  // active model artifact, and whether any mirroring/preprocessing was
  // applied server-side (always false).
  diagnostics?: GlossAttemptDiagnostics
}

export interface GlossAttemptDiagnostics {
  attempt_type: GlossAttemptType
  target_sign_id: string
  predicted_sign_id: string | null
  confidence: number | null
  is_correct_sign: boolean
  server_side_mirroring: boolean
  top3?: Array<{ sign_id: string; confidence: number }>
  raw_frame_count?: number
  fully_undetected_frames?: number
  missing_landmark_fraction?: number
  preprocessing?: string
  selected_sign_id?: string
  note?: string
  model_name?: string | null
  model_input_shape?: number[] | null
  class_count?: number
}

// GET /gloss/signs/{sign_id}/demo-video — validated human reference
// video metadata. Teaching reference only; never part of scoring. A
// 404 from the endpoint means "no reference video for this sign" and
// the UI falls back to the 2D Sign Guide. `video_url` may be a
// short-lived presigned Cloudflare R2 URL — `url_expires_in` (seconds)
// is present when it is; re-fetch on expiry rather than caching it.
export interface GlossDemoVideo {
  sign_id: string
  video_url: string
  duration_seconds: number | null
  url_expires_in?: number
}

export interface GlossMasterySummaryRow {
  sign_id: string
  display_name: string
  mastery_status: GlossMasteryStatus
  attempts: number
  best_score: number | null
  last_score: number | null
  last_practiced_at: string | null
}

export interface GlossPracticeCalendarDay {
  date: string // YYYY-MM-DD
  attempt_count: number
}

// GET /gloss/progress
export interface GlossProgressReport {
  signs_practiced: number
  mastered_count: number
  improving_count: number
  learning_count: number
  total_attempts: number
  mastery_summary: GlossMasterySummaryRow[]
  practice_calendar: GlossPracticeCalendarDay[]
}

// GET /gloss/history
export interface GlossHistoryEntry {
  attempt_id: string
  target_sign_id: string
  target_display_name: string
  recognized_sign_id: string | null
  recognized_display_name: string | null
  is_correct_sign: boolean
  recognition_confidence: number | null
  attempt_type: GlossAttemptType
  quality_tier: GlossQualityTier | null
  execution_score: number | null
  attempted_at: string
}
