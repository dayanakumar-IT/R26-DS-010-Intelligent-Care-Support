// node --test tests/
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  IDENTITY, angleDeg, eulerXYZToQuat, fromMatrix, rotate, slerp, smoothZeroPhase, vrm0ToVrm1,
} from "../lib/quat.mjs";
import { fillGaps } from "../lib/gaps.mjs";
import { forwardKinematics, solveFrame } from "../lib/rig.mjs";
import { makeDirectSolver } from "../lib/directSolver.mjs";
import { makeJointLimiter } from "../lib/jointLimits.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKELETON = JSON.parse(fs.readFileSync(
  path.resolve(HERE, "../../../../../frontend/src/modules/sign-vitals/assets/motion/standard_skeleton.json"), "utf8"));

const S = Math.SQRT1_2;
const close = (a, b, tol = 1e-4) => a.every((v, i) => Math.abs(v - b[i]) < tol);
const unit = (v) => { const n = Math.hypot(...v); return v.map((c) => c / n); };
const angleBetween = (u, v) => (Math.acos(Math.max(-1, Math.min(1,
  unit(u).reduce((s, c, i) => s + c * unit(v)[i], 0)))) * 180) / Math.PI;

test("Euler XYZ -> quaternion matches the three.js convention", () => {
  assert.ok(close(eulerXYZToQuat({ x: Math.PI / 2 }), [S, 0, 0, S]));
  assert.ok(close(eulerXYZToQuat({ y: Math.PI / 2 }), [0, S, 0, S]));
  assert.ok(close(eulerXYZToQuat({ z: -Math.PI / 2 }), [0, 0, -S, S]));
  assert.ok(close(eulerXYZToQuat({}), IDENTITY));
});

test("right arm raised: VRM 0.x z=+90° -> VRM 1.0 quaternion (0,0,-0.7071,0.7071), arm points up", () => {
  // VRM 0.x: character faces -Z, right arm rests along +X; raising it is +90° about Z.
  const q1 = vrm0ToVrm1(eulerXYZToQuat({ z: Math.PI / 2 }));
  assert.ok(close(q1, [0, 0, -S, S]));
  // VRM 1.0: right arm rests along -X; the same rotation must point it up (+Y).
  assert.ok(close(rotate(q1, [-1, 0, 0]), [0, 1, 0]));
});

test("left arm raised: VRM 0.x z=-90° -> VRM 1.0 (0,0,0.7071,0.7071), arm points up", () => {
  const q1 = vrm0ToVrm1(eulerXYZToQuat({ z: -Math.PI / 2 }));
  assert.ok(close(q1, [0, 0, S, S]));
  assert.ok(close(rotate(q1, [1, 0, 0]), [0, 1, 0]));
});

test("matrix -> quaternion round trip", () => {
  const q = eulerXYZToQuat({ x: 0.3, y: -0.8, z: 1.1 });
  const ex = rotate(q, [1, 0, 0]), ey = rotate(q, [0, 1, 0]), ez = rotate(q, [0, 0, 1]);
  const m = [ex[0], ey[0], ez[0], ex[1], ey[1], ez[1], ex[2], ey[2], ez[2]];
  assert.ok(angleDeg(fromMatrix(m), q) < 1e-3);
});

test("gaps: <= 5 frames are slerped, longer gaps and edges are held", () => {
  const a = IDENTITY, b = eulerXYZToQuat({ z: 1 });
  const short = fillGaps([a, null, null, null, null, null, b]);
  assert.deepEqual(short.held, []);
  assert.ok(angleDeg(short.seq[3], slerp(a, b, 0.5)) < 1e-3);
  const long = fillGaps([null, a, null, null, null, null, null, null, b]);
  assert.deepEqual(long.held, [[0, 0], [2, 7]]);
  assert.deepEqual(long.seq[5], a);
  assert.equal(fillGaps([null, null]).never, true);
});

test("zero-phase smoothing keeps the timing of a movement peak", () => {
  const angles = Array.from({ length: 61 }, (_, i) => Math.exp(-((i - 30) ** 2) / 40) + (i % 2 ? 0.03 : -0.03));
  const seq = angles.map((z) => eulerXYZToQuat({ z }));
  const smooth = smoothZeroPhase(seq, 0.5);
  const peak = (s) => s.reduce((best, q, i) => (angleDeg(q, IDENTITY) > angleDeg(s[best], IDENTITY) ? i : best), 0);
  assert.equal(peak(smooth), 30);
});

