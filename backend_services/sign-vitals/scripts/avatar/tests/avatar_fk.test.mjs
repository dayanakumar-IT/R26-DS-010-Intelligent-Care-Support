// node --experimental-strip-types --test tests/
// Proves the 3D signer shows exactly the validated motion: the code-built
// mannequin's joint world positions must match the standard skeleton's
// forward kinematics (lib/rig.mjs, the same FK bake.mjs validates with)
// for the same motion file, within 1 mm.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { normalize } from "../lib/quat.mjs";
import { forwardKinematics } from "../lib/rig.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.resolve(HERE, "../../../../../frontend/src/modules/sign-vitals");
const url = (p) => pathToFileURL(p).href;
const MOTION_DIR = path.join(MODULE, "assets/motion");
const { MannequinRig } = await import(url(path.join(MODULE, "components/avatar/rig/MannequinRig.ts")));
const { samplePose } = await import(url(path.join(MODULE, "components/avatar/rig/AvatarRig.ts")));
const { frameAtTime, playRange } = await import(url(path.join(MODULE, "components/avatar/motionPlayback.ts")));
const THREE = await import(url(path.join(MODULE, "../../../node_modules/three/build/three.module.js")));

const SKELETON = JSON.parse(fs.readFileSync(path.join(MOTION_DIR, "standard_skeleton.json"), "utf8"));
const load = (sign) => JSON.parse(fs.readFileSync(path.join(MOTION_DIR, `${sign}.json`), "utf8"));
const SIGNS = ["hello", "please", "angry", "help", "come", "happy", "water", "nose"];
const TOL_M = 0.001;

test("avatar joints match the validated skeleton's forward kinematics within 1 mm", () => {
  const rig = new MannequinRig(SKELETON.bones);
  const p = new THREE.Vector3();
  let worst = 0, checked = 0;
  for (const sign of SIGNS) {
    const motion = load(sign);
    const n = motion.frames;
    for (const frame of [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1]) {
      rig.applyPose(samplePose(motion, frame));
      // Same file values, normalised (they are stored rounded to 4 decimals).
      const local = Object.fromEntries(Object.entries(motion.bones).map(([b, t]) => [b, normalize(t[frame])]));
      const fk = forwardKinematics(SKELETON, local, motion.hips_position[frame]);
      for (const [name] of SKELETON.bones) {
        rig.boneWorldPosition(name, p);
        const d = Math.hypot(p.x - fk.pos[name][0], p.y - fk.pos[name][1], p.z - fk.pos[name][2]);
        worst = Math.max(worst, d);
        checked++;
        assert.ok(d < TOL_M, `${sign} frame ${frame} ${name}: ${(d * 1000).toFixed(3)} mm`);
      }
    }
  }
  console.log(`  checked ${checked} joint positions on ${SIGNS.length} signs; worst difference ${(worst * 1000).toExponential(2)} mm`);
  rig.dispose();
});

test("every skeleton bone exists on the avatar and every motion bone has a skeleton bone", () => {
  const rig = new MannequinRig(SKELETON.bones);
  const p = new THREE.Vector3();
  for (const [name] of SKELETON.bones) assert.ok(rig.boneWorldPosition(name, p), name);
  const motion = load("hello");
  const names = new Set(SKELETON.bones.map(([n]) => n));
  for (const b of Object.keys(motion.bones)) assert.ok(names.has(b), `motion bone ${b} not in skeleton`);
  rig.dispose();
});

test("all 59 motion files play on the avatar: every frame finite, every bone known", () => {
  const rig = new MannequinRig(SKELETON.bones);
  const names = new Set(SKELETON.bones.map(([n]) => n));
  const p = new THREE.Vector3();
  const files = fs.readdirSync(MOTION_DIR).filter((f) => f.endsWith(".json")
    && !["standard_skeleton.json", "motion_qa.json", "trim_proposals.json"].includes(f));
  assert.equal(files.length, 59);
  for (const f of files) {
    const motion = JSON.parse(fs.readFileSync(path.join(MOTION_DIR, f), "utf8"));
    for (const b of Object.keys(motion.bones)) assert.ok(names.has(b), `${f}: unknown bone ${b}`);
    for (let fr = 0; fr < motion.frames; fr += 0.5) {
      rig.applyPose(samplePose(motion, fr));
      rig.boneWorldPosition("rightIndexDistal", p);
      assert.ok(Number.isFinite(p.x + p.y + p.z), `${f} frame ${fr}`);
    }
  }
  rig.dispose();
});

test("between frames the pose is the slerp of its neighbours", () => {
  const motion = load("please");
  const pose = samplePose(motion, 10.5);
  const [a, b] = [motion.bones.rightLowerArm[10], motion.bones.rightLowerArm[11]];
  const want = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(...a), new THREE.Quaternion(...b), 0.5);
  assert.ok(pose.bones.rightLowerArm.clone().normalize().angleTo(want.normalize()) < 1e-6);
});

test("playback uses the file's own fps and a trimmed range", () => {
  const motion = { frames: 100, fps: 29.97, quality_flags: [] };
  // Frame i plays at i / fps.
  assert.ok(Math.abs(frameAtTime(50 / 29.97, 29.97, [0, 99], true).frame - 50) < 1e-9);
  // One loop lasts frames / fps, then starts again.
  assert.ok(Math.abs(frameAtTime(100 / 29.97 + 1 / 29.97, 29.97, [0, 99], true).frame - 1) < 1e-6);
  // Without loop it stops on the last frame.
  assert.deepEqual(frameAtTime(10, 29.97, [0, 99], false), { frame: 99, finished: true });
  // Trims apply only once approved, and never twice.
  const proposal = { frames: 100, proposed_range: [20, 60] };
  assert.deepEqual(playRange(motion, undefined, proposal), [0, 99]);
  assert.deepEqual(playRange(motion, { trim: "rejected" }, proposal), [0, 99]);
  assert.deepEqual(playRange(motion, { trim: "approved" }, proposal), [20, 60]);
  assert.deepEqual(playRange({ ...motion, quality_flags: [{ type: "trimmed" }] }, { trim: "approved" }, proposal), [0, 99]);
  assert.equal(frameAtTime(0, 30, [20, 60], true).frame, 20);
});
