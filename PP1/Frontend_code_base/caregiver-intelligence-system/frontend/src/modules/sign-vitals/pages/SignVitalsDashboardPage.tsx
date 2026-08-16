import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Footprints,
  Hand,
  Lightbulb,
  Sparkles,
  Star,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { CaregiverAvatar } from '../../../components/signVitals/CaregiverAvatar'
import { ElderAvatar } from '../../../components/signVitals/ElderAvatar'
import { downloadCareSensePerformanceReport } from '../../../utils/reportGenerator'
import { CameraReadinessModal } from '../components/caresense/CameraReadinessModal'
import { LessonProgress } from '../components/caresense/LessonProgress'
import { ProgressRing } from '../components/caresense/ProgressRing'
import { SurfaceCard } from '../components/caresense/SurfaceCard'
import { useSignVitalsStore } from '../store/signVitalsStore'

const DASH_QUIZ = [
  { id: 'help', label: 'Help' },
  { id: 'eat', label: 'Eat' },
  { id: 'drink', label: 'Drink' },
  { id: 'thanks', label: 'Thank You' },
] as const

function DashboardMicroQuiz() {
  const [picked, setPicked] = useState<string | null>(null)
  const correctId = 'thanks'

  return (
    <SurfaceCard accent="purple" title="Quick check" titleAside={<Hand className="h-4 w-4 text-violet-500" />}>
      <p className="text-sm text-slate-600">What does this sign mean?</p>
      <div className="relative mt-4 flex justify-center">
        <div className="w-[120px]">
          <CaregiverAvatar pose="teaching" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {DASH_QUIZ.map((opt) => {
          const sel = picked === opt.id
          const ok = opt.id === correctId
          let ring = 'border-slate-200 hover:scale-[1.02]'
          if (picked) {
            if (ok) ring = 'border-emerald-400 bg-emerald-50 shadow-sm'
            else if (sel && !ok) ring = 'border-red-300 bg-red-50'
          }
          return (
            <button
              key={opt.id}
              type="button"
              disabled={!!picked}
              onClick={() => setPicked(opt.id)}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold text-slate-800 transition-transform ${ring}`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {picked ? (
        <p className="mt-3 text-xs text-slate-600">
          {picked === correctId ? (
            <span className="font-semibold text-emerald-700">Lovely — chin-to-out sweep is Thank You!</span>
          ) : (
            <span>The gentle teaching cue is closest to Thank You.</span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Tap an answer — forgiving scoring for practice.</p>
      )}
    </SurfaceCard>
  )
}

export function SignVitalsDashboardPage() {
  const navigate = useNavigate()
  const [cameraOpen, setCameraOpen] = useState(false)

  const lessonsCompletedWeek = useSignVitalsStore((s) => s.lessonsCompletedWeek)
  const totalLessonsWeek = useSignVitalsStore((s) => s.totalLessonsWeek)
  const streakDays = useSignVitalsStore((s) => s.streakDays)
  const rewardPoints = useSignVitalsStore((s) => s.rewardPoints)
  const competencyScore = useSignVitalsStore((s) => s.competencyScore)

  const goLive = () => {
    setCameraOpen(false)
    navigate('/sign-vitals/sign-live', { state: { useCamera: true } })
  }
  const goGame = () => {
    setCameraOpen(false)
    navigate('/sign-vitals/sign-game')
  }

  return (
    <>
      <CameraReadinessModal open={cameraOpen} onClose={() => setCameraOpen(false)} onNo={goGame} onYes={goLive} />

      <div className="space-y-10 pb-10">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-violet-600">CareSense</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Sign &amp; Vitals</h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-600">
              AI-powered tutoring for expressive signing and non-verbal motor cues — calm, clear, and caregiver-first.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/sign-vitals/assessment"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition hover:scale-[1.02] hover:border-violet-200"
            >
              Assessment <ArrowRight className="h-4 w-4 text-violet-600" />
            </Link>
            <Link
              to="/sign-vitals/rewards"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:scale-[1.02]"
            >
              Rewards <Star className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {/* Hero tutoring cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/40 p-6 shadow-[0_14px_40px_rgba(109,40,217,0.09)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(109,40,217,0.12)]">
            <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white/80 p-6">
              <span className="absolute left-4 top-4 inline-flex rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                Sign language
              </span>
              <div className="mt-10 w-[200px]">
                <CaregiverAvatar pose="raisedHand" />
              </div>
            </div>
            <div className="mt-6 flex flex-1 flex-col">
              <h2 className="text-xl font-bold text-slate-900">Sign Language</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                Learn essential caregiver phrases with guided 3D avatar demonstrations, real-time feedback and gentle
                coaching.
              </p>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:scale-[1.02] sm:w-auto sm:justify-start"
              >
                <Sparkles className="h-4 w-4" />
                Start Learning
              </button>
            </div>
          </article>

          <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-200/85 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 p-6 shadow-[0_14px_40px_rgba(16,185,129,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(16,185,129,0.14)]">
            <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-emerald-50/50 p-6">
              <span className="absolute left-4 top-4 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                Non-verbal
              </span>
              <div className="max-w-[220px] pt-10">
                <ElderAvatar pose="restingTremor" />
              </div>
            </div>
            <div className="mt-6 flex flex-1 flex-col">
              <h2 className="text-xl font-bold text-slate-900">Non-Verbal Sign Vitals</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                Tutoring module for recognizing motor signs as educational cues — not a diagnosis. Understand,
                observe, and respond better.
              </p>
              <button
                type="button"
                onClick={() => navigate('/sign-vitals/nonverbal-vitals')}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.02] sm:w-auto"
              >
                <Footprints className="h-4 w-4" />
                Start Learning
              </button>
            </div>
          </article>
        </div>

        {/* KPI row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <SurfaceCard accent="purple" title="Progress Overview" titleAside={<Sparkles className="h-4 w-4 text-violet-500" />}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <ProgressRing value={competencyScore} label="Competency" sublabel="Tutoring blend" />
              <div className="grid flex-1 grid-cols-2 gap-3">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3">
                  <div className="flex items-center gap-2 text-violet-700">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Lessons</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {lessonsCompletedWeek}/{totalLessonsWeek}
                  </p>
                  <p className="text-xs text-slate-600">Completed this week</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Star className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Streak</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{streakDays} days</p>
                  <p className="text-xs text-slate-600">Gentle daily rhythm</p>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <LessonProgress current={lessonsCompletedWeek} total={totalLessonsWeek} variant="purple" label="Weekly pathway" />
            </div>
          </SurfaceCard>

          <SurfaceCard
            accent="neutral"
            title="Recent Activity"
            titleAside={
              <Link to="/sign-vitals/sign-live" className="text-xs font-semibold text-violet-600 hover:underline">
                Continue
              </Link>
            }
          >
            <ul className="space-y-3 text-sm">
              {[
                { t: 'Practiced: Basic Greetings', time: '2h ago', icon: BookOpen, tone: 'violet' },
                { t: 'Non-verbal: Resting tremor cues', time: '1d ago', icon: Footprints, tone: 'emerald' },
                { t: 'Badge: Helping Hands streak', time: '2d ago', icon: CheckCircle2, tone: 'teal' },
              ].map((row) => (
                <li
                  key={row.t}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/70 px-3 py-2.5 shadow-[0_1px_6px_rgba(15,23,42,0.04)]"
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      row.tone === 'violet'
                        ? 'bg-violet-100 text-violet-700'
                        : row.tone === 'emerald'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-teal-100 text-teal-700'
                    }`}
                  >
                    <row.icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{row.t}</div>
                    <div className="text-xs text-slate-500">{row.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </SurfaceCard>

          <SurfaceCard
            accent="green"
            title={
              <span className="inline-flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Daily Tip
              </span>
            }
          >
            <p className="text-sm leading-relaxed text-slate-700">
              Slow your exhale before you move into a comfort sign — it lowers everyone’s shoulders, especially when motor
              planning takes a beat longer.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center shadow-inner">
                <p className="text-[10px] font-semibold uppercase text-emerald-800">Rewards</p>
                <p className="text-xl font-black text-emerald-900">{rewardPoints}</p>
                <p className="text-[10px] text-emerald-700"> pts balance</p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/80 p-3 text-center shadow-inner">
                <p className="text-[10px] font-semibold uppercase text-violet-800">Glow-up</p>
                <p className="mt-2 text-xl">✨</p>
                <p className="text-[10px] text-violet-700">You’re trending up</p>
              </div>
            </div>
          </SurfaceCard>
        </div>

        {/* Report + quiz + THANK YOU teaser */}
        <div className="grid gap-6 lg:grid-cols-4">
          <SurfaceCard
            className="lg:col-span-2"
            accent="neutral"
            title="Sample caregiver report"
            titleAside={<FileText className="h-4 w-4 text-slate-500" />}
          >
            <p className="text-sm text-slate-600">
              Peek a polished performance summary — downloadable for supervision huddles or portfolio evidence (sample data).
            </p>
            <div className="mt-6 flex flex-wrap gap-8 border-t border-slate-100 pt-6">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Overall</p>
                <p className="text-3xl font-black text-emerald-600">86%</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Lessons</p>
                <p className="text-3xl font-black text-violet-700">18/20</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Accuracy</p>
                <p className="text-3xl font-black text-slate-900">86%</p>
              </div>
              <button
                type="button"
                onClick={() => downloadCareSensePerformanceReport()}
                className="inline-flex items-center gap-2 self-center rounded-xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 px-5 py-2.5 text-sm font-bold text-violet-900 shadow-[0_10px_30px_rgba(109,40,217,0.12)] transition hover:scale-[1.03]"
              >
                <Download className="h-4 w-4" />
                Download Report
              </button>
            </div>
          </SurfaceCard>

          <DashboardMicroQuiz />

          <SurfaceCard accent="purple" title="Let&apos;s Learn: THANK YOU">
            <p className="text-xs text-slate-500">Match the caregiver tutor — same avatar everywhere in Sign & Vitals.</p>
            <div className="mt-3 flex justify-center">
              <div className="w-[148px]">
                <CaregiverAvatar pose="thankYou" />
              </div>
            </div>
            <Link
              to="/sign-vitals/sign-live"
              className="mt-4 inline-flex w-full justify-center rounded-lg border border-violet-200 bg-violet-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:scale-[1.02]"
            >
              Open live tutoring
            </Link>
          </SurfaceCard>
        </div>
      </div>
    </>
  )
}
