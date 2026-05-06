// Shared skeletal scenario engine — used by EventReplayTab and PatientDetailPanel

export const FALL_SITUATIONS = [
  'Waking up from bed and losing balance',
  'Sliding while getting off the bed',
  'Standing up too quickly after sleep',
  'Falling beside the bed',
  'Failed attempt to sit on a chair',
  'Difficulty standing up from a chair',
  'Chair slipping incidents',
  'Unsteady walking',
  'Slow unstable walking',
  'Sudden stumbling while walking',
  'Losing balance while turning',
  'Dragging or weak leg movement',
  'Standing still but swaying',
  'Excessive body leaning while standing',
  'Losing balance while reaching for objects',
  'Sudden collapse to the floor',
  'Sideways fall',
  'Forward fall',
  'Backward fall',
  'Drowsy unstable walking at night',
  'Confused or disoriented movement after waking up',
  'Unstable sit-to-stand transitions',
  'Unstable stand-to-sit transitions',
  'Sudden uncontrolled posture transitions',
  'Repeated balance correction movements',
  'Gradual increase in instability while walking or standing',
  'Near-fall recovery situations',
  'Partial body occlusion causing unstable movement detection',
  'Low-confidence pose detection due to camera limitations',
  'Sudden body tilt or imbalance during movement',
  'Abnormal gait or irregular walking pattern',
  'Rapid downward body movement indicating possible fall',
  'Loss of balance during posture change',
  'Instability during bedside movement',
  'Unsafe movement in walking zones',
  'Prolonged imbalance while standing',
  'Abnormal movement speed or acceleration',
  'Body sway during walking or standing',
  'Unexpected collapse after standing up',
]

export const SCENARIO_CATEGORIES = [
  'Bed Event', 'Chair Transfer', 'Walking Instability',
  'Standing Imbalance', 'Sudden Onset', 'Night / Confusion',
]
export const SCENARIO_COLORS = ['#7C3AED', '#1E3A8A', '#2563EB', '#14B8A6', '#EF4444', '#475569']
export const SCENARIO_ICONS  = ['🛏', '🪑', '🚶', '⚖', '⚡', '🌙']

// Normal activity labels per scenario (shown when patient is low risk)
export const SCENARIO_NORMAL_LABELS = [
  'Resting in bed', 'Seated — stable', 'Walking normally',
  'Standing — stable', 'Normal activity', 'Resting at night',
]

export interface Frame {
  t: number
  tilt: number
  swayX: number
  swayY: number
  risk: number
  confidence: number
  speed: number
  unstable: string[]
  stage: string
  stageLabel: string
  stageColor: string
  baseJoints?: Record<string, [number, number]>
}

interface PhaseSpec {
  stage: string; stageLabel: string; stageColor: string; frames: number
  tilt: [number, number]; swayX: [number, number]; swayY: [number, number]
  risk: [number, number]; conf: [number, number]; speed: [number, number]
  unstable: string[]
  baseJoints?: Record<string, [number, number]>
}

const JN:  string[] = []
const JA   = ['lAnkle', 'rAnkle']
const JKA  = ['lKnee', 'rKnee', 'lAnkle', 'rAnkle']
const JL   = ['lKnee', 'rKnee', 'lHip', 'rHip', 'torso', 'lAnkle', 'rAnkle']
const JT   = ['torso']
const JHT  = ['lHip', 'rHip', 'torso']
const JAL  = ['lKnee', 'rKnee', 'lHip', 'rHip', 'torso', 'lAnkle', 'rAnkle', 'lShoulder', 'rShoulder', 'neck']

