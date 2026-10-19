import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../../../services/supabaseClient'

/**
 * mirrorView.ts
 * GLOSS component — one "Mirror view" setting shared by the 2D guide, the
 * 3D Signer and the reference video.
 *
 * Mirror view (default): like looking in a mirror — the signer's right hand
 * appears on the learner's right, so the learner copies on the same side.
 * Real view: as another person sees the signer.
 *
 * Display only: it flips what is drawn on screen, never the landmarks used
 * for recognition or grading. Remembered per user in this browser.
 */

const KEY = 'gloss.mirrorView'
let mirror = true
let userId: string | null = null
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((l) => l())
const storageKey = () => `${KEY}.${userId ?? 'signed-out'}`

function load(id: string | null) {
  userId = id
  try {
    mirror = localStorage.getItem(storageKey()) !== '0'
  } catch {
    mirror = true
  }
  notify()
}

let started = false
function start() {
  if (started) return
  started = true
  void supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null))
  supabase.auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null
    if (id !== userId) load(id)
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const MIRROR_LABEL = 'Mirror view: copy as if looking in a mirror'
export const REAL_LABEL = 'Real view: as another person sees the signer'

/** [mirrorView, setMirrorView] — the same value for every view on the page. */
export function useMirrorView(): [boolean, (value: boolean) => void] {
  useEffect(start, [])
  const value = useSyncExternalStore(subscribe, () => mirror, () => true)
  const set = useCallback((next: boolean) => {
    mirror = next
    try {
      localStorage.setItem(storageKey(), next ? '1' : '0')
    } catch {
      /* not remembered in private windows; still applies now */
    }
    notify()
  }, [])
  return [value, set]
}
