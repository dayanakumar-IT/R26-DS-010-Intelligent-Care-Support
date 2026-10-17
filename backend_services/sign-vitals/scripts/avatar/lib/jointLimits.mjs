// Anatomical joint limits for the direct solver's local rotations (VRM 1.0
// normalized space, rest = T-pose, palms down).
//
// Each limited joint is described by its bone axis `a` (rest direction
// towards the child), a flexion direction `n` and side axis b = a x n. A
// local rotation is split into twist (about a) and swing (where a ends up).
// Where the local frame is anatomically meaningful (torso, head, elbow, wrist
// and the knuckles, all built from the palm / elbow plane) the swing is
// measured as flexion (towards n) and sideways bend (towards b). The finger
// and thumb segments beyond the knuckle are chained by shortest swings, so
// their frames drift and "sideways" is not measurable there: those get a cone
// (maximum total bend) instead. Values outside a range are clamped and the
// bone is reported as limited. Upper arms (ball joints) and hips are not limited.

import { mul, normalize, rotate } from "./quat.mjs";

const D = Math.PI / 180;
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function swingTo(u, v) {
  const d = dot(u, v);
  if (d < -0.9999) return [0, 0, 1, 0];
  const c = cross(u, v);
  return normalize([c[0], c[1], c[2], 1 + d]);
}

// Degrees. flex = towards n (negative = the other way), side = towards b,
// twist about a; cone = maximum total bend (for segments without a reliable frame).
const FINGER = {
  Proximal: { flex: [-30, 100], side: [-40, 40], twist: [-20, 20] },
  Intermediate: { cone: 115, twist: [-20, 20] },
  Distal: { cone: 90, twist: [-20, 20] },
};
const THUMB = {
  Metacarpal: { cone: 75, twist: [-45, 45] },
  Proximal: { cone: 80, twist: [-30, 30] },
  Distal: { cone: 90, twist: [-20, 20] },
};
const UP = [0, 1, 0], FWD = [0, 0, 1], PALM = [0, -1, 0];

export function makeJointLimiter(skeleton) {
  const offset = Object.fromEntries(skeleton.bones.map(([n, , o]) => [n, o]));
  const children = {};
  for (const [n, p] of skeleton.bones) if (p) (children[p] ??= []).push(n);
  const restDir = (b) => unit(offset[children[b]?.[0]] ?? offset[b]);

  const joints = {};
  for (const name of ["spine", "chest", "upperChest"]) {
    joints[name] = { a: UP, n: FWD, flex: [-20, 30], side: [-20, 20], twist: [-25, 25] };
  }
  joints.neck = { a: UP, n: FWD, flex: [-30, 40], side: [-30, 30], twist: [-50, 50] };
  joints.head = { a: UP, n: FWD, flex: [-60, 70], side: [-45, 45], twist: [-85, 85] };
  for (const s of ["left", "right"]) {
    const axis = s === "right" ? [-1, 0, 0] : [1, 0, 0];
    // Elbow bends forward (+Z) from the T-pose; forearm twist allows palm-down to palm-up.
    joints[`${s}LowerArm`] = { a: axis, n: FWD, flex: [-5, 150], side: [-15, 15], twist: [-170, 170] };
    // Wrist: flexion towards the palm, extension away; twist lives in the forearm.
    joints[`${s}Hand`] = { a: unit(offset[`${s}MiddleProximal`]), n: PALM, flex: [-70, 80], side: [-35, 35], twist: [-30, 30] };
    for (const f of ["Index", "Middle", "Ring", "Little"]) {
      for (const [seg, lim] of Object.entries(FINGER)) joints[`${s}${f}${seg}`] = { a: restDir(`${s}${f}${seg}`), n: PALM, ...lim };
    }
    for (const [seg, lim] of Object.entries(THUMB)) joints[`${s}Thumb${seg}`] = { a: restDir(`${s}Thumb${seg}`), n: PALM, ...lim };
  }
  for (const j of Object.values(joints)) {
    // Make n perpendicular to a, then b completes the frame (unused by cone joints).
    j.n = unit(j.n.map((c, i) => c - dot(j.n, j.a) * j.a[i]));
    j.b = cross(j.a, j.n);
  }

  /** rot: {bone: quat | null}. Returns { rot, limited: [bone names clamped this frame] }. */
  function limit(rot) {
    const out = { ...rot };
    const limited = [];
    for (const [bone, j] of Object.entries(joints)) {
      const q = rot[bone];
      if (!q) continue;
      // twist about a, swing = q * twist^-1
      const p = dot([q[0], q[1], q[2]], j.a);
      let twist = normalize([j.a[0] * p, j.a[1] * p, j.a[2] * p, q[3]]);
      const swing = mul(q, [-twist[0], -twist[1], -twist[2], twist[3]]);
      let tw = 2 * Math.atan2(dot([twist[0], twist[1], twist[2]], j.a), twist[3]);
      if (tw > Math.PI) tw -= 2 * Math.PI;
      if (tw < -Math.PI) tw += 2 * Math.PI;

      const d = rotate(swing, j.a);
      const ct = clamp(tw, j.twist[0] * D, j.twist[1] * D);
      let d2 = d;
      let swingChanged = false;
      if (j.cone !== undefined) {
        const bend = Math.acos(clamp(dot(d, j.a), -1, 1));
        if (bend > j.cone * D) {
          const perp = unit(d.map((c, i) => c - dot(d, j.a) * j.a[i]));
          d2 = unit(j.a.map((c, i) => Math.cos(j.cone * D) * c + Math.sin(j.cone * D) * perp[i]));
          swingChanged = true;
        }
      } else {
        const flex = Math.atan2(dot(d, j.n), dot(d, j.a));
        const side = Math.asin(clamp(dot(d, j.b), -1, 1));
        const cf = clamp(flex, j.flex[0] * D, j.flex[1] * D);
        const cs = clamp(side, j.side[0] * D, j.side[1] * D);
        if (cf !== flex || cs !== side) {
          const along = j.a.map((c, i) => Math.cos(cf) * c + Math.sin(cf) * j.n[i]);
          d2 = unit(along.map((c, i) => Math.cos(cs) * c + Math.sin(cs) * j.b[i]));
          swingChanged = true;
        }
      }
      if (!swingChanged && ct === tw) continue;
      twist = [j.a[0] * Math.sin(ct / 2), j.a[1] * Math.sin(ct / 2), j.a[2] * Math.sin(ct / 2), Math.cos(ct / 2)];
      out[bone] = normalize(mul(swingTo(j.a, d2), twist));
      limited.push(bone);
    }
    return { rot: out, limited };
  }
  limit.table = joints; // the limits, for documentation / reports
  return limit;
}
