import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Flame,
  Hand,
  History,
  List,
  LogOut,
  TrendingUp,
  Video,
} from 'lucide-react'
import Button from '../../../shared/components/Button'
import WebcamCapture from '../components/WebcamCapture'
import SignDemoPanel from '../components/SignDemoPanel'
import AttemptFeedbackCard from '../components/AttemptFeedbackCard'
import McqFallbackCard from '../components/McqFallbackCard'
import SignBrowser from '../components/SignBrowser'
import SessionSummaryModal from '../components/SessionSummaryModal'
import GlossTabBar, { type GlossTab } from '../components/GlossTabBar'
import CameraPermissionPrompt from '../components/CameraPermissionPrompt'
import ProgressReport from '../components/ProgressReport'
import HistoryList from '../components/HistoryList'
import MasteryRing from '../components/gloss/MasteryRing'
import GlossStatCard from '../components/gloss/GlossStatCard'
import PracticeSignCard from '../components/gloss/PracticeSignCard'
import glossHero from '../assets/images/practise.jpg'
import {
  getNextGlossLesson,
  submitMultipleChoiceAttempt,
  submitWebcamAttempt,
} from '../services/glossApi'
import {
  cachedGlossProgress,
  cachedGlossSigns,
  invalidateGlossActivity,
} from '../services/glossCache'
import type {
  GlossAttemptResult,
  GlossMasteryStatus,
  GlossPracticeCalendarDay,
  GlossProgressReport,
  GlossSign,
} from '../types/gloss'

// Practice-flow sub-state (lives entirely inside the Practice tab).
type Stage =
  | 'loading'
  | 'ready'
  | 'camera-choice'
  | 'practicing'
  | 'camera-denied'
  | 'submitting'
  | 'feedback'
  | 'quiz'
  | 'error'

type TabId = 'practice' | 'browse' | 'progress' | 'history'

const TABS: ReadonlyArray<GlossTab<TabId>> = [
  { id: 'practice', label: 'Practice', icon: Video },
  { id: 'browse', label: 'Browse Signs', icon: List },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'history', label: 'History', icon: History },
]

function signLabel(signId: string): string {
  return signId.replace(/_/g, ' ')
}

// ---- Practice-landing display helpers (presentation only; no metric
// is invented — values come straight from GET /gloss/progress) --------

function scoreToPct(score: number | null | undefined): number | null {
  return score == null ? null : Math.round(score * 100)
}

