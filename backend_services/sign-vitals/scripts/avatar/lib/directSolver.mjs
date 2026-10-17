// Comparison solver (NOT the default): turns each bone of the VRM 1.0 rest
// pose so it points where MediaPipe measured that body segment. Arms and
// hands get a full orientation (axis + palm / elbow plane), fingers a swing.
// Same output shape as rig.solveFrame, so bake.mjs can run either.

import { BONES, HAND_BONES, FINGERS, mpToVrm } from "./rig.mjs";
import { IDENTITY, conj, fromMatrix, mul, normalize, rotate, slerp } from "./quat.mjs";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => scale(a, 1 / (len(a) || 1));

// Rotation taking the rest basis (axis aR, secondary nR) onto the target
// basis (axis a, secondary n). Secondaries are made perpendicular first.
function frameRotation(aR, nR, a, n) {
  const basis = (x, y) => {
    const e1 = unit(x);
    const e2 = unit(sub(y, scale(e1, dot3(y, e1))));
    return [e1, e2, cross(e1, e2)];
  };
  const R = basis(aR, nR), Tg = basis(a, n);
  const m = Array(9).fill(0);
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) m[i * 3 + j] += Tg[k][i] * R[k][j];
  return fromMatrix(m);
}

// Shortest rotation taking direction u onto direction v.
function swing(u, v) {
  u = unit(u); v = unit(v);
  const d = dot3(u, v);
  if (d < -0.9999) {
    const axis = unit(Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 1, 0]));
    return [axis[0], axis[1], axis[2], 0];
  }
  const c = cross(u, v);
  return normalize([c[0], c[1], c[2], 1 + d]);
}

const SIDE = {
  right: { s: -1, sh: 12, el: 14, wr: 16, restBend: [0, 1, 0] },
  left: { s: 1, sh: 11, el: 13, wr: 15, restBend: [0, -1, 0] },
};
const PALM_REST = [0, -1, 0];
const FINGER_LM = {
  Thumb: [[1, 2], [2, 3], [3, 4]], Index: [[5, 6], [6, 7], [7, 8]], Middle: [[9, 10], [10, 11], [11, 12]],
  Ring: [[13, 14], [14, 15], [15, 16]], Little: [[17, 18], [18, 19], [19, 20]],
};
const SEGMENTS = (f) => (f === "Thumb" ? ["Metacarpal", "Proximal", "Distal"] : ["Proximal", "Intermediate", "Distal"]);

export function makeDirectSolver(skeleton) {
  const offset = Object.fromEntries(skeleton.bones.map(([n, , o]) => [n, o]));
  const childOf = {};
  for (const [n, p] of skeleton.bones) if (p && !childOf[p]) childOf[p] = n;
  // Rest direction of a bone = towards its child (or its own offset at a tip).
  const restDir = (b) => unit(offset[childOf[b]] ?? offset[b]);
  const lastBend = { right: null, left: null };

  return function solveFrameDirect(frame) {
    const rot = Object.fromEntries(BONES.map((b) => [b, IDENTITY]));
    const P = frame.pose_world.map(mpToVrm);

    // Torso: hips from the hip line, upper chest from the shoulder line; the
    // twist between them is shared by spine, chest and upperChest.
    const up = unit(sub(scale(add(P[11], P[12]), 0.5), scale(add(P[23], P[24]), 0.5)));
    const hipsW = frameRotation([1, 0, 0], [0, 1, 0], sub(P[23], P[24]), up);
    const chestW = frameRotation([1, 0, 0], [0, 1, 0], sub(P[11], P[12]), up);
    rot.hips = hipsW;
    const part = slerp(IDENTITY, mul(conj(hipsW), chestW), 1 / 3);
    rot.spine = rot.chest = rot.upperChest = part;
    const torsoW = mul(mul(mul(hipsW, part), part), part);   // upperChest world; shoulders/neck are identity

    for (const [side, c] of Object.entries(SIDE)) {
      const dU = sub(P[c.el], P[c.sh]);
      const dF = sub(P[c.wr], P[c.el]);
      let bend = cross(unit(dU), unit(dF));
      if (len(bend) < 0.05) bend = lastBend[side] ?? rotate(torsoW, c.restBend);
      bend = unit(bend);
      lastBend[side] = bend;

      const upperW = frameRotation([c.s, 0, 0], c.restBend, dU, bend);
      rot[`${side}UpperArm`] = mul(conj(torsoW), upperW);

      const H = frame[`${side}_hand_world`]?.map(mpToVrm);
      // Palm normal from the hand if seen, else estimated from the elbow plane.
      let palm = side === "right" ? scale(bend, -1) : bend;
      if (H) {
        const v1 = sub(H[5], H[0]), v2 = sub(H[17], H[0]);
        palm = unit(side === "right" ? cross(v1, v2) : cross(v2, v1));
      }
      const lowerW = frameRotation([c.s, 0, 0], PALM_REST, dF, palm);
      rot[`${side}LowerArm`] = mul(conj(upperW), lowerW);

      if (!H) {
        for (const b of HAND_BONES(side)) rot[b] = null;
        continue;
      }
      // Hand axis = wrist -> middle-finger base (not its first child, the thumb).
      const handW = frameRotation(unit(offset[`${side}MiddleProximal`]), PALM_REST, sub(H[9], H[0]), palm);
      rot[`${side}Hand`] = mul(conj(lowerW), handW);
      for (const f of FINGERS) {
        let parentW = handW;
        SEGMENTS(f).forEach((seg, k) => {
          const b = `${side}${f}${seg}`;
          const [i, j] = FINGER_LM[f][k];
          const restW = rotate(parentW, restDir(b));
          const w = mul(swing(restW, sub(H[j], H[i])), parentW);
          rot[b] = mul(conj(parentW), w);
          parentW = w;
        });
      }
    }

    if (frame.face_matrix) {
      const m = frame.face_matrix;
      rot.head = mul(conj(torsoW), fromMatrix([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]));
    } else {
      rot.head = null;
    }

    // "Out of frame" here only flags low wrist visibility; the arm still
    // follows MediaPipe's estimate.
    const vis = (i) => frame.pose_world[i][3];
    return { rot, armOffscreen: { right: vis(16) < 0.23, left: vis(15) < 0.23 } };
  };
}