// ── Scenario-specific base poses ──────────────────────────────────────────────
// Horizontal figure lying in bed (head left, feet right).
// At tilt=0° this looks flat; as tilt increases toward 90° the figure naturally rises to standing.
const LYING_JOINTS: Record<string, [number, number]> = {
  head: [14, 50], neck: [24, 50],
  lShoulder: [34, 44], rShoulder: [34, 56],
  lElbow: [48, 40], rElbow: [48, 60],
  lWrist: [60, 38], rWrist: [60, 62],
  torso: [50, 50],
  lHip: [64, 44], rHip: [64, 56],
  lKnee: [76, 44], rKnee: [76, 56],
  lAnkle: [88, 44], rAnkle: [88, 56],
}
// Sitting at bed edge — upright torso, legs hanging down.
const BED_SITTING_JOINTS: Record<string, [number, number]> = {
  head: [50, 10], neck: [50, 20],
  lShoulder: [37, 28], rShoulder: [63, 28],
  lElbow: [30, 42], rElbow: [70, 42],
  lWrist: [26, 54], rWrist: [74, 54],
  torso: [50, 46],
  lHip: [41, 58], rHip: [59, 58],
  lKnee: [38, 74], rKnee: [62, 74],
  lAnkle: [36, 90], rAnkle: [64, 90],
}
// Seated in chair — upright torso, knees bent at 90°.
const SEATED_JOINTS: Record<string, [number, number]> = {
  head: [50, 8], neck: [50, 18],
  lShoulder: [36, 26], rShoulder: [64, 26],
  lElbow: [29, 40], rElbow: [71, 40],
  lWrist: [25, 52], rWrist: [75, 52],
  torso: [50, 46],
  lHip: [39, 56], rHip: [61, 56],
  lKnee: [34, 74], rKnee: [66, 74],
  lAnkle: [30, 92], rAnkle: [70, 92],
}
// Mid-stride walking — left leg forward, right leg back, arms in counter-swing.
const WALKING_JOINTS: Record<string, [number, number]> = {
  head: [49, 9], neck: [49, 19],
  lShoulder: [35, 27], rShoulder: [64, 27],
  lElbow: [27, 40], rElbow: [73, 40],
  lWrist: [21, 53], rWrist: [79, 53],
  torso: [50, 44],
  lHip: [43, 56], rHip: [58, 56],
  lKnee: [46, 69], rKnee: [55, 73],
  lAnkle: [48, 86], rAnkle: [53, 92],
}
// Night shuffling gait — slightly hunched, short slow steps.
const NIGHT_WALK_JOINTS: Record<string, [number, number]> = {
  head: [50, 12], neck: [50, 22],
  lShoulder: [37, 31], rShoulder: [63, 31],
  lElbow: [31, 44], rElbow: [69, 44],
  lWrist: [27, 56], rWrist: [73, 56],
  torso: [50, 48],
  lHip: [43, 59], rHip: [57, 59],
  lKnee: [45, 73], rKnee: [56, 75],
  lAnkle: [44, 89], rAnkle: [57, 91],
}

