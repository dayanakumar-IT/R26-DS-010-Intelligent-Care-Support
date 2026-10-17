// Phase 2: extracted/<sign>.json.gz -> motion/<sign>.json
// (VRM 1.0 normalized humanoid local rotations; display only).
//
//   node bake.mjs hello please angry help                     (direct solver -> motion/<sign>.json, committed)
//   node bake.mjs --solver=kalidokit hello please angry help  (evidence -> motion/_review/<sign>.kalidokit.json)
//
// Also writes extracted/<sign>.<solver>.bake_report.json with jitter
// before/after smoothing and the forward-kinematics check against MediaPipe.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

import { BONES, HAND_BONES, forwardKinematics, mpToVrm, solveFrame } from "./lib/rig.mjs";
import { makeDirectSolver } from "./lib/directSolver.mjs";
import { makeJointLimiter } from "./lib/jointLimits.mjs";
import { MAX_SLERP_GAP, fillGaps, runs } from "./lib/gaps.mjs";
import { jitterDeg, makeContinuous, round4, smoothZeroPhase } from "./lib/quat.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOTION_DIR = path.resolve(HERE, "../../../../frontend/src/modules/sign-vitals/assets/motion");
const REVIEW_DIR = path.join(MOTION_DIR, "_review");
const SKELETON = JSON.parse(fs.readFileSync(path.join(MOTION_DIR, "standard_skeleton.json"), "utf8"));
const KALIDOKIT_VERSION = JSON.parse(
  fs.readFileSync(path.join(HERE, "node_modules/kalidokit/package.json"), "utf8")).version;

const FORMAT_VERSION = "1.0";
const SMOOTH_ALPHA = 0.5;         // body rotations
const BLEND_ALPHA = 0.5;          // blendshape scores
// Hands/fingers move faster than the arm, so they get lighter smoothing (chosen
// 0.65 after comparing 0.5 / 0.65 / 0.8 on all 59 signs). --hand-alpha overrides.
const HAND_ALPHA = Number(process.argv.find((a) => a.startsWith("--hand-alpha="))?.split("=")[1] ?? 0.65);

// Joint groups used to report where anatomical limits were applied.
const limitGroup = (bone) =>
  /Thumb|Index|Middle|Ring|Little/.test(bone) ? `${bone.startsWith("left") ? "left" : "right"}Fingers`
    : /LowerArm$/.test(bone) ? bone.replace("LowerArm", "Elbow")
      : /Hand$/.test(bone) ? bone.replace("Hand", "Wrist")
        : /^(spine|chest|upperChest)$/.test(bone) ? "torso" : bone;

const smoothScalars = (vals, alpha) => {
  const pass = (s) => s.reduce((acc, v, i) => (acc.push(i ? acc[i - 1] + alpha * (v - acc[i - 1]) : v), acc), []);
  return pass(pass(vals).reverse()).reverse();
};

