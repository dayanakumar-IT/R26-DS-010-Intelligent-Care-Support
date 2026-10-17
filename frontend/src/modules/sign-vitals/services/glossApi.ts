import { apiGet, apiPostFormData } from './apiClient'
import type {
  GlossAttemptResult,
  GlossCaptureRejection,
  GlossAttemptMode,
  GlossDemoVideo,
  GlossFreeResult,
  GlossHistoryEntry,
  GlossProgressReport,
  GlossProgressSummary,
  GlossSign,
  GlossSignReference,
} from '../types/gloss'

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

// Validated human reference video metadata. The URL can be a
// short-lived presigned Cloudflare R2 URL, so successful responses are
// deliberately NOT cached — every call gets a fresh URL. Only the "no
// video" (404) outcome is remembered, to avoid re-hitting the endpoint
// each time the caregiver toggles reference modes. `null` return means
// "fall back to the 2D Sign Guide", not an error.
const noDemoVideoSigns = new Set<string>()

export async function getGlossSignDemoVideo(signId: string): Promise<GlossDemoVideo | null> {
  if (noDemoVideoSigns.has(signId)) return null

  try {
    return await apiGet<GlossDemoVideo>(`/gloss/signs/${encodeURIComponent(signId)}/demo-video`)
  } catch (error) {
    if (
      error instanceof Error &&
      /\(404\)|no usable reference|no reference video|not available/i.test(error.message)
    ) {
      noDemoVideoSigns.add(signId)
      return null
    }
    throw error
  }
}

export function getGlossProgress(): Promise<GlossProgressReport> {
  return apiGet<GlossProgressReport>('/gloss/progress')
}

export async function getGlossHistory(limit = 30): Promise<GlossHistoryEntry[]> {
  return (await getGlossHistoryPage({ limit })).attempts
}

// One page of the practice history, newest first. before: older than this
// attempted_at (load more); start / end: one day only (calendar filter).
export function getGlossHistoryPage(params: {
  limit?: number
  before?: string
  start?: string
  end?: string
}): Promise<{ attempts: GlossHistoryEntry[]; has_more: boolean }> {
  const query = new URLSearchParams({ limit: String(params.limit ?? 30) })
  for (const key of ['before', 'start', 'end'] as const) {
    const value = params[key]
    if (value) query.set(key, value)
  }
  return apiGet<{ attempts: GlossHistoryEntry[]; has_more: boolean }>(`/gloss/history?${query}`)
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
  mode: Exclude<GlossAttemptMode, 'free'> = 'practice',
): Promise<GlossAttemptResult | GlossCaptureRejection> {
  const formData = new FormData()
  formData.append('target_sign_id', targetSignId)
  formData.append('attempt_type', 'webcam')
  formData.append('mode', mode)
  formData.append('video', videoBlob, `attempt.${extensionForMimeType(videoBlob.type)}`)
  if (sessionId) formData.append('session_id', sessionId)
  return apiPostFormData<GlossAttemptResult | GlossCaptureRejection>('/gloss/attempts', formData)
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

// Check my sign: no target; the camera names the sign. Stored with
// mode='free' and never counted toward progress.
export function submitFreeAttempt(
  videoBlob: Blob,
  sessionId?: string,
): Promise<GlossFreeResult | GlossCaptureRejection> {
  const formData = new FormData()
  formData.append('attempt_type', 'webcam')
  formData.append('mode', 'free')
  formData.append('video', videoBlob, `attempt.${extensionForMimeType(videoBlob.type)}`)
  if (sessionId) formData.append('session_id', sessionId)
  return apiPostFormData<GlossFreeResult | GlossCaptureRejection>('/gloss/attempts', formData)
}

export function getGlossProgressSummary(): Promise<GlossProgressSummary> {
  return apiGet<GlossProgressSummary>('/gloss/progress/summary')
}

export function getRecallSign(): Promise<{ sign_id: string }> {
  return apiGet<{ sign_id: string }>('/gloss/recall/next')
}

// The guarded Gemini rewording of an attempt's feedback, which the backend
// finishes after sending the attempt result (feedback_pending: true).
export interface GlossFeedbackUpdate {
  status: 'pending' | 'ready' | 'unchanged'
  summary: string | null
}

export function getGlossAttemptFeedback(attemptId: string): Promise<GlossFeedbackUpdate> {
  return apiGet<GlossFeedbackUpdate>(`/gloss/attempts/${encodeURIComponent(attemptId)}/feedback`)
}

