// Below this share of frames with a hand detected, the recording itself is
// the likely reason an attempt failed. Fluent signers in the shipped test
// attempts never went below 0.32 (capture_gates.py calibration), so 0.35
// flags only clips where the hands were out of view for most of the time.
export const LOW_HAND_PRESENCE = 0.35

/** A specific camera tip when hand detection was low, else null. */
export function lowHandTip(handPresence: number | null | undefined): string | null {
  if (handPresence == null || handPresence >= LOW_HAND_PRESENCE) return null
  return (
    `Your hands were visible in only ${Math.round(handPresence * 100)}% of the recording — ` +
    'sit further back so your hands stay in the frame, and face the light.'
  )
}
