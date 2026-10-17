// Supervisors' daily team popup: shown once per day per supervisor in this
// browser (a per-viewer convenience; storage may be unavailable).

const key = (userKey: string) => `gloss-team-popup:${userKey}:${new Date().toLocaleDateString('en-CA')}`

/** True if this supervisor has not seen today's popup yet. */
export function shouldShowTeamPopup(userKey: string): boolean {
  try {
    return localStorage.getItem(key(userKey)) === null
  } catch {
    return true
  }
}

export function markTeamPopupSeen(userKey: string) {
  try {
    localStorage.setItem(key(userKey), '1')
  } catch {
    /* private window: the popup may show again; harmless */
  }
}
