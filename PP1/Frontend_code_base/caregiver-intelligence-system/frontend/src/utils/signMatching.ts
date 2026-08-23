/**
 * Rule-based sign tutoring prototype (not clinical / linguistics certification).
 * Uses MediaPipe Hands-style 21 landmarks (normalized 0–1, origin top-left).
 */

export type TutorSignId = 'HELP' | 'THANK YOU' | 'EAT' | 'DRINK'

export type Landmark = { x: number; y: number; z: number }

export type SignFeedbackAxis = {
  handShape: { ok: boolean; tip: string }
  handPosition: { ok: boolean; tip: string }
  movementPath: { ok: boolean; tip: string }
  holdTime: { ok: boolean; tip: string }
}

export type SignMatchResult = {
  score: number
  correct: boolean
  feedback: SignFeedbackAxis
}

const WRIST = 0
const THUMB_TIP = 4
const INDEX_MCP = 5
const INDEX_TIP = 8
const MIDDLE_MCP = 9
const MIDDLE_TIP = 12
const RING_TIP = 16
const PINKY_TIP = 20

function dist(a: Landmark, b: Landmark) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function spreadOpen(landmarks: Landmark[]) {
  return dist(landmarks[THUMB_TIP], landmarks[INDEX_MCP])
}

function pinchGap(landmarks: Landmark[]) {
  return dist(landmarks[THUMB_TIP], landmarks[INDEX_TIP])
}

function fingerExtension(landmarks: Landmark[]) {
  const tips = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
  const baseY = landmarks[WRIST].y
  let sum = 0
  for (const t of tips) {
    sum += Math.abs(landmarks[t].y - baseY)
  }
  return sum / 4
}

function wristHeight(landmarks: Landmark[]) {
  return landmarks[WRIST].y
}

function lateralCenterOffset(landmarks: Landmark[]) {
  return Math.abs(landmarks[WRIST].x - 0.5)
}

export type WristSample = { x: number; y: number; t: number }

function meanDeltaY(history: WristSample[], windowMs = 450) {
  if (history.length < 2) return 0
  const last = history[history.length - 1]!.t
  const slice = history.filter((h) => last - h.t <= windowMs)
  if (slice.length < 2) return 0
  const dy = slice[slice.length - 1]!.y - slice[0]!.y
  return dy
}

function stableHoldScore(history: WristSample[], windowMs = 600, eps = 0.03) {
  if (history.length < 3) return 0
  const lastT = history[history.length - 1]!.t
  const recent = history.filter((h) => lastT - h.t <= windowMs)
  if (recent.length < 3) return 0
  let maxSpan = 0
  let run = 0
  for (let i = 1; i < recent.length; i++) {
    const d = Math.hypot(recent[i]!.x - recent[i - 1]!.x, recent[i]!.y - recent[i - 1]!.y)
    if (d < eps) {
      run += 1
      maxSpan = Math.max(maxSpan, run)
    } else {
      run = 0
    }
  }
  return Math.min(100, (maxSpan / recent.length) * 150)
}

function normalizeTarget(sign: string): TutorSignId | null {
  const u = sign.trim().toUpperCase()
  if (u === 'HELP') return 'HELP'
  if (u === 'THANK YOU' || u === 'THANKYOU') return 'THANK YOU'
  if (u === 'EAT') return 'EAT'
  if (u === 'DRINK') return 'DRINK'
  return null
}

export function matchSignPrototype(
  targetSign: string,
  landmarks: Landmark[] | null | undefined,
  wristHistory: WristSample[],
): SignMatchResult {
  const target = normalizeTarget(targetSign)
  const fb = (partial: Partial<SignFeedbackAxis>): SignFeedbackAxis => ({
    handShape: partial.handShape ?? { ok: false, tip: 'Open your palm wider' },
    handPosition: partial.handPosition ?? { ok: false, tip: 'Move hand slightly higher' },
    movementPath: partial.movementPath ?? { ok: false, tip: 'Trace a smoother arc' },
    holdTime: partial.holdTime ?? { ok: false, tip: 'Hold the final position longer' },
  })

  if (!target || !landmarks || landmarks.length < 21) {
    return {
      score: 0,
      correct: false,
      feedback: fb({
        handShape: { ok: false, tip: 'Fully open your hand toward the camera.' },
        handPosition: { ok: false, tip: 'Center your hand in the frame.' },
        movementPath: { ok: false, tip: 'Bring your hand into view steadily.' },
        holdTime: { ok: false, tip: 'Hold steady for one full breath.' },
      }),
    }
  }

  const spread = spreadOpen(landmarks)
  const pinch = pinchGap(landmarks)
  const extend = fingerExtension(landmarks)
  const wy = wristHeight(landmarks)
  const center = lateralCenterOffset(landmarks)
  const dy = meanDeltaY(wristHistory)
  const hold = stableHoldScore(wristHistory)

  let score = 0
  let movementOk = false
  let shapeOk = false
  let posOk = false
  let holdOk = false

  switch (target) {
    case 'HELP': {
      shapeOk = spread > 0.1 && pinch > 0.08
      posOk = wy > 0.35 && wy < 0.72 && center < 0.28
      movementOk = dy < -0.012
      holdOk = hold > 35
      score =
        (shapeOk ? 28 : 10) +
        (posOk ? 26 : 10) +
        (movementOk ? 24 : 8) +
        (holdOk ? 22 : 6)
      break
    }
    case 'THANK YOU': {
      shapeOk = spread > 0.06 && extend > 0.06
      posOk = wy < 0.52 && center < 0.22
      movementOk = Math.abs(dy) > 0.008
      holdOk = hold > 25
      score =
        (shapeOk ? 28 : 10) +
        (posOk ? 30 : 12) +
        (movementOk ? 24 : 8) +
        (holdOk ? 18 : 8)
      break
    }
    case 'EAT': {
      shapeOk = pinch < 0.07
      posOk = wy < 0.55 && wy > 0.25
      movementOk = Math.abs(dy) < 0.06
      holdOk = hold > 30
      score =
        (shapeOk ? 32 : 10) +
        (posOk ? 30 : 12) +
        (movementOk ? 18 : 8) +
        (holdOk ? 20 : 10)
      break
    }
    case 'DRINK': {
      const cup = dist(landmarks[THUMB_TIP], landmarks[MIDDLE_MCP])
      shapeOk = pinch > 0.04 && pinch < 0.16 && cup > 0.05
      posOk = wy < 0.58 && wy > 0.22 && center < 0.35
      movementOk = dy < 0.02
      holdOk = hold > 28
      score =
        (shapeOk ? 30 : 12) +
        (posOk ? 28 : 12) +
        (movementOk ? 22 : 8) +
        (holdOk ? 20 : 10)
      break
    }
    default:
      break
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const correct = score >= 68

  const axis: SignFeedbackAxis = {
    handShape: {
      ok: shapeOk,
      tip: shapeOk ? 'Finger spread looks tutor-aligned.' : 'Open your palm wider before finishing.',
    },
    handPosition: {
      ok: posOk,
      tip: posOk ? 'Height and centering are in a good band.' : 'Move hand slightly higher toward the torso or chin cue.',
    },
    movementPath: {
      ok: movementOk,
      tip: movementOk ? 'Movement direction is readable.' : 'Trace the tutor arc more deliberately — slow the lift.',
    },
    holdTime: {
      ok: holdOk,
      tip: holdOk ? 'Hold feels long enough for a caregiver read.' : 'Hold the final position longer (1 slow breath).',
    },
  }

  return { score, correct, feedback: axis }
}