// ---------- verification ----------
const sub = (a, b) => a.map((c, i) => c - b[i]);
const angle = (u, v) => {
  const d = u.reduce((s, c, i) => s + c * v[i], 0) / (Math.hypot(...u) * Math.hypot(...v));
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (x) => (x === null ? null : Math.round(x * 10) / 10);

// Angle (degrees) between each baked bone direction (FK on the standard
// skeleton) and the same segment measured by MediaPipe.
function verify(frames, rotSeqs, armOff) {
  const err = {};
  const add = (k, v) => (err[k] ??= []).push(v);
  frames.forEach((fr, t) => {
    const local = Object.fromEntries(BONES.map((b) => [b, rotSeqs[b][t]]));
    const { pos } = forwardKinematics(SKELETON, local);
    const P = fr.pose_world.map(mpToVrm);
    for (const [side, sh, el, wr] of [["right", 12, 14, 16], ["left", 11, 13, 15]]) {
      if (!armOff[side][t]) {
        add(`${side}UpperArm`, angle(sub(pos[`${side}LowerArm`], pos[`${side}UpperArm`]), sub(P[el], P[sh])));
        add(`${side}LowerArm`, angle(sub(pos[`${side}Hand`], pos[`${side}LowerArm`]), sub(P[wr], P[el])));
      }
      const H = fr[`${side}_hand_world`]?.map(mpToVrm);
      if (H) {
        add(`${side}Hand`, angle(sub(pos[`${side}MiddleProximal`], pos[`${side}Hand`]), sub(H[9], H[0])));
        add(`${side}IndexIntermediate`, angle(
          sub(pos[`${side}IndexDistal`], pos[`${side}IndexIntermediate`]), sub(H[7], H[6])));
      }
    }
  });
  return Object.fromEntries(Object.entries(err).map(([k, v]) => [k, { mean_deg: r1(mean(v)), frames: v.length }]));
}

// ---------- bake one sign ----------
// A trim from trim_proposals.json, applied only when approved in motion_qa.json.
function approvedTrim(sign) {
  const read = (f) => (fs.existsSync(path.join(MOTION_DIR, f)) ? JSON.parse(fs.readFileSync(path.join(MOTION_DIR, f), "utf8")) : {});
  const qa = read("motion_qa.json")[sign];
  const proposal = read("trim_proposals.json")[sign];
  return qa?.trim === "approved" && proposal?.proposed_range ? proposal.proposed_range : null;
}

function bake(sign, solver) {
  const ex = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(HERE, "extracted", `${sign}.json.gz`))));
  const trim = approvedTrim(sign);
  if (trim) {
    // Motion file only: keep the approved frames; the grading reference is untouched.
    ex.frames = ex.frames.slice(trim[0], trim[1] + 1);
    const first = ex.source.frame_range[0];
    ex.source.frame_range = [first + trim[0], first + trim[1]];
  }
  const frames = ex.frames;
  const T = frames.length;
  const imageSize = { width: ex.width, height: ex.height };

  const solve = solver === "direct" ? makeDirectSolver(SKELETON) : (fr) => solveFrame(fr, imageSize);
  const limiter = solver === "direct" ? makeJointLimiter(SKELETON) : null;
  const limitedByGroup = {};
  const solved = frames.map((fr, t) => {
    const s = solve(fr);
    if (!limiter) return s;
    const { rot, limited } = limiter(s.rot);
    for (const g of new Set(limited.map(limitGroup))) (limitedByGroup[g] ??= Array(frames.length).fill(false))[t] = true;
    return { ...s, rot };
  });
  const raw = Object.fromEntries(BONES.map((b) => [b, solved.map((s) => s.rot[b])]));
  const armOff = { right: solved.map((s) => s.armOffscreen.right), left: solved.map((s) => s.armOffscreen.left) };
  const flags = [];
  for (const [group, mask] of Object.entries(limitedByGroup)) {
    for (const range of runs(mask)) {
      flags.push({ type: "joint_limit_applied", part: group, frames: range,
        note: "measured rotation was outside the anatomical range and was clamped" });
    }
  }
  const limitedFrames = Object.values(limitedByGroup).reduce(
    (acc, mask) => acc.map((v, i) => v || mask[i]), Array(frames.length).fill(false));

  for (const side of ["left", "right"]) {
    for (const [a, b] of runs(armOff[side])) {
      flags.push({ type: "arm_out_of_frame", part: `${side}Arm`, frames: [a, b],
        note: solver === "direct"
          ? "wrist visibility low; arm follows MediaPipe's estimate"
          : "wrist not visible; kalidokit holds the arm at its resting pose" });
    }
  }

  // Fill hand gaps once per side (all hand bones share the detection mask).
  const filled = {};
  for (const b of BONES) filled[b] = raw[b];
  for (const side of ["left", "right"]) {
    let report = null;
    for (const b of HAND_BONES(side)) {
      const r = fillGaps(raw[b]);
      filled[b] = r.seq;
      report ??= r;
    }
    if (report.never) {
      flags.push({ type: "hand_never_detected", part: `${side}Hand`, frames: [0, T - 1],
        note: "no hand landmarks in any frame; wrist and fingers kept at the rest pose" });
    } else {
      for (const range of report.held) {
        flags.push({ type: "hand_gap_held", part: `${side}Hand`, frames: range,
          note: `hand not detected for more than ${MAX_SLERP_GAP} frames (or at the clip edge); nearest rotation held` });
      }
    }
  }
  const head = fillGaps(raw.head);
  filled.head = head.seq;
  for (const range of head.held) flags.push({ type: "head_gap_held", part: "head", frames: range, note: "no face matrix" });

  // Smooth (zero phase) and measure jitter before / after.
  const final = {};
  const jitter = {};
  const handSet = new Set([...HAND_BONES("left"), ...HAND_BONES("right")]);
  for (const b of BONES) {
    const cont = makeContinuous(filled[b]);
    final[b] = smoothZeroPhase(cont, handSet.has(b) ? HAND_ALPHA : SMOOTH_ALPHA);
    jitter[b] = { before: jitterDeg(cont), after: jitterDeg(final[b]) };
  }
  const moving = BONES.filter((b) => jitter[b].before > 0.05);
  const r2 = (x) => Math.round(x * 100) / 100;
  const jitterSummary = {
    mean_before_deg: r2(mean(moving.map((b) => jitter[b].before))),
    mean_after_deg: r2(mean(moving.map((b) => jitter[b].after))),
    per_bone: Object.fromEntries(moving.map((b) => [b, [Math.round(jitter[b].before * 100) / 100,
      Math.round(jitter[b].after * 100) / 100]])),
  };

  // Blendshapes: keep MediaPipe names, smooth, fill missing frames by holding.
  const names = ex.blendshape_names ?? [];
  const blendshapes = {};
  names.forEach((name, k) => {
    let vals = frames.map((fr) => (fr.blendshapes ? fr.blendshapes[k] : null));
    const known = vals.findIndex((v) => v !== null);
    vals = vals.map((v, i, arr) => v ?? arr.slice(0, i).findLast((x) => x !== null) ?? arr[known] ?? 0);
    blendshapes[name] = round4(smoothScalars(vals, BLEND_ALPHA));
  });

  const motion = {
    sign,
    fps: Math.round(ex.fps * 1e4) / 1e4,
    frames: T,
    format_version: FORMAT_VERSION,
    convention: "vrm1-normalized",
    source: { dataset: ex.source.dataset, video_id: ex.source.video_id, frame_range: ex.source.frame_range },
    extraction_versions: {
      ...ex.extraction_versions,
      models: Object.fromEntries(Object.entries(ex.extraction_versions.models).map(([k, v]) => [k, v.sha256])),
      solver: solver === "direct" ? "direct (segment directions + palm frame)" : `kalidokit ${KALIDOKIT_VERSION}`,
      smoothing: `zero-phase slerp EMA alpha=${SMOOTH_ALPHA} (hands ${HAND_ALPHA}), blendshapes alpha=${BLEND_ALPHA}`,
      gap_fill: `slerp <= ${MAX_SLERP_GAP} frames, else hold`,
    },
    quality_flags: trim
      ? [...flags, { type: "trimmed", part: "clip", frames: [0, T - 1],
          note: `approved trim: source frames ${ex.source.frame_range[0]}-${ex.source.frame_range[1]} of the reference video` }]
      : flags,
    bones: Object.fromEntries(BONES.map((b) => [b, final[b].map(round4)])),
    hips_position: Array.from({ length: T }, () => [0, 0, 0]),
    blendshapes,
  };

  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  // Committed files are direct-solver bakes; kalidokit is kept as comparison evidence only.
  const out = solver === "direct" ? path.join(MOTION_DIR, `${sign}.json`) : path.join(REVIEW_DIR, `${sign}.kalidokit.json`);
  fs.writeFileSync(out, JSON.stringify(motion));
  const report = {
    sign, solver, frames: T, fps: motion.fps, bytes: fs.statSync(out).size,
    joint_limits: limiter ? {
      frames_limited: limitedFrames.filter(Boolean).length,
      by_group: Object.fromEntries(Object.entries(limitedByGroup).map(([g, m]) => [g, m.filter(Boolean).length])),
    } : null,
    jitter: jitterSummary,
    fk_error_raw: verify(frames, Object.fromEntries(BONES.map((b) => [b, makeContinuous(filled[b])])), armOff),
    fk_error_final: verify(frames, final, armOff),
    quality_flags: flags,
  };
  fs.writeFileSync(path.join(HERE, "extracted", `${sign}.${solver}.bake_report.json`), JSON.stringify(report, null, 2));
  return report;
}

