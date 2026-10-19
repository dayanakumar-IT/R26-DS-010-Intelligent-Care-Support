// A relaxed arm (VRM 1.0 normalized local rotations): upper arm down by the
// side, elbow a little bent forward, hand in line with the forearm, fingers
// softly curled. Used when a hand is not seen at the start or end of a clip.

import { HAND_BONES } from "./rig.mjs";
import { IDENTITY, eulerXYZToQuat, slerp } from "./quat.mjs";

const rad = (d) => (d * Math.PI) / 180;
export const EASE_FRAMES = 12; // ~0.4 s at 30 fps

export function restPose(side) {
  const s = side === "right" ? 1 : -1; // mirror the angles for the left arm
  const pose = {
    [`${side}UpperArm`]: eulerXYZToQuat({ z: rad(70 * s) }), // T-pose arm turned down
    [`${side}LowerArm`]: eulerXYZToQuat({ y: rad(30 * s) }), // forearm a little forward
  };
  for (const b of HAND_BONES(side)) {
    pose[b] = /Thumb|Hand$/.test(b) ? IDENTITY : eulerXYZToQuat({ z: rad(15 * s) }); // curl towards the palm
  }
  return pose;
}

/**
 * Eases one arm into the rest pose at the start and end of the clip where
 * MediaPipe is only guessing it: the hand is not detected AND the wrist is
 * out of view (low visibility). An arm that is visible keeps following the
 * video, even when its hand was not detected. The pose blends from the
 * solved rotation to rest over EASE_FRAMES, then holds rest; the middle of
 * the clip is left alone. seqs: {bone: [quat per frame]} (gap-filled).
 * seen / offscreen: per-frame booleans. Returns the eased frame ranges.
 */
export function easeArmToRest(seqs, side, seen, offscreen) {
  const rest = restPose(side);
  const T = seen.length;
  const guessed = seen.map((s, t) => !s && offscreen[t]);
  let lead = 0;
  while (lead < T && guessed[lead]) lead++;          // frames [0, lead) are guessed
  let trail = T - 1;
  while (trail >= lead && guessed[trail]) trail--;    // frames (trail, T-1] are guessed
  const weight = (t) => (lead === T ? 1 : t < lead ? Math.min(1, (lead - t) / EASE_FRAMES)
    : t > trail ? Math.min(1, (t - trail) / EASE_FRAMES) : 0);
  const neverSeen = !seen.includes(true); // no hand data at all: fingers simply rest
  for (const [b, q] of Object.entries(rest)) {
    const handBone = !/Arm$/.test(b);
    seqs[b] = seqs[b].map((v, t) => (neverSeen && handBone ? q : weight(t) > 0 ? slerp(v, q, weight(t)) : v));
  }
  const ranges = [];
  if (lead > 0) ranges.push([0, lead - 1]);
  if (trail < T - 1 && trail + 1 >= lead) ranges.push([trail + 1, T - 1]);
  return ranges;
}