const SCENARIOS: PhaseSpec[][] = [
  // 0: BED_RISE — waking / getting up from bed
  [
    { stage:'normal',   stageLabel:'Lying in Bed',        stageColor:'#14B8A6', frames:8,
      tilt:[20,23], swayX:[0,3],   swayY:[0,-1],  risk:[35,40], conf:[0.92,0.91], speed:[0.08,0.10], unstable:JN,
      baseJoints: LYING_JOINTS },
    { stage:'early',    stageLabel:'Sitting Up — Unstable', stageColor:'#F59E0B', frames:9,
      tilt:[23,32], swayX:[3,10],  swayY:[-1,-3], risk:[40,60], conf:[0.91,0.84], speed:[0.10,0.24], unstable:JA,
      baseJoints: BED_SITTING_JOINTS },
    { stage:'high',     stageLabel:'RISK: Losing Balance', stageColor:'#EF4444', frames:7,
      tilt:[32,42], swayX:[10,18], swayY:[-3,-6], risk:[60,82], conf:[0.84,0.74], speed:[0.24,0.46], unstable:JL },
    { stage:'critical', stageLabel:'⚠ NEAR FALL',          stageColor:'#EF4444', frames:6,
      tilt:[42,46], swayX:[18,24], swayY:[-6,-8], risk:[82,96], conf:[0.74,0.66], speed:[0.46,0.62], unstable:JAL },
    { stage:'recovery', stageLabel:'Regaining Stability',  stageColor:'#F59E0B', frames:10,
      tilt:[46,10], swayX:[24,4],  swayY:[-8,0],  risk:[96,55], conf:[0.66,0.88], speed:[0.62,0.16], unstable:JKA,
      baseJoints: BED_SITTING_JOINTS },
  ],
  // 1: CHAIR_STAND — chair-to-stand transfer
  [
    { stage:'normal',   stageLabel:'Seated in Chair',        stageColor:'#14B8A6', frames:8,
      tilt:[15,18], swayX:[0,4],   swayY:[0,-1],  risk:[32,38], conf:[0.93,0.92], speed:[0.06,0.09], unstable:JN,
      baseJoints: SEATED_JOINTS },
    { stage:'early',    stageLabel:'Rising — Knee Strain',   stageColor:'#F59E0B', frames:9,
      tilt:[18,28], swayX:[4,12],  swayY:[-1,-3], risk:[38,60], conf:[0.92,0.83], speed:[0.09,0.26], unstable:JKA,
      baseJoints: SEATED_JOINTS },
    { stage:'high',     stageLabel:'RISK: Transfer Failing',  stageColor:'#EF4444', frames:7,
      tilt:[28,38], swayX:[12,20], swayY:[-3,-6], risk:[60,80], conf:[0.83,0.74], speed:[0.26,0.46], unstable:JL },
    { stage:'critical', stageLabel:'⚠ FORWARD FALL RISK',    stageColor:'#EF4444', frames:6,
      tilt:[38,44], swayX:[20,22], swayY:[-6,-8], risk:[80,94], conf:[0.74,0.67], speed:[0.46,0.58], unstable:JAL },
    { stage:'recovery', stageLabel:'Sitting Back — Stable',  stageColor:'#F59E0B', frames:10,
      tilt:[44,12], swayX:[22,5],  swayY:[-8,0],  risk:[94,56], conf:[0.67,0.87], speed:[0.58,0.16], unstable:JKA,
      baseJoints: SEATED_JOINTS },
  ],
  // 2: WALKING_STUMBLE — gait instability / stumbling
  [
    { stage:'normal',   stageLabel:'Normal Walking',         stageColor:'#14B8A6', frames:8,
      tilt:[3,5],   swayX:[6,10],  swayY:[0,0],   risk:[30,36], conf:[0.93,0.92], speed:[0.22,0.26], unstable:JN,
      baseJoints: WALKING_JOINTS },
    { stage:'early',    stageLabel:'Gait Irregularity',      stageColor:'#F59E0B', frames:9,
      tilt:[5,10],  swayX:[10,16], swayY:[0,-2],  risk:[36,56], conf:[0.92,0.86], speed:[0.26,0.32], unstable:JA,
      baseJoints: WALKING_JOINTS },
    { stage:'high',     stageLabel:'RISK: Stumbling',        stageColor:'#EF4444', frames:7,
      tilt:[10,18], swayX:[16,24], swayY:[-2,-5], risk:[56,78], conf:[0.86,0.76], speed:[0.32,0.50], unstable:JKA,
      baseJoints: WALKING_JOINTS },
    { stage:'critical', stageLabel:'⚠ BALANCE LOST',         stageColor:'#EF4444', frames:6,
      tilt:[18,24], swayX:[24,28], swayY:[-5,-8], risk:[78,94], conf:[0.76,0.66], speed:[0.50,0.64], unstable:JAL,
      baseJoints: WALKING_JOINTS },
    { stage:'recovery', stageLabel:'Stopping & Stabilising', stageColor:'#F59E0B', frames:10,
      tilt:[24,5],  swayX:[28,6],  swayY:[-8,0],  risk:[94,52], conf:[0.66,0.89], speed:[0.64,0.18], unstable:JA,
      baseJoints: WALKING_JOINTS },
  ],
  // 3: STANDING_SWAY — prolonged imbalance while standing
  [
    { stage:'normal',   stageLabel:'Standing — Normal',      stageColor:'#14B8A6', frames:8,
      tilt:[2,3],   swayX:[1,4],   swayY:[0,0],   risk:[28,34], conf:[0.94,0.93], speed:[0.04,0.08], unstable:JN },
    { stage:'early',    stageLabel:'Body Sway Detected',     stageColor:'#F59E0B', frames:9,
      tilt:[3,8],   swayX:[4,12],  swayY:[0,-1],  risk:[34,56], conf:[0.93,0.86], speed:[0.08,0.22], unstable:JA },
    { stage:'high',     stageLabel:'RISK: Sway Escalating',  stageColor:'#EF4444', frames:7,
      tilt:[8,15],  swayX:[12,18], swayY:[-1,-4], risk:[56,78], conf:[0.86,0.77], speed:[0.22,0.40], unstable:JL },
    { stage:'critical', stageLabel:'⚠ PROLONGED IMBALANCE', stageColor:'#EF4444', frames:6,
      tilt:[15,22], swayX:[18,26], swayY:[-4,-6], risk:[78,95], conf:[0.77,0.65], speed:[0.40,0.62], unstable:JAL },
    { stage:'recovery', stageLabel:'Support Gained',         stageColor:'#14B8A6', frames:10,
      tilt:[22,3],  swayX:[26,3],  swayY:[-6,0],  risk:[95,42], conf:[0.65,0.91], speed:[0.62,0.10], unstable:JHT },
  ],
  // 4: SUDDEN_COLLAPSE — rapid onset fall
  [
    { stage:'normal',   stageLabel:'Normal Activity',        stageColor:'#14B8A6', frames:8,
      tilt:[2,2],   swayX:[0,1],   swayY:[0,0],   risk:[28,30], conf:[0.95,0.95], speed:[0.04,0.04], unstable:JN },
    { stage:'early',    stageLabel:'Brief Early Sign',       stageColor:'#F59E0B', frames:9,
      tilt:[2,5],   swayX:[1,5],   swayY:[0,-1],  risk:[30,44], conf:[0.95,0.91], speed:[0.04,0.12], unstable:JT },
    { stage:'high',     stageLabel:'RISK: SUDDEN ONSET',    stageColor:'#EF4444', frames:7,
      tilt:[5,36],  swayX:[5,24],  swayY:[-1,-8], risk:[44,92], conf:[0.91,0.65], speed:[0.12,0.70], unstable:JL },
    { stage:'critical', stageLabel:'⚠ RAPID COLLAPSE',      stageColor:'#EF4444', frames:6,
      tilt:[36,42], swayX:[24,30], swayY:[-8,-11],risk:[92,98], conf:[0.65,0.60], speed:[0.70,0.76], unstable:JAL },
    { stage:'recovery', stageLabel:'Slow Recovery',          stageColor:'#F59E0B', frames:10,
      tilt:[42,8],  swayX:[30,5],  swayY:[-11,0], risk:[98,48], conf:[0.60,0.87], speed:[0.76,0.18], unstable:JL },
  ],
  // 5: NIGHT_CONFUSED — disoriented night movement
  [
    { stage:'normal',   stageLabel:'Night Movement Detected', stageColor:'#14B8A6', frames:8,
      tilt:[4,6],   swayX:[3,8],   swayY:[0,-1],  risk:[33,40], conf:[0.88,0.86], speed:[0.10,0.14], unstable:JN,
      baseJoints: NIGHT_WALK_JOINTS },
    { stage:'early',    stageLabel:'Disoriented Gait',        stageColor:'#F59E0B', frames:9,
      tilt:[6,12],  swayX:[8,16],  swayY:[-1,-3], risk:[40,60], conf:[0.86,0.80], speed:[0.14,0.28], unstable:JA,
      baseJoints: NIGHT_WALK_JOINTS },
    { stage:'high',     stageLabel:'RISK: Confused Movement', stageColor:'#EF4444', frames:7,
      tilt:[12,22], swayX:[16,22], swayY:[-3,-6], risk:[60,80], conf:[0.80,0.71], speed:[0.28,0.46], unstable:JL,
      baseJoints: NIGHT_WALK_JOINTS },
    { stage:'critical', stageLabel:'⚠ DISORIENTATION FALL',  stageColor:'#EF4444', frames:6,
      tilt:[22,28], swayX:[22,26], swayY:[-6,-8], risk:[80,94], conf:[0.71,0.64], speed:[0.46,0.60], unstable:JAL,
      baseJoints: NIGHT_WALK_JOINTS },
    { stage:'recovery', stageLabel:'Alert Triggered',         stageColor:'#14B8A6', frames:10,
      tilt:[28,6],  swayX:[26,4],  swayY:[-8,0],  risk:[94,50], conf:[0.64,0.84], speed:[0.60,0.16], unstable:JKA,
      baseJoints: NIGHT_WALK_JOINTS },
  ],
]

