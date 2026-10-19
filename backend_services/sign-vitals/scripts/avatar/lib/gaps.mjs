import { IDENTITY, slerp } from "./quat.mjs";

export const MAX_SLERP_GAP = 5; // frames

// [first, last] index ranges where mask is true.
export function runs(mask) {
  const out = [];
  let start = null;
  mask.forEach((m, i) => {
    if (m && start === null) start = i;
    if (!m && start !== null) { out.push([start, i - 1]); start = null; }
  });
  if (start !== null) out.push([start, mask.length - 1]);
  return out;
}

// Fill nulls: slerp across interior gaps of up to maxGap frames, hold the
// nearest known rotation otherwise. Returns the filled sequence, the held
// ranges, and whether there was no data at all.
export function fillGaps(seq, maxGap = MAX_SLERP_GAP) {
  if (seq.every((q) => q === null)) return { seq: seq.map(() => IDENTITY), held: [[0, seq.length - 1]], never: true };
  const out = seq.slice();
  const held = [];
  for (const [a, b] of runs(seq.map((q) => q === null))) {
    const before = a > 0 ? out[a - 1] : null;
    const after = b < seq.length - 1 ? seq[b + 1] : null;
    if (before && after && b - a + 1 <= maxGap) {
      for (let i = a; i <= b; i++) out[i] = slerp(before, after, (i - a + 1) / (b - a + 2));
    } else {
      for (let i = a; i <= b; i++) out[i] = before ?? after;
      held.push([a, b]);
    }
  }
  return { seq: out, held, never: false };
}