const MASTERY_CAPTION: Record<GlossMasteryStatus, string> = {
  new: 'New sign',
  learning: 'Getting started',
  weak: 'Needs practice',
  improving: 'Good progress!',
  mastered: 'Mastered',
  needs_revision: 'Time to revise',
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Consecutive days (ending today or yesterday) that have at least one
// attempt, derived from the practice_calendar the progress endpoint
// already returns.
function computePracticeStreak(calendar: GlossPracticeCalendarDay[]): number {
  const practised = new Set(calendar.filter((d) => d.attempt_count > 0).map((d) => d.date))
  const cursor = new Date()
  if (!practised.has(isoDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!practised.has(isoDay(cursor))) return 0
  }
  let days = 0
  while (practised.has(isoDay(cursor))) {
    days += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return days
}

export default function SignLanguage() {
  const [tab, setTab] = useState<TabId>('practice')
  const [stage, setStage] = useState<Stage>('loading')
  const [targetSignId, setTargetSignId] = useState<string | null>(null)
  const [allSigns, setAllSigns] = useState<GlossSign[]>([])
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [attemptResult, setAttemptResult] = useState<GlossAttemptResult | null>(null)
  const [sessionAttempts, setSessionAttempts] = useState<GlossAttemptResult[]>([])
  const [showSummary, setShowSummary] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Practice-landing widgets only. Read-only snapshot of GET /gloss/progress
  // (the same endpoint the Progress tab uses). A failed fetch just hides
  // those widgets — it never blocks the practice flow.
  const [progress, setProgress] = useState<GlossProgressReport | null>(null)

  const refreshProgress = useCallback(() => {
    cachedGlossProgress()
      .then(setProgress)
      .catch(() => {
        /* landing stats/history widgets stay hidden — practice flow unaffected */
      })
  }, [])

  // Reuse of the exact sign-selection behaviour already used by the
  // Browse tab's onSelect — no new practice logic.
  const selectSign = useCallback((signId: string) => {
    setTargetSignId(signId)
    setRecordedBlob(null)
    setStage('ready')
  }, [])

  const loadRecommendedSign = useCallback(async () => {
    setStage('loading')
    setErrorMessage(null)
    try {
      const { next_recommended_sign_id: signId } = await getNextGlossLesson()
      setTargetSignId(signId)
      setRecordedBlob(null)
      setStage('ready')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load a recommended sign.')
      setStage('error')
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    // Justified on-mount data fetch (re-triggerable later via the same
    // callback from "Next Recommended Sign") — not a derived-state anti-pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecommendedSign()

    cachedGlossSigns()
      .then((signs) => {
        if (isMounted) setAllSigns(signs)
      })
      .catch(() => {
        // Catalogue browsing/MCQ fallback just won't have options if this fails —
        // not fatal to the main practice flow.
      })

    return () => {
      isMounted = false
    }
  }, [loadRecommendedSign])

  // Keep the practice-landing widgets current: refetch the progress
  // snapshot whenever the landing is (re)shown — i.e. on first load and
  // after each completed attempt returns here via "Next sign".
  useEffect(() => {
    if (stage === 'ready') refreshProgress()
  }, [stage, refreshProgress])

  const handleWebcamAttempt = async () => {
    if (!targetSignId || !recordedBlob) return
    setStage('submitting')
    setErrorMessage(null)
    try {
      const result = await submitWebcamAttempt(targetSignId, recordedBlob, sessionId)
      setSessionId(result.session_id)
      setSessionAttempts((prev) => [...prev, result])
      setAttemptResult(result)
      setStage('feedback')
      // A real attempt just landed — mastery / progress / history may have
      // changed. Drop only those cached reads so the next Progress /
      // History / Practice-landing view refetches fresh. Static sign
      // catalogue stays cached. (Backend submission itself is untouched.)
      invalidateGlossActivity()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not submit your attempt.')
      setStage('error')
    }
  }

  const handleMultipleChoiceAttempt = async (selectedSignId: string) => {
    if (!targetSignId) return
    setStage('submitting')
    setErrorMessage(null)
    try {
      const result = await submitMultipleChoiceAttempt(targetSignId, selectedSignId, sessionId)
      setSessionId(result.session_id)
      setSessionAttempts((prev) => [...prev, result])
      setAttemptResult(result)
      setStage('feedback')
      invalidateGlossActivity()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not submit your answer.')
      setStage('error')
    }
  }

  // Practice-landing widgets — all values below come straight from the
  // GET /gloss/progress snapshot; nothing here computes mastery,
  // recommendation, or scoring.
  const recRow =
    progress && targetSignId
      ? (progress.mastery_summary.find((r) => r.sign_id === targetSignId) ?? null)
      : null
  const recommendedMasteryPct = recRow ? scoreToPct(recRow.last_score ?? recRow.best_score) : null
  const masteryCaption = recRow ? MASTERY_CAPTION[recRow.mastery_status] : 'New sign'
  const practiceStreakDays = progress ? computePracticeStreak(progress.practice_calendar) : 0
  const scoredRows = (progress?.mastery_summary ?? []).filter(
    (r) => (r.last_score ?? r.best_score) != null,
  )
  const averageMasteryPct =
    scoredRows.length > 0
      ? Math.round(
          (scoredRows.reduce((sum, r) => sum + (r.last_score ?? r.best_score ?? 0), 0) /
            scoredRows.length) *
            100,
        )
      : null
  const recentSigns = (progress?.mastery_summary ?? [])
    .filter((r) => r.last_practiced_at)
    .slice()
    .sort((a, b) => (b.last_practiced_at ?? '').localeCompare(a.last_practiced_at ?? ''))
    .slice(0, 3)

  const practiceContent = (
    <div className="flex flex-col gap-4">
      {stage === 'loading' && (
        <p className="text-sm text-slate-500">Loading your recommended sign…</p>
      )}

      {stage === 'error' && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <p>{errorMessage}</p>
          <button type="button" onClick={loadRecommendedSign} className="self-start text-sm font-medium underline">
            Try again
          </button>
        </div>
      )}

      {stage === 'ready' && targetSignId && (
        <div className="flex flex-col gap-8">
          {/* Recommended Next hero */}
          <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-[var(--brand-blue)]">Today&apos;s Practice</h2>

            <div
              className="rounded-[22px] border border-[#BFD4FA] p-6 shadow-[0_4px_14px_rgba(15,35,70,0.06)] transition-colors hover:border-[#8EB5F5] sm:p-8"
              style={{ backgroundImage: 'linear-gradient(110deg, #F8FBFF, #EEF5FF)' }}
            >
              <div className="grid gap-8 lg:grid-cols-[1.6fr_0.55fr_0.85fr] lg:items-center">
                <div className="flex flex-col gap-4">
                  <span className="text-sm font-bold uppercase tracking-wider text-[#2563EB]">
                    Recommended next
                  </span>
                  <h3 className="text-[2.75rem] font-bold capitalize leading-[1.05] text-slate-900 sm:text-[3.25rem]">
                    {signLabel(targetSignId)}
                  </h3>
                  <p className="text-base text-slate-500">
                    Recommended based on your recent practice.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Button
                      onClick={() => setStage('camera-choice')}
                      className="h-12 px-6 text-[15px]"
                    >
                      <Video size={17} />
                      Practice This Sign
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setTab('browse')}
                      className="h-12 px-6 text-[15px]"
                    >
                      <List size={17} />
                      Browse All Signs
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm font-medium text-slate-500">Mastery</span>
                  <MasteryRing value={recommendedMasteryPct ?? 0} size={128} />
                  <span className="text-sm text-slate-400">{masteryCaption}</span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#D5E2F6] bg-white shadow-[var(--shadow-sm)]">
                  <div className="relative h-[210px] w-full sm:h-[240px]">
                    <img src={glossHero} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-blue)] shadow-sm backdrop-blur">
                      <Hand size={13} aria-hidden="true" />
                      Sign practice
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Your Practice */}
          {progress && progress.total_attempts > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-[var(--brand-blue)]">Your Practice</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <GlossStatCard
                  accent="blue"
                  icon={BookOpen}
                  label="Signs Practised"
                  value={String(progress.signs_practiced)}
                  caption="Total signs practised"
                />
                <GlossStatCard
                  accent="green"
                  icon={Flame}
                  label="Practice Streak"
                  value={`${practiceStreakDays} day${practiceStreakDays === 1 ? '' : 's'}`}
                  caption={
                    practiceStreakDays > 0 ? 'Keep it going!' : 'Practise today to start a streak'
                  }
                />
                <GlossStatCard
                  accent="purple"
                  icon={TrendingUp}
                  label="Average Mastery"
                  value={averageMasteryPct == null ? '—' : `${averageMasteryPct}%`}
                  caption="Across practised signs"
                />
              </div>
            </section>
          )}

          {/* Continue Practising */}
          {recentSigns.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-[var(--brand-blue)]">Continue Practising</h2>
                <button
                  type="button"
                  onClick={() => setTab('history')}
                  className="flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                >
                  View all practice history
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {recentSigns.map((row, index) => (
                  <PracticeSignCard
                    key={row.sign_id}
                    displayName={row.display_name}
                    masteryPct={scoreToPct(row.last_score ?? row.best_score)}
                    accentIndex={index}
                    onPracticeAgain={() => selectSign(row.sign_id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {stage === 'camera-choice' && targetSignId && (
        <CameraPermissionPrompt
          signLabel={signLabel(targetSignId)}
          onAllowCamera={() => setStage('practicing')}
          onUseQuiz={() => setStage('quiz')}
        />
      )}

      {stage === 'practicing' && targetSignId && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SignDemoPanel key={targetSignId} signId={targetSignId} />
            <WebcamCapture onRecorded={setRecordedBlob} onCameraError={() => setStage('camera-denied')} />
          </div>
          {recordedBlob && (
            <Button onClick={handleWebcamAttempt} className="self-center">
              Submit Attempt
            </Button>
          )}
        </div>
      )}

      {stage === 'camera-denied' && targetSignId && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-md)] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            We couldn&apos;t access your camera. You can still learn this sign below with the reference
            demonstration and a short quiz — or try the camera again.
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SignDemoPanel key={targetSignId} signId={targetSignId} />
            <div className="flex flex-col justify-center gap-3">
              <Button onClick={() => setStage('practicing')}>Try Camera Again</Button>
              <Button variant="secondary" onClick={() => setStage('quiz')}>
                Continue With Quiz
              </Button>
            </div>
          </div>
        </div>
      )}

      {stage === 'quiz' && targetSignId && (
        <McqFallbackCard
          targetSignId={targetSignId}
          allSigns={allSigns}
          onSelect={handleMultipleChoiceAttempt}
          disabled={false}
        />
      )}

      {stage === 'submitting' && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--brand-blue)]" />
          Analysing your attempt…
        </div>
      )}

      {stage === 'feedback' && attemptResult && targetSignId && (
        <AttemptFeedbackCard
          result={attemptResult}
          targetSignId={targetSignId}
          onPracticeAgain={() => {
            setRecordedBlob(null)
            setStage('camera-choice')
          }}
          onNextSign={loadRecommendedSign}
        />
      )}
    </div>
  )

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          to="/sign-vitals"
          className="flex w-fit items-center gap-1 text-sm font-medium text-[#3159B7] transition-colors hover:text-[var(--brand-blue)]"
        >
          <ChevronLeft size={16} />
          Back to Sign &amp; Vitals
        </Link>

        {sessionAttempts.length > 0 && (
          <Button variant="secondary" onClick={() => setShowSummary(true)}>
            <LogOut size={16} />
            End Session
          </Button>
        )}
      </div>

      <GlossTabBar tabs={TABS} activeId={tab} onChange={setTab}>
        {tab === 'practice' && practiceContent}

        {tab === 'browse' && (
          <SignBrowser
            signs={allSigns}
            mastery={progress?.mastery_summary ?? []}
            onSelect={(signId) => {
              setTargetSignId(signId)
              setRecordedBlob(null)
              setStage('ready')
              setTab('practice')
            }}
          />
        )}

        {tab === 'progress' && <ProgressReport />}

        {tab === 'history' && <HistoryList />}
      </GlossTabBar>

      {showSummary && (
        <SessionSummaryModal attempts={sessionAttempts} onClose={() => setShowSummary(false)} />
      )}
    </div>
  )
}