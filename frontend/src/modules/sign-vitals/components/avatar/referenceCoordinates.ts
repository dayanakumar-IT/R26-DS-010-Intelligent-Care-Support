import * as THREE from 'three'
import type { GlossLandmark } from '../../types/gloss'

/**
 * referenceCoordinates.ts
 * GLOSS component — GLOSS normalized reference coordinates -> Three.js
 * world coordinates.
 *
 * EMPIRICALLY VERIFIED against live gloss_sign_references rows (hello,
 * water, pain, help, tired), not assumed:
 *
 *   x: by construction of the backend's normalize_sequence(),
 *      left_shoulder.x is exactly -0.5 and right_shoulder.x is exactly
 *      +0.5 on every single frame of every sign. Negative x = the side
 *      labelled "left", positive x = the side labelled "right" — this
 *      already matches Three.js's +x = right convention directly.
 *      No flip needed.
 *
 *   y: averaged across all 5 inspected signs, nose.y is consistently
 *      strongly positive (+0.6 to +0.8) while elbow/wrist.y are
 *      consistently negative (chest/waist-level positions pull the
 *      average down, elbows less so than wrists). This means
 *      positive y = up, matching Three.js's default +y = up directly.
 *      No flip needed.
 *
 *   z: shoulder.z ~= 0 by construction (translation-centered), but
 *      nose.z is a very large, physically implausible -1.3 to -2.0
 *      shoulder-widths on every sign — a known MediaPipe limitation:
 *      the POSE model's z is calibrated far less reliably than x/y,
 *      and far less reliably than the HAND model's z (which is
 *      computed relative to that hand's own wrist and stays locally
 *      consistent). Upper-body pose z (nose/shoulders/elbows/wrists)
 *      is therefore DAMPED here rather than trusted at full
 *      magnitude or discarded outright. Hand landmarks are NOT
 *      damped — see toHandVector3 below and avatarRigMapper.ts's
 *      notes on how the hand root is placed using the pose wrist
 *      (damped, for a seamless arm connection) while finger
 *      articulation is computed from the hand's OWN wrist landmark
 *      (undamped, locally consistent).
 *
 * This is ONE stable, explicit mapping applied identically to every
 * frame. Reference sequences are already fully normalized by GLOSS's
 * backend preprocessing — this module must NEVER re-center or
 * re-scale per frame (see avatarAnimation.ts).
 */

// Pose-landmark z is unreliable (see docstring above) — damp it heavily
// rather than trust it at full scale or drop it entirely, so subtle
// forward/back lean isn't lost without letting nose's implausible depth
// value distort the avatar.
const POSE_Z_DAMPING = 0.15

export function toPoseVector3(landmark: GlossLandmark): THREE.Vector3 {
  return new THREE.Vector3(landmark.x, landmark.y, landmark.z * POSE_Z_DAMPING)
}

// Hand landmarks keep full z — MediaPipe's hand-model z is computed
// relative to that hand's own wrist and is locally consistent, unlike
// pose z's calibration against a shoulder-centered origin.
export function toHandVector3(landmark: GlossLandmark): THREE.Vector3 {
  return new THREE.Vector3(landmark.x, landmark.y, landmark.z)
}