export function expandScenario(phases: PhaseSpec[], dir: number): Frame[] {
  const frames: Frame[] = []
  let t = 0
  for (const phase of phases) {
    for (let i = 0; i < phase.frames; i++) {
      const p = phase.frames <= 1 ? 1 : i / (phase.frames - 1)
      const lerp = (a: number, b: number) => a + (b - a) * p
      const oscAmp = phase.stage === 'critical' ? 2.5 : phase.stage === 'high' ? 1.5 : phase.stage === 'early' ? 0.8 : 0.2
      const osc = Math.sin(frames.length * 0.9) * oscAmp
      frames.push({
        t,
        tilt:       Math.round(lerp(phase.tilt[0],  phase.tilt[1])  + osc * 0.3),
        swayX:      Math.round((lerp(phase.swayX[0], phase.swayX[1]) + osc) * dir),
        swayY:      Math.round(lerp(phase.swayY[0], phase.swayY[1])),
        risk:       Math.round(lerp(phase.risk[0],  phase.risk[1])),
        confidence: parseFloat(lerp(phase.conf[0],  phase.conf[1]).toFixed(2)),
        speed:      parseFloat(lerp(phase.speed[0], phase.speed[1]).toFixed(2)),
        unstable:   [...phase.unstable],
        stage:      phase.stage,
        stageLabel: phase.stageLabel,
        stageColor: phase.stageColor,
        baseJoints: phase.baseJoints,
      })
      t += 100
    }
  }
  return frames
}

