import type { ElderPose } from '../../../components/signVitals/ElderAvatar'

export type ParkinsonLessonId =
  | 'Resting Tremor'
  | 'Bradykinesia'
  | 'Rigidity'
  | 'Postural Instability'
  | 'Masked Face'

export const PARKINSON_LESSON_ORDER: ParkinsonLessonId[] = [
  'Resting Tremor',
  'Bradykinesia',
  'Rigidity',
  'Postural Instability',
  'Masked Face',
]

export function lessonTitleToElderPose(title: ParkinsonLessonId): ElderPose {
  const map: Record<ParkinsonLessonId, ElderPose> = {
    'Resting Tremor': 'restingTremor',
    Bradykinesia: 'slowMovement',
    Rigidity: 'seated',
    'Postural Instability': 'balanceCue',
    'Masked Face': 'maskedFace',
  }
  return map[title]
}

export type ParkinsonLessonDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export type ParkinsonLessonMeta = {
  difficulty: ParkinsonLessonDifficulty
  minutes: number
  cardTeaser: string
  observeQuestion: string
  observeBullets: string[]
}

export const PARKINSON_LESSON_META: Record<ParkinsonLessonId, ParkinsonLessonMeta> = {
  'Resting Tremor': {
    difficulty: 'Beginner',
    minutes: 6,
    cardTeaser: 'Learn to notice rhythmic movement at rest — a common educational cue in motor observation training.',
    observeQuestion: 'What should the caregiver observe?',
    observeBullets: [
      'Small, rhythmic movement in a relaxed hand, arm, or leg',
      'Whether movement eases when the person begins a purposeful action',
      'Fatigue or stress that may make subtle tremor more noticeable',
    ],
  },
  Bradykinesia: {
    difficulty: 'Beginner',
    minutes: 7,
    cardTeaser: 'Recognize slowness and smaller movements so you can pace care with patience and dignity.',
    observeQuestion: 'What should the caregiver observe?',
    observeBullets: [
      'Slower initiation of everyday actions (standing, reaching, turning)',
      'Reduced size of gestures or steps compared with usual baseline',
      'Need for extra time without rushing — dignity-first pacing',
    ],
  },
  Rigidity: {
    difficulty: 'Intermediate',
    minutes: 8,
    cardTeaser: 'Understand stiffness cues so positioning and transfers stay smooth and reassuring.',
    observeQuestion: 'What should the caregiver observe?',
    observeBullets: [
      'Resistance when gently moving a limb through its range',
      'Whether movement feels smooth or “ratcheting” at the joint',
      'Comfort during dressing or repositioning — avoid abrupt pulls',
    ],
  },
  'Postural Instability': {
    difficulty: 'Intermediate',
    minutes: 9,
    cardTeaser: 'Spot balance and stepping patterns to support safer mobility and calmer turns.',
    observeQuestion: 'What should the caregiver observe?',
    observeBullets: [
      'Slower corrective steps or a wider base when standing or turning',
      'Hesitation at doorways, rugs, or uneven surfaces',
      'Environmental clarity: lighting, clutter-free paths, shoes with grip',
    ],
  },
  'Masked Face': {
    difficulty: 'Advanced',
    minutes: 7,
    cardTeaser: 'Separate reduced facial animation from mood — tune into voice, eyes, and context.',
    observeQuestion: 'What should the caregiver observe?',
    observeBullets: [
      'Less spontaneous smiling or eyebrow movement while content',
      'Blink rate that may be reduced — still check in with tone and touch',
      'Voice softness; allow extra processing time for responses',
    ],
  },
}

export type ParkinsonLessonCopy = {
  bullets: string[]
  caregiver: string
  education: string
}

export const PARKINSON_LESSON_COPY: Record<ParkinsonLessonId, ParkinsonLessonCopy> = {
  'Resting Tremor': {
    bullets: ['Rhythmic oscillation at rest', 'Often improves with voluntary movement', 'May start on one side'],
    caregiver:
      'Offer reassurance, reduce rushing, and adapt utensils or grips for comfort — supportive observation, not alarm.',
    education:
      'Educational visualization only. Symptom recognition supports safer observation; it never replaces diagnosis.',
  },
  Bradykinesia: {
    bullets: ['Slowness of voluntary movement', 'Smaller-amplitude gestures', 'Fatigue may worsen slowness'],
    caregiver: 'Allow extra time for transfers; narrate steps calmly; celebrate small completions to protect dignity.',
    education: 'Pacing cues for caregiving tasks — not a substitute for clinical assessment.',
  },
  Rigidity: {
    bullets: ['Stiffness in limbs or trunk', 'May feel “lead pipe” or ratchet-like'],
    caregiver: 'Warm up joints gently before mobility; use smooth, rhythmic cues instead of abrupt tugs.',
    education: 'Build observational vocabulary to describe what you notice during daily care routines.',
  },
  'Postural Instability': {
    bullets: ['Balance challenges', 'Slower corrective steps', 'Turning may need a wider base'],
    caregiver: 'Clear pathways, night lights, and mindful pivoting during walks — dignity-first fall prevention.',
    education: 'This module tutors hazard awareness; clinicians diagnose and plan treatment.',
  },
  'Masked Face': {
    bullets: ['Reduced facial animation', 'Blinking may lessen', 'Voice may soften'],
    caregiver: 'Use expressive tone and patient pauses — emotion may be felt even when expression is quieter.',
    education: 'Practice recognizing non-verbal flattening as a communication cue, not a mood judgment.',
  },
}

