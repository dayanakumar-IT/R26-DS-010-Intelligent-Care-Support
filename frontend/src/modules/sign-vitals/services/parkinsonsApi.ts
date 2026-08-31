// Parkinson's Symptom Trainer — API layer. Uses the shared sign-vitals
// apiClient (Supabase bearer auth, VITE_SIGNVITALS_API_URL base). Kept
// separate from glossApi.ts and from the older pdeduApi.ts.

import { apiGet, apiPostJson } from './apiClient'
import type {
  PkDemoVideo,
  PkHistorySession,
  PkProgress,
  PkQuizStart,
  PkQuizSummary,
  PkAnswerResult,
  PkSymptom,
} from '../types/parkinsons'

export function startParkinsonsQuiz(): Promise<PkQuizStart> {
  return apiPostJson<PkQuizStart>('/pdedu/quiz/start', {})
}

export function answerParkinsonsQuestion(
  sessionId: string,
  questionId: string,
  selectedSymptomId: string,
): Promise<PkAnswerResult> {
  return apiPostJson<PkAnswerResult>('/pdedu/quiz/answer', {
    session_id: sessionId,
    question_id: questionId,
    selected_symptom_id: selectedSymptomId,
  })
}

export function completeParkinsonsQuiz(sessionId: string): Promise<PkQuizSummary> {
  return apiPostJson<PkQuizSummary>(`/pdedu/quiz/${sessionId}/complete`, {})
}

export function getParkinsonsSymptoms(): Promise<{ symptoms: PkSymptom[] }> {
  return apiGet<{ symptoms: PkSymptom[] }>('/pdedu/symptoms')
}

export function getParkinsonsProgress(): Promise<PkProgress> {
  return apiGet<PkProgress>('/pdedu/progress')
}

export function getParkinsonsHistory(): Promise<{ sessions: PkHistorySession[] }> {
  return apiGet<{ sessions: PkHistorySession[] }>('/pdedu/history')
}

/** Explore Symptoms — the clip for a known symptom. */
export function getSymptomDemoVideo(symptomId: string): Promise<PkDemoVideo> {
  return apiGet<PkDemoVideo>(`/pdedu/symptoms/${symptomId}/demo-video`)
}

/** In-quiz — the clip for a video question, fetched by question id so
 * the answer (which symptom the clip shows) is never revealed. */
export function getQuestionDemoVideo(questionId: string): Promise<PkDemoVideo> {
  return apiGet<PkDemoVideo>(`/pdedu/quiz/questions/${questionId}/demo-video`)
}
