// Parkinson's Symptom Trainer — types for the gamified caregiver
// tutoring feature. EDUCATION ONLY: symptom-recognition training, not
// a diagnostic tool. Kept separate from the GLOSS types in gloss.ts
// and from the older adaptive-quiz types in pdedu.ts.

export type PkQuestionFormat = 'text' | 'video'

export interface PkChoice {
  symptom_id: string
  label: string
}

export interface PkQuizQuestion {
  question_id: string
  format: PkQuestionFormat
  question_type: string
  prompt: string
  choices: PkChoice[]
  has_video: boolean
}

export interface PkQuizStart {
  session_id: string
  total_questions: number
  questions: PkQuizQuestion[]
}

export interface PkAnswerResult {
  is_correct: boolean
  correct_symptom_id: string
  correct_answer: string
  explanation: string
  tip: string | null
  memory_trick: string | null
  xp_awarded: number
  current_streak: number
  best_streak: number
  answered: number
  correct_answers: number
  xp_earned: number
  mastery_score: number
}

export interface PkSymptomBreakdown {
  symptom_id: string
  display_name: string
  total: number
  correct: number
  accuracy_pct: number
}

export interface PkReviewItem {
  question_id: string
  format: PkQuestionFormat
  prompt: string
  your_answer: string
  correct_answer: string
  correct_symptom_id: string
  explanation: string
  tip: string | null
  memory_trick: string | null
}

export interface PkBadge {
  id: string
  label: string
}

export interface PkQuizSummary {
  session_id: string
  total_questions: number
  answered: number
  correct_answers: number
  accuracy_pct: number
  xp_earned: number
  best_streak: number
  symptom_breakdown: PkSymptomBreakdown[]
  strongest: PkSymptomBreakdown[]
  needs_review: PkSymptomBreakdown[]
  badges: PkBadge[]
  review: PkReviewItem[]
}

export interface PkSymptom {
  symptom_id: string
  display_name: string
  definition: string
  learning_tip: string | null
  memory_trick: string | null
  display_order: number | null
  has_video: boolean
}

export interface PkDemoVideo {
  symptom_id?: string
  video_url: string
  duration_seconds: number | null
  url_expires_in: number | null
}

export interface PkSymptomProgress {
  symptom_id: string
  display_name: string
  definition: string
  learning_tip: string | null
  memory_trick: string | null
  attempts: number
  correct: number
  accuracy_pct: number
  last_practiced_at: string | null
}

export interface PkProgress {
  quizzes_completed: number
  total_questions_answered: number
  overall_accuracy_pct: number
  total_xp: number
  best_streak: number
  symptom_progress: PkSymptomProgress[]
  strongest_symptoms: string[]
  weakest_symptoms: string[]
  has_activity: boolean
}

export interface PkHistorySession {
  session_id: string
  date: string
  correct_answers: number
  total_questions: number
  accuracy_pct: number
  xp_earned: number
  best_streak: number
}
