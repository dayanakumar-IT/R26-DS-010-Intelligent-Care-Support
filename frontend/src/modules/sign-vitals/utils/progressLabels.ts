// One progress vocabulary for every GLOSS screen (audit P0-13 / P0-14).
//
//   Not started  — no attempts on the sign yet
//   Practising   — attempted, not yet demonstrated
//   Demonstrated — 3 strong camera attempts in a row (the backend's
//                  "mastered" rule, unchanged — only the word is new)
//
// The stored mastery_status values (new / learning / improving /
// mastered, plus the retired weak / needs_revision) are only ever shown
// through these labels. Progress is never shown as a percentage: the
// rule is yes/no, and the execution score is a display mapping of the
// DTW tier, not a measured precision.

import type { GlossLastResult, GlossMasteryStatus, GlossQualityTier } from '../types/gloss'

export type ProgressState = 'not_started' | 'practising' | 'demonstrated'

// Fallback when a response doesn't carry strong_needed.
export const STRONG_NEEDED = 3

export function progressState(status: GlossMasteryStatus | null | undefined, attempts = 0): ProgressState {
  if (status === 'mastered') return 'demonstrated'
  if (!status || status === 'new' || attempts === 0) return 'not_started'
  return 'practising'
}

export const PROGRESS_LABEL: Record<ProgressState, string> = {
  not_started: 'Not started',
  practising: 'Practising',
  demonstrated: 'Demonstrated',
}

export function strongInARow(streak: number, needed: number = STRONG_NEEDED): string {
  return `${Math.min(streak, needed)} of ${needed}`
}

export const TIER_LABEL: Record<GlossQualityTier, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Needs work',
}

export const TIER_SENTENCE: Record<GlossQualityTier, string> = {
  strong: 'Your movement closely matched the reference sign.',
  moderate: 'Your movement was close to the reference, with one part to work on.',
  weak: 'Your movement differed noticeably from the reference sign.',
}

export const LAST_RESULT_LABEL: Record<GlossLastResult, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Needs work',
  different_sign: 'Different sign',
  not_recognised: 'Not recognised',
  quiz_correct: 'Quiz: correct',
  quiz_wrong: 'Quiz: wrong',
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Days in the last 7 (today included) with at least one attempt of any
// outcome. Learner-side consistency only — never a breakable streak.
export function activeDaysThisWeek(calendar: ReadonlyArray<{ date: string; attempt_count: number }>): number {
  const practised = new Set(calendar.filter((d) => d.attempt_count > 0).map((d) => d.date))
  const cursor = new Date()
  let days = 0
  for (let i = 0; i < 7; i += 1) {
    if (practised.has(isoDay(cursor))) days += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return days
}
