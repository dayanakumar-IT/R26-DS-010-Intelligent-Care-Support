import { apiGet, apiPostJson } from './apiClient'
import type { PdeduNextQuestion, PdeduResponseResult } from '../types/pdedu'

export function getNextPdeduQuestion(): Promise<PdeduNextQuestion> {
  return apiGet<PdeduNextQuestion>('/pdedu/next-question')
}

export function submitPdeduResponse(
  questionId: string,
  selectedSymptomId: string,
): Promise<PdeduResponseResult> {
  return apiPostJson<PdeduResponseResult>('/pdedu/responses', {
    question_id: questionId,
    selected_symptom_id: selectedSymptomId,
  })
}
