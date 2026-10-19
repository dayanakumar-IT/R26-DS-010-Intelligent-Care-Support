export interface PdeduQuestionChoice {
  symptom_id: string
  label: string
}

export type PdeduQuestionType = 'direct' | 'scenario' | 'comparison'

export interface PdeduNextQuestion {
  question_id: string
  symptom_id: string
  symptom_display_name: string
  symptom_definition: string
  question_type: PdeduQuestionType
  prompt: string
  choices: PdeduQuestionChoice[]
}

export interface PdeduMastery {
  id: string
  caregiver_profile_id: string
  symptom_id: string
  mastery_score: number
  correct_count: number
  incorrect_count: number
  last_answered_at: string | null
}

export interface PdeduResponseResult {
  is_correct: boolean
  correct_symptom_id: string
  extra_fact: string
  mastery: PdeduMastery
  next_question_id: string
}