export type ParkinsonQuizQuestion = {
  id: string
  pose: ElderPose
  correct: ParkinsonLessonId
  whyCorrect: string
  observe: string
  confusion: string
}

export const PARKINSON_LESSON_QUIZZES: Record<ParkinsonLessonId, ParkinsonQuizQuestion[]> = {
  'Resting Tremor': [
    {
      id: 'rt-1',
      pose: 'restingTremor',
      correct: 'Resting Tremor',
      whyCorrect: 'Resting tremor typically appears when muscles are relaxed and often eases once purposeful movement begins.',
      observe: 'Watch the hands or limbs when the person is still — small oscillations that smooth out with intentional action.',
      confusion: 'Action tremor worsens during a task; resting tremor is most visible at rest — mix-ups are normal while learning.',
    },
    {
      id: 'rt-2',
      pose: 'restingTremor',
      correct: 'Resting Tremor',
      whyCorrect:
        'The illustration emphasizes subtle oscillation while seated and relaxed — a classic tutoring vignette for this cue.',
      observe: 'Pair what you see with context: seated rest, conversational pause, calm environment.',
      confusion: 'Do not confuse with cold shivering or anxiety alone — correlate with repetition and caregiver history.',
    },
    {
      id: 'rt-3',
      pose: 'maskedFace',
      correct: 'Masked Face',
      whyCorrect:
        'Reduced facial mobility and softer animation match the masked-face vignette rather than locomotor slowness alone.',
      observe: 'Look at eyebrows, spontaneous smiles, and congruence with spoken mood.',
      confusion: 'Many assume “flat mood” — training focuses on expressive range, not emotional judgment.',
    },
    {
      id: 'rt-4',
      pose: 'balanceCue',
      correct: 'Postural Instability',
      whyCorrect: 'Forward-weighted sway and corrective balance posture align with postural instability education.',
      observe: 'Note stepping width when turning and hesitation near thresholds.',
      confusion: 'Rigidity is felt during passive movement; balance issues show while standing — both need different responses.',
    },
  ],
  Bradykinesia: [
    {
      id: 'br-1',
      pose: 'slowMovement',
      correct: 'Bradykinesia',
      whyCorrect:
        'Slow, reduced-amplitude gestures illustrate bradykinesia — pacing care around smaller, deliberate motion.',
      observe: 'Timing to start tasks, completeness of gestures, fatigue later in the day.',
      confusion: 'Slowness from pain or joint issue differs — context and trend matter in tutoring scenarios.',
    },
    {
      id: 'br-2',
      pose: 'slowMovement',
      correct: 'Bradykinesia',
      whyCorrect:
        'Continued sluggish reaching matches bradykinesia vignettes focused on caregiver patience and narration.',
      observe: 'Celebrate micro-successes (“hand is up”) rather than rushing the next step.',
      confusion: 'Do not confuse with simple tiredness alone — instructional modules stack clues across lessons.',
    },
    {
      id: 'br-3',
      pose: 'restingTremor',
      correct: 'Resting Tremor',
      whyCorrect: 'Oscillation at rest is the hallmark of the resting tremor educational example shown here.',
      observe: 'Compare rest vs intentional reach — distinguishing helps you respond calmly.',
      confusion: 'Bradykinesia emphasizes slowness; tremor emphasizes rhythm at rest.',
    },
    {
      id: 'br-4',
      pose: 'seated',
      correct: 'Rigidity',
      whyCorrect: 'Stiffer seated posture cues align with instructional rigidity content — guarded, less fluid trunk motion.',
      observe: 'Gentle, rhythmic prompts during repositioning reduce surprise tension.',
      confusion: 'Balance sway looks like instability; rigidity feels like resistance — both are taught separately.',
    },
  ],
  Rigidity: [
    {
      id: 'rg-1',
      pose: 'seated',
      correct: 'Rigidity',
      whyCorrect: 'The seated figure shows guarded, stiff alignment often used in rigidity tutoring clips.',
      observe: 'Offer warm-up movement before clothing changes; avoid jerky pulls.',
      confusion: 'Instability is about balance; rigidity is about resistance through range — easy to conflate at first.',
    },
    {
      id: 'rg-2',
      pose: 'seated',
      correct: 'Rigidity',
      whyCorrect: 'Repeated stiff shoulder block highlights join stiffness education for caregivers.',
      observe: 'Note expressions of discomfort when movement is rushed.',
      confusion: 'Weakness gives way; rigidity pushes back smoothly or in steps — practice describing both.',
    },
    {
      id: 'rg-3',
      pose: 'maskedFace',
      correct: 'Masked Face',
      whyCorrect: 'Lower facial animation distinguishes masked face from axial rigidity in this vignette.',
      observe: 'Pair softer voice cues with expressive caregiver tone.',
      confusion: 'Rigidity affects movement feel; masked face affects expressiveness — multitopic quiz builds fluency.',
    },
    {
      id: 'rg-4',
      pose: 'balanceCue',
      correct: 'Postural Instability',
      whyCorrect: 'Wide corrective stance cues map to instability lessons rather than stiffness alone.',
      observe: 'Support turns with verbal counting and clear walkways.',
      confusion: 'Postural issues look “big picture”; rigidity feels “joint by joint”.',
    },
  ],
  'Postural Instability': [
    {
      id: 'pi-1',
      pose: 'balanceCue',
      correct: 'Postural Instability',
      whyCorrect: 'Corrective sway and wider base embody postural instability modules used in caregiver training.',
      observe: 'Environmental scan: cords, slippers, glare — dignity-first hazard reduction.',
      confusion: 'True vertigo behaves differently — always escalate new sudden symptoms to the clinician.',
    },
    {
      id: 'pi-2',
      pose: 'balanceCue',
      correct: 'Postural Instability',
      whyCorrect: 'Repeated balance stance reinforces recognition before applying mobility coaching tips.',
      observe: 'Cue smaller pivot steps and lighted hallways.',
      confusion: 'Bradykinesia slows initiation; instability affects upright stability — tandem lessons help.',
    },
    {
      id: 'pi-3',
      pose: 'slowMovement',
      correct: 'Bradykinesia',
      whyCorrect: 'Slowness without broad sway aligns with bradykinesia vignette content.',
      observe: 'Match verbal pacing to observable movement speed.',
      confusion: 'Slowness can coexist with imbalance — quizzes isolate one dominant educational label per slide.',
    },
    {
      id: 'pi-4',
      pose: 'maskedFace',
      correct: 'Masked Face',
      whyCorrect:
        'Face-focused illustration centers masked face recognition — orthogonal skill to gait coaching but vital for empathy.',
      observe: 'Maintain warm eye contact while allowing longer processing pauses.',
      confusion: 'Instability ≠ quiet expression — keep lessons distinct for sharper observation.',
    },
  ],
  'Masked Face': [
    {
      id: 'mf-1',
      pose: 'maskedFace',
      correct: 'Masked Face',
      whyCorrect:
        'Softened eyebrows and cheeks match masked hypomimia training — empathy-first, judgment-free tutoring.',
      observe: 'Contrast spoken affect with expressive range; soften your own pacing.',
      confusion: 'Do not infer mood purely from facial stillness — this module trains humble observation.',
    },
    {
      id: 'mf-2',
      pose: 'maskedFace',
      correct: 'Masked Face',
      whyCorrect:
        'Consistent lowered blink rate vignette reinforces the same competency tag for facial observation drills.',
      observe: 'Blink restoration with gentle conversational prompts — no pressure tactics.',
      confusion: 'Stroke-like asymmetry warrants urgent care — escalate when cues are abrupt or one-sided weakness appears.',
    },
    {
      id: 'mf-3',
      pose: 'slowMovement',
      correct: 'Bradykinesia',
      whyCorrect:
        'This frame centers limb slowness for discrimination practice away from purely facial hypotheses.',
      observe: 'Coach micro-step goals (“lift cup halfway”) respecting energy.',
      confusion: 'Many modules blend cues — quizzes reward careful label choice per vignette dominant feature.',
    },
    {
      id: 'mf-4',
      pose: 'restingTremor',
      correct: 'Resting Tremor',
      whyCorrect: 'Quiet oscillations return focus to hallmark resting tremor patterning.',
      observe: 'Log when tremor bothers function vs purely cosmetic noting.',
      confusion: 'Tremor amplitude varies — caregiver notes describe trend, never replace neurology exams.',
    },
  ],
}

export const PARKINSON_QUIZ_OPTIONS: ParkinsonLessonId[] = PARKINSON_LESSON_ORDER

export const PARKINSON_BADGE_LABELS: Record<string, string> = {
  observationExpert: 'Observation Expert',
  quickLearner: 'Quick Learner',
  tremorSpotter: 'Tremor Spotter',
  consistentCaregiver: 'Consistent Caregiver',
}
