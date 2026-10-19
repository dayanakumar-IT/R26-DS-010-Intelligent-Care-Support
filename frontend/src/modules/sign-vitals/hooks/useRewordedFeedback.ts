import { useEffect, useState } from 'react'
import { getGlossAttemptFeedback } from '../services/glossApi'

const POLL_MS = 800
// After this the rule text simply stays (the rewording is optional).
const GIVE_UP_MS = 10000

/**
 * The feedback text to show for an attempt. The result arrives with the
 * rule-based text; when the backend is still rewording it
 * (feedback_pending), this polls for the reworded text and swaps it in once
 * ready, giving up quietly after GIVE_UP_MS.
 */
export function useRewordedFeedback(
  attemptId: string | undefined,
  ruleText: string,
  pending: boolean | undefined,
): { text: string; rewording: boolean } {
  // Outcome of the polling for one attempt: the reworded text, or null when
  // the rule text stays. Set only from the polling callbacks.
  const [done, setDone] = useState<{ id: string; text: string | null } | null>(null)
  const active = Boolean(pending && attemptId)

  useEffect(() => {
    if (!active || !attemptId) return
    let stopped = false
    const started = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (text: string | null) => {
      if (!stopped) setDone({ id: attemptId, text })
    }

    const poll = async () => {
      try {
        const update = await getGlossAttemptFeedback(attemptId)
        if (stopped) return
        if (update.status === 'ready' && update.summary) return finish(update.summary)
        if (update.status === 'unchanged') return finish(null)
      } catch {
        // Network hiccup: keep the rule text and try again until the timeout.
      }
      if (stopped) return
      if (Date.now() - started >= GIVE_UP_MS) return finish(null)
      timer = setTimeout(poll, POLL_MS)
    }
    timer = setTimeout(poll, POLL_MS)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [active, attemptId])

  const mine = done && done.id === attemptId ? done : null
  return { text: mine?.text ?? ruleText, rewording: active && !mine }
}
