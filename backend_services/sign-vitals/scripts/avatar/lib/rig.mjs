// MediaPipe frame -> VRM 1.0 normalized local rotations, via kalidokit.
//
// Sides: MediaPipe labels are the signer's own left/right (checked on
// hello/please/angry/help: Holistic's right_hand sits on the pose right
// wrist, which is on the image's left, so the videos are not mirrored).
// kalidokit is built for a mirrored selfie avatar: its "Right" bones are
// computed from MediaPipe's LEFT landmarks in raw camera coordinates. To make
// the avatar copy the signer (right hand -> right hand) we mirror the
// landmarks (x -> -x) and swap left/right before solving.

import { Hand, Pose } from "kalidokit/dist/kalidokit.es.js";
import { IDENTITY, conj, eulerXYZToQuat, fromMatrix, mul, rotate, vrm0ToVrm1 } from "./quat.mjs";

// MediaPipe pose landmark pairs (left, right).
const POSE_PAIRS = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16],
  [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];
const SWAP = Array.from({ length: 33 }, (_, i) => i);
for (const [l, r] of POSE_PAIRS) { SWAP[l] = r; SWAP[r] = l; }

export const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"];
// kalidokit / VRM 0.x finger segment -> VRM 1.0 segment (only the thumb changed).
const SEGMENT_V1 = {
  Thumb: { Proximal: "Metacarpal", Intermediate: "Proximal", Distal: "Distal" },
  Other: { Proximal: "Proximal", Intermediate: "Intermediate", Distal: "Distal" },
};

export const BONES = ["hips", "spine", "chest", "upperChest", "neck", "head"];
for (const s of ["left", "right"]) {
  BONES.push(`${s}Shoulder`, `${s}UpperArm`, `${s}LowerArm`, `${s}Hand`);
  for (const f of FINGERS) {
    for (const seg of Object.values(SEGMENT_V1[f === "Thumb" ? "Thumb" : "Other"])) {
      BONES.push(`${s}${f}${seg}`);
    }
  }
}
export const HAND_BONES = (side) => BONES.filter((b) => b.startsWith(side) && !/Shoulder|UpperArm|LowerArm/.test(b));

const toKP = ([x, y, z, visibility = 1]) => ({ x, y, z, visibility });

// Mirror x and swap sides. Image x is in [0, 1], world x is centred on the hips.
function mirrorPose(pose, isImage) {
  return SWAP.map((src) => {
    const [x, y, z, v] = pose[src];
    return toKP([isImage ? 1 - x : -x, y, z, v]);
  });
}

const v0q = (e, damp = 1) => vrm0ToVrm1(eulerXYZToQuat({ x: e.x * damp, y: e.y * damp, z: e.z * damp }));

// Same rule kalidokit uses to reset an arm it cannot see (applied to the
// mirrored data, so "right" here is the signer's right).
function offscreen(lm3d, lm2d, idx) {
  return lm3d[idx].y > 0.1 || (lm3d[idx].visibility ?? 0) < 0.23 || lm2d[idx].y > 0.995;
}

/**
 * One frame -> { rot: {bone: quat | null}, armOffscreen: {left, right} }.
 * Hand bones are null when that hand was not detected (filled later).
 */
export function solveFrame(frame, imageSize) {
  const rot = Object.fromEntries(BONES.map((b) => [b, IDENTITY]));
  const lm3d = mirrorPose(frame.pose_world, false);
  const lm2d = mirrorPose(frame.pose, true);
  const pose = Pose.solve(lm3d, lm2d, { runtime: "mediapipe", imageSize, enableLegs: false });

  // Torso, with the damping kalidokit's reference demo uses.
  rot.hips = v0q(pose.Hips.rotation, 0.7);
  rot.spine = v0q(pose.Spine, 0.45);
  rot.chest = v0q(pose.Spine, 0.25);
  for (const [side, K] of [["right", "Right"], ["left", "Left"]]) {
    rot[`${side}UpperArm`] = v0q(pose[`${K}UpperArm`]);
    rot[`${side}LowerArm`] = v0q(pose[`${K}LowerArm`]);

    const lms = frame[`${side}_hand_world`];
    if (!lms) {
      for (const b of HAND_BONES(side)) rot[b] = null;
      continue;
    }
    const hand = Hand.solve(lms.map(([x, y, z]) => ({ x: -x, y, z })), K);
    const wrist = hand[`${K}Wrist`];
    rot[`${side}Hand`] = v0q({ x: wrist.x, y: wrist.y, z: pose[`${K}Hand`].z });
    for (const f of FINGERS) {
      const map = SEGMENT_V1[f === "Thumb" ? "Thumb" : "Other"];
      for (const [seg0, seg1] of Object.entries(map)) {
        rot[`${side}${f}${seg1}`] = v0q(hand[`${K}${f}${seg0}`]);
      }
    }
  }

  // Head from the face transformation matrix (camera space: x right, y up,
  // z toward the camera, which matches VRM 1.0 world axes for a character
  // facing the viewer). Store it relative to the torso chain above it.
  if (frame.face_matrix) {
    const m = frame.face_matrix;
    const headWorld = fromMatrix([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
    const parent = mul(mul(mul(rot.hips, rot.spine), rot.chest), mul(rot.upperChest, rot.neck));
    rot.head = mul(conj(parent), headWorld);
  } else {
    rot.head = null;
  }

  return {
    rot,
    armOffscreen: { right: offscreen(lm3d, lm2d, 15), left: offscreen(lm3d, lm2d, 16) },
  };
}

// ---- forward kinematics on the standard skeleton (verification / preview) ----
export function forwardKinematics(skeleton, local, hipsPosition = [0, 0, 0]) {
  const world = {}, pos = {};
  for (const [name, parent, offset] of skeleton.bones) {
    const q = local[name] ?? IDENTITY;
    if (parent === null) {
      world[name] = q;
      pos[name] = offset.map((c, i) => c + hipsPosition[i]);
    } else {
      const o = rotate(world[parent], offset);
      pos[name] = pos[parent].map((c, i) => c + o[i]);
      world[name] = mul(world[parent], q);
    }
  }
  return { world, pos };
}

// MediaPipe world/camera axes (x right, y down, z away) -> VRM 1.0 (x right
// of viewer, y up, z toward viewer) for a character facing the viewer.
export const mpToVrm = ([x, y, z]) => [x, -y, -z];