test("joint limits: in-range rotations untouched, out-of-range clamped and reported", () => {
  const limit = makeJointLimiter(SKELETON);
  const deg = (d) => (d * Math.PI) / 180;
  // Right elbow bends forward = rotation about +Y (forearm -X swings to +Z).
  const elbow = (d) => eulerXYZToQuat({ y: deg(d) });
  const ok = limit({ rightLowerArm: elbow(90) });
  assert.deepEqual(ok.limited, []);
  const over = limit({ rightLowerArm: elbow(170) });
  assert.deepEqual(over.limited, ["rightLowerArm"]);
  const forearm = rotate(over.rot.rightLowerArm, [-1, 0, 0]);
  assert.ok(Math.abs(angleBetween(forearm, [-1, 0, 0]) - 150) < 0.5, "elbow clamped to 150°");

  // Right index knuckle: flexion = towards the palm (-Y) = rotation about +Z.
  const bentBack = limit({ rightIndexProximal: eulerXYZToQuat({ z: deg(-50) }) });
  assert.deepEqual(bentBack.limited, ["rightIndexProximal"]);
  const dir = rotate(bentBack.rot.rightIndexProximal, [-1, 0, 0]);
  assert.ok(Math.abs(angleBetween(dir, [-1, 0, 0]) - 30) < 0.5, "knuckle hyperextension clamped to 30°");
  assert.deepEqual(limit({ rightIndexProximal: eulerXYZToQuat({ z: deg(80) }) }).limited, []);
  // Middle finger joint: total bend capped at 115°, any direction.
  const folded = limit({ rightIndexIntermediate: eulerXYZToQuat({ z: deg(140) }) });
  assert.deepEqual(folded.limited, ["rightIndexIntermediate"]);
  assert.ok(Math.abs(angleBetween(rotate(folded.rot.rightIndexIntermediate, [-1, 0, 0]), [-1, 0, 0]) - 115) < 0.5);
  assert.deepEqual(limit({ rightIndexIntermediate: eulerXYZToQuat({ z: deg(80) }) }).limited, []);

  // Head turned 120° (beyond 85°) is limited; a 30° turn is not.
  assert.deepEqual(limit({ head: eulerXYZToQuat({ y: deg(120) }) }).limited, ["head"]);
  assert.deepEqual(limit({ head: eulerXYZToQuat({ y: deg(30) }) }).limited, []);
});

// Synthetic MediaPipe frame: signer facing the camera, RIGHT arm straight up,
// left arm hanging. MediaPipe world axes: x = image right, y down, z away.
// The signer's right side is on the image's left (x < 0).
function syntheticFrame() {
  const world = Array.from({ length: 33 }, () => [0, -0.6, 0, 0.99]);
  const set = (i, x, y, z = 0) => { world[i] = [x, y, z, 0.99]; };
  set(11, 0.18, -0.45); set(12, -0.18, -0.45);           // shoulders (L, R)
  set(23, 0.1, 0); set(24, -0.1, 0);                     // hips
  set(14, -0.18, -0.73); set(16, -0.18, -1.0);           // right elbow, wrist: straight up
  set(18, -0.19, -1.08); set(20, -0.17, -1.09); set(22, -0.2, -1.04);
  set(13, 0.2, -0.17); set(15, 0.2, 0.05);               // left arm hanging
  set(17, 0.21, 0.12); set(19, 0.19, 0.13); set(21, 0.22, 0.09);
  set(25, 0.1, 0.4); set(26, -0.1, 0.4);
  const image = world.map(([x, y, z, v]) => [0.5 + x * 0.6, 0.75 + y * 0.6, z, v]);
  return { pose: image, pose_world: world, left_hand_world: null, right_hand_world: null, face_matrix: null };
}

// The tolerance checks sides and conventions, not solver accuracy: kalidokit's
// own arm heuristics (scale factors and clamps in rigArm) cannot reach a
// vertical arm and land ~41° short, so it only has to point clearly upward on
// the correct side. The direct solver must be exact.
for (const [name, solve, tol] of [
  ["kalidokit", (f) => solveFrame(f, { width: 640, height: 480 }), 45],
  ["direct", makeDirectSolver(SKELETON), 3],
]) {
  test(`${name}: signer's right arm up -> avatar's right arm up, on the character's right (-X)`, () => {
    const { rot } = solve(syntheticFrame());
    const { pos } = forwardKinematics(SKELETON, rot);
    const upper = pos.rightLowerArm.map((c, i) => c - pos.rightUpperArm[i]);
    assert.ok(pos.rightHand[0] < 0, "right hand must be on the character's right (-X)");
    assert.ok(pos.rightHand[1] > pos.rightUpperArm[1] + 0.3, "right hand must be well above the shoulder");
    assert.ok(pos.leftHand[1] < pos.leftUpperArm[1], "left arm should not be raised");
    assert.ok(angleBetween(upper, [0, 1, 0]) < tol, `right upper arm ${angleBetween(upper, [0, 1, 0]).toFixed(1)}° from up`);
  });
}
