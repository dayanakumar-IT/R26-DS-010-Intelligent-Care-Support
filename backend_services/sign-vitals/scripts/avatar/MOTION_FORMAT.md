# GLOSS motion format (`format_version` 1.0)

Avatar-independent motion for the 59 reference signs. Display only: grading
never reads these files.

## Pipeline

1. `colab_find_sources.py` finds each reference's exact source video
   (`reference_sources.json`).
2. `extract_motion.py` (`.venv_avatar`, MediaPipe pinned in
   `requirements-avatar.lock`, models pinned by SHA-256 in
   `model_versions.json`) runs HolisticLandmarker and FaceLandmarker in
   VIDEO mode on the exact frame range → `extracted/<sign>.json.gz`
   (gitignored).
3. `bake.mjs` solves joint rotations with the **direct solver**
   (`lib/directSolver.mjs`: each bone turned to the segment direction
   MediaPipe measured, palm orientation from the hand landmarks, head from the
   face transformation matrix), applies anatomical joint limits
   (`lib/jointLimits.mjs`), fills gaps, smooths →
   `frontend/src/modules/sign-vitals/assets/motion/<sign>.json`.
   The kalidokit 1.1.5 solver is kept for comparison only
   (`--solver=kalidokit` → gitignored `_review/<sign>.kalidokit.json`).
4. Long clips: `propose_trims.py` proposes a motion-file trim; `bake.mjs`
   applies it only once approved on the review page (`motion_qa.json`).

## Coordinate convention: `"vrm1-normalized"`

Rotations follow the VRM 1.0 **normalized humanoid** convention, so any VRM
1.0 avatar can play them by writing each value to
`vrm.humanoid.getNormalizedBoneNode(name).quaternion`:

- rest pose = T-pose, palms down, thumbs forward;
- right-handed, **+Y up**, character **faces +Z**, so the character's right is −X;
- every bone's rest rotation is identity; a value is that bone's **local**
  rotation relative to its parent, as a unit quaternion `[x, y, z, w]`;
- bone names are the VRM 1.0 humanoid names (`hips`, `spine`, `chest`,
  `upperChest`, `neck`, `head`, `leftShoulder` … `rightLittleDistal`; thumbs
  are `thumbMetacarpal` / `thumbProximal` / `thumbDistal`).

**Sides:** the avatar copies the signer. The signer's right hand drives the
avatar's `right*` bones, and a viewer facing the avatar sees that hand on
their left, exactly as in the source video. MediaPipe's left/right labels
are the signer's own sides (checked on hello, please, angry and help: the
right hand sits on the pose right wrist, on the image's left, so the videos
are not mirrored).

### Using a non-VRM rig (e.g. Mixamo)

Map names (`hips`→`mixamorig:Hips`, `leftUpperArm`→`mixamorig:LeftArm`,
`leftLowerArm`→`mixamorig:LeftForeArm`, `leftHand`→`mixamorig:LeftHand`,
`leftIndexProximal`→`mixamorig:LeftHandIndex1`, … `leftThumbMetacarpal`→
`mixamorig:LeftHandThumb1`) and retarget through the rig's own rest pose:
`q_rig = R_rest · q_vrm · R_rest⁻¹`, where `R_rest` is the rig bone's rest
world rotation relative to a T-pose facing +Z. A rig whose bind pose is not
a T-pose (A-pose) must be retargeted, not copied.

## File layout

```jsonc
{
  "sign": "please",
  "fps": 29.9697,                 // the source video's own frame rate
  "frames": 79,
  "format_version": "1.0",
  "convention": "vrm1-normalized",
  "source": { "dataset": "ASL Citizen", "video_id": "asl_citizen_022", "frame_range": [0, 78] },
  "extraction_versions": { "mediapipe": "…", "models": { "<file>": "<sha256>" }, "solver": "…", … },
  "quality_flags": [ { "type": "hand_gap_held", "part": "rightHand", "frames": [0, 13], "note": "…" } ],
  "bones": { "<boneName>": [[x, y, z, w], …] },   // one entry per frame
  "hips_position": [[x, y, z], …],                // metres; currently fixed at the origin
  "blendshapes": { "<mediapipeName>": [v, …] }     // 52 MediaPipe face blendshapes, 0–1
}
```