export function getPatientScenario(patientId: string) {
  const num = parseInt(patientId.replace(/\D/g, ''))
  const sid = num % 6
  const dir = num % 2 === 0 ? 1 : -1
  return {
    frames:        expandScenario(SCENARIOS[sid], dir),
    situation:     FALL_SITUATIONS[num % 39],
    category:      SCENARIO_CATEGORIES[sid],
    categoryColor: SCENARIO_COLORS[sid],
    icon:          SCENARIO_ICONS[sid],
    scenarioId:    sid,
    normalLabel:   SCENARIO_NORMAL_LABELS[sid],
  }
}

// Phase boundary frame indices (fixed for all scenarios since phase sizes are constant)
export const STAGE_JUMPS = [
  { label: 'Normal',      start: 0,  color: '#14B8A6' },
  { label: 'Early Signs', start: 8,  color: '#F59E0B' },
  { label: 'High Risk',   start: 17, color: '#EF4444' },
  { label: 'Near-Fall',   start: 24, color: '#EF4444' },
  { label: 'Recovery',    start: 30, color: '#F59E0B' },
]

export const BASE_JOINTS: Record<string, [number, number]> = {
  head: [50, 10], neck: [50, 22],
  lShoulder: [34, 30], rShoulder: [66, 30],
  lElbow: [26, 46], rElbow: [74, 46],
  lWrist: [22, 60], rWrist: [78, 60],
  torso: [50, 52],
  lHip: [40, 62], rHip: [60, 62],
  lKnee: [38, 76], rKnee: [62, 76],
  lAnkle: [37, 92], rAnkle: [63, 92],
}

