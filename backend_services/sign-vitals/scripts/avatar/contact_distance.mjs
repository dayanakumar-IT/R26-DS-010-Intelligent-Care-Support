// Closest distance between the signing hand and the body part the sign
// should touch, on the standard skeleton (baked motion files).
//
//   node contact_distance.mjs
//
// Body targets are fixed points on the standard skeleton (front of chest,
// front of stomach, mouth, nose) or the surface of the head sphere. The hand
// is every right-hand joint plus each fingertip. The skeleton is generic, so
// these are indicative distances, not measurements of the signer.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { forwardKinematics } from "./lib/rig.mjs";
import { rotate } from "./lib/quat.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOTION_DIR = path.resolve(HERE, "../../../../frontend/src/modules/sign-vitals/assets/motion");
const SKELETON = JSON.parse(fs.readFileSync(path.join(MOTION_DIR, "standard_skeleton.json"), "utf8"));
const OFFSET = Object.fromEntries(SKELETON.bones.map(([n, , o]) => [n, o]));

const add = (a, b) => a.map((c, i) => c + b[i]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// target(pos, world) -> { point, radius } in skeleton space (metres; +Z = front of the body).
const HEAD = (pos, world) => add(pos.head, rotate(world.head, [0, 0.08, 0]));
const TARGETS = {
  please: ["front of chest", (p, w) => ({ point: add(p.upperChest, rotate(w.upperChest, [0, 0.04, 0.1])), radius: 0 })],
  sorry: ["front of chest", (p, w) => ({ point: add(p.upperChest, rotate(w.upperChest, [0, 0.04, 0.1])), radius: 0 })],
  stomach: ["front of stomach", (p, w) => ({ point: add(p.spine, rotate(w.spine, [0, 0.0, 0.12])), radius: 0 })],
  mouth: ["mouth", (p, w) => ({ point: add(HEAD(p, w), rotate(w.head, [0, -0.05, 0.09])), radius: 0 })],
  nose: ["nose tip", (p, w) => ({ point: add(HEAD(p, w), rotate(w.head, [0, 0.0, 0.1])), radius: 0 })],
  head: ["head surface", (p, w) => ({ point: HEAD(p, w), radius: 0.09 })],
};

function handPoints(pos, world) {
  const pts = Object.keys(pos).filter((b) => b.startsWith("right") && /Hand|Thumb|Index|Middle|Ring|Little/.test(b))
    .map((b) => [b, pos[b]]);
  for (const b of Object.keys(pos).filter((n) => n.startsWith("right") && n.endsWith("Distal"))) {
    pts.push([b.replace("Distal", "Tip"), add(pos[b], rotate(world[b], OFFSET[b].map((c) => c * 0.8)))]);
  }
  return pts;
}

const rows = [];
for (const [sign, [label, target]] of Object.entries(TARGETS)) {
  const m = JSON.parse(fs.readFileSync(path.join(MOTION_DIR, `${sign}.json`), "utf8"));
  let best = { d: Infinity };
  for (let t = 0; t < m.frames; t++) {
    const local = Object.fromEntries(Object.entries(m.bones).map(([b, a]) => [b, a[t]]));
    const { pos, world } = forwardKinematics(SKELETON, local);
    const { point, radius } = target(pos, world);
    for (const [name, p] of handPoints(pos, world)) {
      const d = Math.max(0, dist(p, point) - radius);
      if (d < best.d) best = { d, frame: t, point: name };
    }
  }
  rows.push({ sign, target: label, closest_cm: Math.round(best.d * 1000) / 10, frame: best.frame, by: best.point });
}
console.table(rows);
fs.writeFileSync(path.join(HERE, "extracted", "_contact_distance.json"), JSON.stringify(rows, null, 2));