Frame `i` plays at `i / fps` seconds. Values are rounded to 4 decimals.

- **Timing:** each file keeps its own source fps (29.97–31.11 for the
  pilots); players must use it rather than assuming 30.
- **hips_position** is fixed at the origin: the signer barely moves, and
  MediaPipe's world coordinates are centred on the hips anyway.
- **Blendshapes** keep MediaPipe's original 52 names (`browDownLeft`,
  `jawOpen`, …) and are not mapped to any avatar's expressions yet.

## Quality flags

| type | meaning |
|---|---|
| `hand_never_detected` | no landmarks for that hand in any frame; wrist and fingers stay at the rest pose |
| `hand_gap_held` | hand missing for more than 5 frames (or at a clip edge); nearest rotation held |
| `head_gap_held` | no face transformation matrix; nearest head rotation held |
| `arm_out_of_frame` | wrist visibility low (below frame); the arm follows MediaPipe's estimate |
| `joint_limit_applied` | the measured rotation was outside the anatomical range for that joint group (torso, head, elbow, wrist, fingers) and was clamped |
| `trimmed` | an approved trim was applied; the note gives the source frame range |

### Joint limits

Applied to the direct solver's local rotations before smoothing. Torso
segments, neck, head, elbows, wrists and finger knuckles are limited by
flexion / sideways bend / twist ranges in a frame built from the palm or the
elbow plane; finger and thumb segments beyond the knuckle are limited by a
maximum total bend (their frames are not anatomically fixed). Upper arms and
hips are not limited. See the table in `lib/jointLimits.mjs`.

Gaps of up to 5 frames are filled by slerp and are not flagged.

## Smoothing

Zero-phase smoothing: a slerp exponential filter run forwards and then
backwards (α = 0.5 for the body, 0.65 for hands and fingers, chosen after
comparing 0.5 / 0.65 / 0.8 on all 59 signs), so the filter's lag cancels and movements keep their
timing (unit-tested on a movement peak). Blendshapes use the same scheme on
scalars. Jitter is measured as the mean angle between each frame and the
midpoint of its neighbours, before and after smoothing (see each sign's
`extracted/<sign>.<solver>.bake_report.json`).

## Playback: the 3D Signer

`frontend/src/modules/sign-vitals/components/avatar/`:

- `rig/MannequinRig.ts` builds the default character in code: THREE.Bone
  objects from `standard_skeleton.json` (so values apply with no
  retargeting) and a rounded mannequin fixed rigidly to the bones. Face
  features follow `browDown*`, `browInnerUp`, `eyeBlink*`, `jawOpen`,
  `mouthSmile*` and `mouthFrown*`.
- `rig/AvatarRig.ts` is the interface a character implements, plus
  `samplePose` (slerp between frames, normalised). `rig/FbxAvatarRig.ts`
  is a documented stub for a Mixamo character.
- `SigningAvatar3D.tsx` plays a file at its own fps (0.5× / 0.75× / 1×,
  loop, mirror, limited view turning), applies approved trims, and calls
  `onUnavailable` (the panel shows the 2D guide) if WebGL or loading fails.
- `motionCatalog.ts` decides when it is offered: the default only for signs
  approved in `motion_qa.json`; never for the not-recommended signs;
  `?preview3d=1` shows it for every sign in development builds only.

Checks: `npm test` here includes `tests/avatar_fk.test.mjs` (avatar joint
positions = this skeleton's forward kinematics within 1 mm; all 59 files
play). `preview/` is a dev-only harness (screenshots next to the source
video, frame rate, and `component_check.mjs` for the player's behaviour);
see the comments in `preview/vite.config.mjs`.

## Verification

`bake.mjs` rebuilds the standard skeleton
(`assets/motion/standard_skeleton.json`) by forward kinematics and reports
the angle between each baked bone direction and the same segment measured by
MediaPipe. Single-camera depth is approximate, so this measures agreement
with MediaPipe, not ground-truth accuracy.
