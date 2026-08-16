import { create } from 'zustand'

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export type SignLesson = {
  id: string
  word: string
  hint: string
}

const SIGN_LESSONS: SignLesson[] = [
  { id: '1', word: 'HELP', hint: 'Open palm on chest, lift upward.' },
  { id: '2', word: 'THANK YOU', hint: 'Flat hand from chin outward.' },
  { id: '3', word: 'EAT', hint: 'Pinch toward mouth.' },
  { id: '4', word: 'DRINK', hint: 'C-shaped hand tipping toward mouth.' },
]

const PARKINSON_LESSONS = [
  'Resting Tremor',
  'Bradykinesia',
  'Rigidity',
  'Postural Instability',
  'Masked Face',
] as const

export type ParkinsonLessonProgressRow = {
  completed: boolean
  bestAccuracy: number
  stars: number
}

type SignVitalsState = {
  lessonIndex: number
  parkinsonLessonIndex: number
  /** Best score & completion per non-verbal lesson (competency tutoring). */
  parkinsonLessonProgress: Record<string, ParkinsonLessonProgressRow>
  gameQuestionIndex: number
  competencyScore: number
  streakDays: number
  rewardPoints: number
  lessonsCompletedWeek: number
  totalLessonsWeek: number
  achievements: Record<string, boolean>
  /** Simulated MediaPipe match quality */
  landmarkMatchCorrect: boolean
  difficulty: Difficulty
  lastRecommendedLesson: string
  resetLessonFeedback: () => void
  nextSignLesson: () => void
  prevSignLesson: () => void
  setLandmarkMatchCorrect: (v: boolean) => void
  completeGameQuestion: (correct: boolean) => void
  nextParkinsonLesson: () => void
  prevParkinsonLesson: () => void
  /** Persists caregiver competency stats for Parkinson module quizzes (gamification). */
  recordParkinsonQuizComplete: (lessonId: string, accuracyPct: number) => void
  addRewardPoints: (n: number) => void
  unlockAchievement: (id: string) => void
  bumpCompetency: (delta: number) => void
}

export const useSignVitalsStore = create<SignVitalsState>((set, get) => ({
  lessonIndex: 0,
  parkinsonLessonIndex: 0,
  parkinsonLessonProgress: {},
  gameQuestionIndex: 0,
  competencyScore: 72,
  streakDays: 4,
  rewardPoints: 1280,
  lessonsCompletedWeek: 12,
  totalLessonsWeek: 20,
  achievements: {
    firstStep: true,
    quickLearner: false,
    consistentLearner: true,
    helpingHands: false,
    observationExpert: false,
    tremorSpotter: false,
    consistentCaregiver: false,
  },
  landmarkMatchCorrect: true,
  difficulty: 'Intermediate',
  lastRecommendedLesson: 'Movement speed control',

  resetLessonFeedback: () => set({ landmarkMatchCorrect: true }),

  nextSignLesson: () => {
    const next = Math.min(get().lessonIndex + 1, SIGN_LESSONS.length - 1)
    set({ lessonIndex: next, landmarkMatchCorrect: true })
  },

  prevSignLesson: () => {
    const prev = Math.max(get().lessonIndex - 1, 0)
    set({ lessonIndex: prev, landmarkMatchCorrect: true })
  },

  setLandmarkMatchCorrect: (v) => set({ landmarkMatchCorrect: v }),

  completeGameQuestion: (correct) => {
    set((s) => ({
      gameQuestionIndex: s.gameQuestionIndex + 1,
      streakDays: correct ? s.streakDays : 0,
      rewardPoints: s.rewardPoints + (correct ? 160 : 5),
      lessonsCompletedWeek: correct ? Math.min(s.lessonsCompletedWeek + 1, s.totalLessonsWeek) : s.lessonsCompletedWeek,
      competencyScore: Math.min(100, s.competencyScore + (correct ? 2 : -1)),
    }))
    if (correct) {
      get().unlockAchievement('quickLearner')
    }
  },

  nextParkinsonLesson: () =>
    set((s) => ({
      parkinsonLessonIndex: Math.min(s.parkinsonLessonIndex + 1, PARKINSON_LESSONS.length - 1),
    })),

  prevParkinsonLesson: () =>
    set((s) => ({
      parkinsonLessonIndex: Math.max(s.parkinsonLessonIndex - 1, 0),
    })),

  recordParkinsonQuizComplete: (lessonId, accuracyPct) =>
    set((s) => {
      const clamped = Math.max(0, Math.min(100, Math.round(accuracyPct)))
      const stars = clamped >= 90 ? 3 : clamped >= 75 ? 2 : clamped >= 50 ? 1 : 0
      const prev = s.parkinsonLessonProgress[lessonId] ?? { completed: false, bestAccuracy: 0, stars: 0 }
      return {
        parkinsonLessonProgress: {
          ...s.parkinsonLessonProgress,
          [lessonId]: {
            completed: true,
            bestAccuracy: Math.max(prev.bestAccuracy, clamped),
            stars: Math.max(prev.stars, stars),
          },
        },
        competencyScore: Math.min(100, Math.max(0, s.competencyScore + (clamped >= 80 ? 2 : clamped >= 60 ? 1 : 0))),
      }
    }),

  addRewardPoints: (n) => set((s) => ({ rewardPoints: s.rewardPoints + n })),

  unlockAchievement: (id) =>
    set((s) => ({
      achievements: { ...s.achievements, [id]: true },
    })),

  bumpCompetency: (delta) =>
    set((s) => ({
      competencyScore: Math.max(0, Math.min(100, s.competencyScore + delta)),
    })),
}))

export function getSignLessons() {
  return SIGN_LESSONS
}

export function getParkinsonLessons() {
  return [...PARKINSON_LESSONS]
}