export const BONES: [string, string][] = [
  ['head','neck'], ['neck','lShoulder'], ['neck','rShoulder'],
  ['lShoulder','lElbow'], ['lElbow','lWrist'],
  ['rShoulder','rElbow'], ['rElbow','rWrist'],
  ['neck','torso'], ['torso','lHip'], ['torso','rHip'],
  ['lHip','lKnee'], ['lKnee','lAnkle'],
  ['rHip','rKnee'], ['rKnee','rAnkle'],
]

export const ALL_JOINTS = Object.keys(BASE_JOINTS)

export const JOINT_LABELS: Record<string, string> = {
  head:'Head', neck:'Neck', lShoulder:'L.Shoulder', rShoulder:'R.Shoulder',
  lElbow:'L.Elbow', rElbow:'R.Elbow', lWrist:'L.Wrist', rWrist:'R.Wrist',
  torso:'Torso', lHip:'L.Hip', rHip:'R.Hip', lKnee:'L.Knee', rKnee:'R.Knee',
  lAnkle:'L.Ankle', rAnkle:'R.Ankle',
}

export function computeJoints(frame: Frame, noise: number): Record<string, { x: number; y: number }> {
  const base = frame.baseJoints ?? BASE_JOINTS
  const tiltRad = (frame.tilt * Math.PI) / 180
  const hipX = 50 + frame.swayX * 0.3
  const hipY = 52
  return Object.fromEntries(
    Object.entries(base).map(([name, [bx, by]]) => {
      const dx = bx - 50, dy = by - 52
      const rx = dx * Math.cos(tiltRad) - dy * Math.sin(tiltRad)
      const ry = dx * Math.sin(tiltRad) + dy * Math.cos(tiltRad)
      const jitter = (Math.random() - 0.5) * noise
      return [name, { x: hipX + rx + jitter, y: hipY + ry + frame.swayY * 0.2 + jitter }]
    })
  )
}

