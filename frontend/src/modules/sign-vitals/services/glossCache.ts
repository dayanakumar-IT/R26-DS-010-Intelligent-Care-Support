// Session-scoped, in-memory response cache for the GLOSS *read* endpoints
// that several tabs share (progress, history, sign catalogue).
//
// This is purely a frontend performance layer:
//   - it calls the SAME glossApi functions,
//   - it returns the SAME response shapes,
//   - it changes no request payload and no backend behaviour.
//
// It adds three things:
//   1. reuse of an already-resolved result (no refetch on tab remount),
//   2. de-duplication of concurrent identical requests (in-flight sharing),
//   3. explicit invalidation of activity-derived data after a successful
//      practice attempt.
//
// Scope: a module-level Map that lives for the browser tab's lifetime and
// holds a handful of fixed keys (bounded). Nothing here participates in
// recognition / DTW / mastery / recommendation logic.

import type { GlossHistoryEntry, GlossProgressReport, GlossSign } from '../types/gloss'
import { getGlossHistory, getGlossProgress, listGlossSigns } from './glossApi'

interface Entry<T> {
  data?: T
  promise?: Promise<T>
}

const store = new Map<string, Entry<unknown>>()

function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined
  if (hit?.promise) return hit.promise
  if (hit && 'data' in hit) return Promise.resolve(hit.data as T)

  const entry: Entry<T> = {}
  entry.promise = fetcher().then(
    (data) => {
      // Only commit if this exact request is still the current one — a
      // concurrent invalidate() or a newer request supersedes it.
      if (store.get(key) === (entry as Entry<unknown>)) store.set(key, { data })
      return data
    },
    (err) => {
      if (store.get(key) === (entry as Entry<unknown>)) store.delete(key)
      throw err
    },
  )
  store.set(key, entry as Entry<unknown>)
  return entry.promise
}

function peek<T>(key: string): T | undefined {
  const hit = store.get(key) as Entry<T> | undefined
  return hit && 'data' in hit ? (hit.data as T) : undefined
}

const K_PROGRESS = 'progress'
const K_SIGNS = 'signs'
const historyKey = (limit: number): string => `history:${limit}`

// ---- Progress (caregiver learning summary) --------------------------------
export function cachedGlossProgress(): Promise<GlossProgressReport> {
  return load(K_PROGRESS, getGlossProgress)
}
export function peekGlossProgress(): GlossProgressReport | undefined {
  return peek(K_PROGRESS)
}

// ---- History (recent attempts) ------------------------------------------
export function cachedGlossHistory(limit = 30): Promise<GlossHistoryEntry[]> {
  return load(historyKey(limit), () => getGlossHistory(limit))
}
export function peekGlossHistory(limit = 30): GlossHistoryEntry[] | undefined {
  return peek(historyKey(limit))
}

// ---- Sign catalogue (static for the session) ---------------------------
export function cachedGlossSigns(): Promise<GlossSign[]> {
  return load(K_SIGNS, listGlossSigns)
}
export function peekGlossSigns(): GlossSign[] | undefined {
  return peek(K_SIGNS)
}

/**
 * Call AFTER a successful practice attempt has been recorded: mastery /
 * history / progress / recommendation may now be different, so drop the
 * activity-derived cached results — the next read refetches fresh. The
 * static sign catalogue is intentionally left cached.
 */
export function invalidateGlossActivity(): void {
  for (const key of [...store.keys()]) {
    if (key === K_PROGRESS || key.startsWith('history:')) store.delete(key)
  }
}