const args = process.argv.slice(2);
const solver = args.find((a) => a.startsWith("--solver="))?.split("=")[1] ?? "direct";
const signs = args.filter((a) => !a.startsWith("--"));
if (!signs.length || !["kalidokit", "direct"].includes(solver)) {
  console.error("usage: node bake.mjs [--solver=direct|kalidokit] [--hand-alpha=0.65] <sign> [...]");
  process.exit(1);
}
console.log(`solver: ${solver}`);
for (const sign of signs) {
  const r = bake(sign, solver);
  const e = r.fk_error_final;
  const fmt = (k) => (e[k] ? `${e[k].mean_deg}°` : "–");
  console.log(`${sign.padEnd(7)} ${(r.bytes / 1024).toFixed(1)} KB  jitter ${r.jitter.mean_before_deg}° -> ` +
    `${r.jitter.mean_after_deg}°  FK err R upper/lower/hand/index ${fmt("rightUpperArm")} ${fmt("rightLowerArm")} ` +
    `${fmt("rightHand")} ${fmt("rightIndexIntermediate")} | L ${fmt("leftUpperArm")} ${fmt("leftLowerArm")} ` +
    `${fmt("leftHand")} ${fmt("leftIndexIntermediate")}  flags ${r.quality_flags.length}`);
}