// ─── Per-scenario, per-stage live activity descriptions ──────────────────────
// Index matches SCENARIOS array (0=Bed Rise, 1=Chair Stand, 2=Walking, 3=Standing Sway, 4=Sudden Collapse, 5=Night Confused)
export const LIVE_ACTIVITY_DESCRIPTIONS: Record<number, Record<string, string[]>> = {
  0: { // BED_RISE
    normal:   ['Resting in bed — stable', 'Minor position shift', 'Lying still — normal', 'Waking up — calm movement', 'Sitting at bed edge — balanced'],
    early:    ['Attempting to sit up — sway detected', 'Bed edge — balance unstable', 'Rising slowly — caution', 'Unsteady after waking'],
    high:     ['Rising from bed — high lean angle', 'Significant balance loss near bed', 'Unstable standing by bedside', 'Bed-rise near-fall risk'],
    critical: ['⚠ FALLING — bed rise failure', '⚠ Balance lost at bedside', '⚠ Near-fall — bed exit', '⚠ Fall imminent — bedside'],
    recovery: ['Regaining balance — bedside', 'Support found — stabilising', 'Slow recovery from near-fall'],
  },
  1: { // CHAIR_STAND
    normal:   ['Seated in chair — stable', 'Sitting comfortably', 'Minor weight shift — normal', 'Resting in chair'],
    early:    ['Attempting to stand — knee strain', 'Chair transfer — instability', 'Difficulty rising', 'Leaning forward — imbalance'],
    high:     ['Transfer failing — forward lean', 'Chair-to-stand — critical risk', 'Falling forward from chair', 'High-risk stand attempt'],
    critical: ['⚠ FORWARD FALL from chair', '⚠ Chair transfer failure', '⚠ Falling while standing up', '⚠ Chair near-fall'],
    recovery: ['Sitting back — stabilising', 'Catching balance — chair', 'Partial recovery — chair transfer'],
  },
  2: { // WALKING_STUMBLE
    normal:   ['Walking normally — stable gait', 'Steady gait pattern', 'Even walking — no concern', 'Normal pace detected'],
    early:    ['Gait irregularity detected', 'Unsteady walk — foot drag', 'Slow unstable walk', 'Abnormal gait pattern'],
    high:     ['Stumbling — severe instability', 'Balance lost while walking', 'Imminent fall risk — gait failure', 'Walking — rapid deterioration'],
    critical: ['⚠ STUMBLE — FALLING', '⚠ Balance lost — walking fall', '⚠ Tripping — near fall', '⚠ Walking fall detected'],
    recovery: ['Stopping — regaining balance', 'Slowing pace — stabilising', 'Walking steadied'],
  },
  3: { // STANDING_SWAY
    normal:   ['Standing — balanced', 'Static standing — stable', 'Minimal sway — normal', 'Upright — no concern'],
    early:    ['Body sway detected', 'Repeated balance corrections', 'Standing — slight lean', 'Micro-imbalance noted'],
    high:     ['Sway escalating — danger', 'Prolonged imbalance while standing', 'Severe body lean — fall risk', 'Lateral sway — critical'],
    critical: ['⚠ COLLAPSING from standing', '⚠ Balance total failure', '⚠ Standing fall imminent', '⚠ Near-fall — prolonged sway'],
    recovery: ['Support gained — stabilising', 'Sway reducing — recovery', 'Balance slowly restored'],
  },
  4: { // SUDDEN_COLLAPSE
    normal:   ['Normal activity — stable', 'Regular movement — no concern', 'Stable position maintained', 'Calm activity detected'],
    early:    ['Micro-instability noted', 'Brief balance wobble', 'Early warning — monitoring', 'Subtle instability sign'],
    high:     ['Sudden instability onset', 'Rapid risk escalation', 'Unexpected balance loss', 'Quick deterioration detected'],
    critical: ['⚠ SUDDEN COLLAPSE', '⚠ Rapid fall — no prior warning', '⚠ Unexpected fall event', '⚠ Collapse detected'],
    recovery: ['Slow recovery movement', 'Position stabilising slowly', 'Alert sent — attending'],
  },
  5: { // NIGHT_CONFUSED
    normal:   ['Resting at night — stable', 'Night movement — gentle', 'Sleeping — no concern', 'Night rest — stable'],
    early:    ['Confused night movement', 'Disoriented gait — night', 'Night wandering detected', 'Slow confused steps'],
    high:     ['Night fall risk — high', 'Confused — high instability', 'Night wandering — danger zone', 'Disoriented — escalating'],
    critical: ['⚠ NIGHT FALL RISK', '⚠ Disorientation — falling', '⚠ Night fall detected', '⚠ Confused — collapsing'],
    recovery: ['Caregiver notified', 'Alert sent — nighttime event', 'Movement slowing — night'],
  },
}

export function getLiveActivity(scenarioId: number, stage: string): string {
  const pool = LIVE_ACTIVITY_DESCRIPTIONS[scenarioId]?.[stage]
  if (!pool || pool.length === 0) return 'Monitoring patient...'
  return pool[Math.floor(Math.random() * pool.length)]
}
