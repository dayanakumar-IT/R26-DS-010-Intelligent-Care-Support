import { apiGet, apiPostFormData } from './apiClient'
import type { GlossAttemptResult, GlossSign, GlossSignReference } from '../types/gloss'

export interface NextLessonResponse {
  next_recommended_sign_id: string
}

export function getNextGlossLesson(): Promise<NextLessonResponse> {
  return apiGet<NextLessonResponse>('/gloss/next-lesson')
}

export async function listGlossSigns(): Promise<GlossSign[]> {
  const result = await apiGet<{ signs: GlossSign[] }>('/gloss/signs')
  return result.signs
}

// Module-level cache for the current page session — avoids loading all 59
// reference sequences up front, and avoids re-fetching a sign the caregiver
// has already viewed (e.g. switching back to a previous recommendation).
const referenceCache = new Map<string, GlossSignReference>()

export async function getGlossSignReference(signId: string): Promise<GlossSignReference> {
  const cached = referenceCache.get(signId)
  if (cached) return cached

  const reference = await apiGet<GlossSignReference>(`/gloss/signs/${encodeURIComponent(signId)}/reference`)
  referenceCache.set(signId, reference)
  return reference
}

// Filename extension should match the blob's actual recorded format (see
// WebcamCapture.tsx's pickSupportedMimeType) — the backend picks its temp
// file's suffix from this filename, defaulting to .mp4 only if empty.
function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('webm')) return 'webm'
  return 'mp4'
}

export function submitWebcamAttempt(
  targetSignId: string,
  videoBlob: Blob,
  sessionId?: string,
): Promise<GlossAttemptResult> {
  const formData = new FormData()
  formData.append('target_sign_id', targetSignId)
  formData.append('attempt_type', 'webcam')
  formData.append('video', videoBlob, `attempt.${extensionForMimeType(videoBlob.type)}`)
  if (sessionId) formData.append('session_id', sessionId)
  return apiPostFormData<GlossAttemptResult>('/gloss/attempts', formData)
}

export function submitMultipleChoiceAttempt(
  targetSignId: string,
  selectedSignId: string,
  sessionId?: string,
): Promise<GlossAttemptResult> {
  const formData = new FormData()
  formData.append('target_sign_id', targetSignId)
  formData.append('attempt_type', 'multiple_choice')
  formData.append('selected_sign_id', selectedSignId)
  if (sessionId) formData.append('session_id', sessionId)
  return apiPostFormData<GlossAttemptResult>('/gloss/attempts', formData)
}
