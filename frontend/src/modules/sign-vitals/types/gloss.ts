export type GlossAttemptType = 'webcam' | 'multiple_choice'

// practice = lesson flow; recall = word only, from memory (graded like practice);
// free = Check my sign (no target; never counted toward progress).
export type GlossAttemptMode = 'practice' | 'recall' | 'free'

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
  // false for dictionary-only signs (weak reference demonstration): never
  // recommended automatically, but practisable from Browse.
  recommendable?: boolean
  quality_note?: string | null
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

// How an attempt ended — set by the backend on every response, so the UI
// never infers it. 'not_recognised' = model confidence below 35%: no sign
// is named and mastery is unchanged. 'capture_rejected' never reaches
// GlossAttemptResult (see GlossCaptureRejection).
export type GlossAttemptOutcome =
  | 'target_sign'
  | 'different_sign'
  | 'not_recognised'
  | 'quiz_correct'
  | 'quiz_wrong'

export interface GlossCaptureCheck {
  passed: boolean
  reason: 'hands_not_visible' | 'no_movement' | null
  message: string | null
  hand_presence: number
  motion_extent: number
}

// POST /gloss/attempts when a capture gate stopped the clip before the
// model ran (hands not visible / no movement). Nothing was stored.
export interface GlossCaptureRejection {
  outcome: 'capture_rejected'
  session_id: string
  message: string
  capture_check: GlossCaptureCheck
}

export interface GlossAttemptResult {
  outcome: GlossAttemptOutcome
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
  mode?: GlossAttemptMode
  // Milestones this attempt newly earned (celebrated only on a success).
  new_milestones?: GlossNewMilestone[]
  pipeline_version?: string
  // True while the reworded feedback text is still being prepared: the rule
  // text is shown now and GET /gloss/attempts/{id}/feedback swaps it in.
  feedback_pending?: boolean
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
  capture_check?: GlossCaptureCheck
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

// The latest attempt on a sign, as a learner-facing result.
export type GlossLastResult =
  | GlossQualityTier
  | 'different_sign'
  | 'not_recognised'
  | 'quiz_correct'
  | 'quiz_wrong'

export interface GlossMasterySummaryRow {
  sign_id: string
  display_name: string
  mastery_status: GlossMasteryStatus
  attempts: number
  camera_attempts: number
  consecutive_strong_streak: number
  last_result: GlossLastResult | null
  recommendable?: boolean
  // Demonstrated, then a strong recall attempt 7+ days later.
  retained?: boolean
  // hurt, pain, me, sleep: the camera cannot judge these reliably.
  camera_unreliable_note?: string | null
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
  camera_attempts: number
  quiz_answers: number
  // Strong attempts in a row needed for a sign to count as demonstrated.
  strong_needed: number
  mastery_summary: GlossMasterySummaryRow[]
  practice_calendar: GlossPracticeCalendarDay[]
}

// GET /gloss/history
export interface GlossHistoryEntry {
  attempt_id: string
  target_sign_id: string | null // null for Check my sign (mode 'free')
  target_display_name: string | null
  recognized_sign_id: string | null
  recognized_display_name: string | null
  is_correct_sign: boolean
  // Webcam attempt below the confidence cut-off — never shown with a sign name.
  not_recognised?: boolean
  recognition_confidence: number | null
  attempt_type: GlossAttemptType
  quality_tier: GlossQualityTier | null
  execution_score: number | null
  attempted_at: string
  mode?: GlossAttemptMode
  // Made with an earlier grading pipeline: practice only, never skill.
  earlier_version?: boolean
}

export interface GlossNewMilestone {
  type: GlossMilestoneType
  key: string
  name: string
  achieved_at: string
}

export type GlossMilestoneType = 'demonstrated' | 'retained' | 'level' | 'category' | 'practice' | 'monthly'

// POST /gloss/attempts with mode='free' (Check my sign).
export interface GlossFreeResult {
  outcome: 'free_match' | 'free_maybe' | 'free_no_match'
  mode: 'free'
  attempt_id: string
  session_id: string
  recognition_confidence: number
  suggestions: Array<{ sign_id: string; confidence: number }>
  top3: Array<{ sign_id: string; confidence: number }>
  capture_check: GlossCaptureCheck
}

export type GlossSignStatus = 'not_started' | 'practising' | 'demonstrated' | 'retained'

export interface GlossBadge {
  type: GlossMilestoneType
  key: string
  name: string
  description: string
  earned_at: string | null
}

// GET /gloss/progress/summary — levels, badges and My Journey.
export interface GlossProgressSummary {
  level: { key: string; name: string } | null
  next_level: { key: string; name: string; missing: string } | null
  levels: Array<{ key: string; name: string; rule: string; earned_at: string | null }>
  // practised: different signs tried in practice or recall (camera or quiz).
  // not_assessed: signs the camera does not assess (not countable).
  counts: { countable: number; demonstrated: number; retained: number; practised: number; not_assessed?: number }
  categories: Array<{
    key: string
    name: string
    countable: number
    demonstrated: number
    retained: number
    badge_earned_at: string | null
    signs: Array<{
      sign_id: string
      status: GlossSignStatus
      countable: boolean
      note: string | null
      demonstrated_at: string | null
      retained_at: string | null
    }>
  }>
  skill_badges: GlossBadge[]
  practice_badges: GlossBadge[]
  monthly: {
    month: string
    active_days: number
    tiers: number[]
    badges: Array<{ type: 'monthly'; key: string; month: string; days: number; name: string; earned_at: string }>
  }
  timezone: string
  pipeline_version: string
}

// GET /gloss/me
export interface GlossMe {
  role: 'admin' | 'supervisor' | 'caregiver' | null
  name: string | null
  learner_id: string | null
  is_supervisor: boolean
}

// GET /gloss/supervisor/overview (supervisors only)
export interface SupervisorCaregiverRow {
  caregiver_profile_id: string
  name: string
  short_id: string
  countable: number
  demonstrated: number
  retained: number
  practised: number
  pace: { weeks: string[]; demonstrated: number[]; trend: string }
  active_days_this_week: number
  active_days_total: number
  new_demonstrated_this_week: number
  last_active: string | null
  parkinsons: {
    quizzes_completed: number
    questions_answered: number
    symptoms_mastered: number
    symptom_count: number
    average_mastery: number | null
  }
}

export interface SupervisorOverview {
  caregivers: SupervisorCaregiverRow[]
  popup: string[]
}

export interface SupervisorCaregiverDetail extends SupervisorCaregiverRow {
  summary: GlossProgressSummary
}
