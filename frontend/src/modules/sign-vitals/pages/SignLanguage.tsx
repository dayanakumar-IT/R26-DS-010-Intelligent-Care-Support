import { useCallback, useEffect, useRef, useState } from 'react'
import CheckingSign from '../components/gloss/CheckingSign'
import { Link } from 'react-router-dom'
import {
  Award,
  BookOpen,
  Brain,
  CalendarDays,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  History,
  List,
  LogOut,
  Route,
  ScanSearch,
  TrendingUp,
  Video,
} from 'lucide-react'
import Button from '../../../shared/components/Button'
import { supabase } from '../../../services/supabaseClient'
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
import GlossStatCard from '../components/gloss/GlossStatCard'
import PracticeSignCard from '../components/gloss/PracticeSignCard'
import StrongInARowMeter from '../components/gloss/StrongInARowMeter'
import QualityNote from '../components/gloss/QualityNote'
import SignPreview from '../components/gloss/SignPreview'
import WelcomeCard from '../components/gloss/WelcomeCard'
import Celebration from '../components/gloss/Celebration'
import CheckMySign from '../components/CheckMySign'
import RecallChallenge from '../components/RecallChallenge'
import MyJourney from '../components/journey/MyJourney'
import ProgressReportPrint from '../components/journey/ProgressReportPrint'
import { lowHandTip } from '../utils/captureTips'
import {
  getGlossProgressSummary,
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
  GlossMasterySummaryRow,
  GlossNewMilestone,
  GlossProgressSummary,
  GlossProgressReport,
  GlossSign,
} from '../types/gloss'
import {
  PROGRESS_LABEL,
  STRONG_NEEDED,
  activeDaysThisWeek,
  progressState,
} from '../utils/progressLabels'

// Practice-flow sub-state (lives entirely inside the Practice tab).
type Stage =
  | 'loading'
  | 'ready'
  | 'camera-choice'
  | 'practicing'
  | 'camera-denied'
  | 'submitting'
  | 'retake'
  | 'feedback'
  | 'quiz'
  | 'error'

type TabId = 'practice' | 'check' | 'recall' | 'browse' | 'journey' | 'progress' | 'history'

const TABS: ReadonlyArray<GlossTab<TabId>> = [
  { id: 'practice', label: 'Practice', icon: Video },
  { id: 'check', label: 'Check my sign', icon: ScanSearch },
  { id: 'recall', label: 'Recall', icon: Brain },
  { id: 'browse', label: 'Browse Signs', icon: List },
  { id: 'journey', label: 'My Journey', icon: Route },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'history', label: 'History', icon: History },
]

function signLabel(signId: string): string {
  return signId.replace(/_/g, ' ')
}

// Practice-landing display values come straight from GET /gloss/progress;
// wording comes from utils/progressLabels (one vocabulary on every screen).

// Why this sign was recommended, from its own record — never invented.
function recommendationReason(row: GlossMasterySummaryRow | null): string {
  if (!row || row.attempts === 0) return "You haven't tried this sign yet."
  if (row.camera_attempts === 0) return "You've answered quiz questions on this sign — try it with the camera."
  const attempts = `${row.attempts} attempt${row.attempts === 1 ? '' : 's'}`
  return row.consecutive_strong_streak > 0
    ? `You're part-way there — ${attempts} so far.`
    : `You've tried this sign (${attempts}) and haven't had a strong attempt in a row yet.`
}

export default function SignLanguage() {
  const [tab, setTab] = useState<TabId>('practice')
  const [stage, setStage] = useState<Stage>('loading')
  const [targetSignId, setTargetSignId] = useState<string | null>(null)
  // True when the caregiver chose the sign (Browse / Continue practising),
  // false when the selector recommended it.
  const [pickedByUser, setPickedByUser] = useState(false)
  const [allSigns, setAllSigns] = useState<GlossSign[]>([])
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [attemptResult, setAttemptResult] = useState<GlossAttemptResult | null>(null)
  const [sessionAttempts, setSessionAttempts] = useState<GlossAttemptResult[]>([])
  const [showSummary, setShowSummary] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Camera message when the backend stopped a clip before recognition
  // (hands not visible / no movement). Nothing was stored for it.
  const [retakeMessage, setRetakeMessage] = useState<string | null>(null)
  // Practice-landing widgets only. Read-only snapshot of GET /gloss/progress
  // (the same endpoint the Progress tab uses). A failed fetch just hides
  // those widgets — it never blocks the practice flow.
  const [progress, setProgress] = useState<GlossProgressReport | null>(null)
  // Mastery rows as they were when this session started (the first progress
  // snapshot, taken before any attempt) — the "before" the session summary
  // compares against. Never overwritten by later refreshes.
  const [sessionBaseline, setSessionBaseline] = useState<GlossMasterySummaryRow[] | null>(null)

  // A practice session belongs to one login: forget it when the user signs
  // out or a different user signs in, so a stale id is never sent. (The
  // backend also starts a new session if an id is missing or not theirs.)
  const sessionUserRef = useRef<string | null>(null)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id ?? null
      if (event === 'SIGNED_OUT' || userId !== sessionUserRef.current) setSessionId(undefined)
      sessionUserRef.current = userId
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Levels / badges / My Journey (GET /gloss/progress/summary). null until
  // loaded, or if unavailable (e.g. migrations not applied): the welcome
  // card is then hidden and practice is unaffected.
  const [summary, setSummary] = useState<GlossProgressSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState<GlossNewMilestone[]>([])
  const [showReport, setShowReport] = useState(false)
  const refreshSummary = useCallback(() => {
    getGlossProgressSummary()
      .then((s) => {
        setSummary(s)
        setSummaryError(null)
      })
      .catch((e: unknown) => setSummaryError(e instanceof Error ? e.message : 'Unavailable'))
  }, [])
  useEffect(() => {
    refreshSummary() // initial async load
  }, [refreshSummary])

  // After any attempt: refresh progress, and celebrate newly earned
  // milestones only when the attempt itself succeeded (never on a failed one).
  const afterAttempt = useCallback(
    (result: GlossAttemptResult) => {
      const earned = result.new_milestones ?? []
      if (earned.length && (result.outcome === 'target_sign' || result.outcome === 'quiz_correct')) setCelebrate(earned)
      refreshSummary()
    },
    [refreshSummary],
  )

  const refreshProgress = useCallback(() => {
    cachedGlossProgress()
      .then((report) => {
        setProgress(report)
        setSessionBaseline((prev) => prev ?? report.mastery_summary)
      })
      .catch(() => {
        /* landing stats/history widgets stay hidden — practice flow unaffected */
      })
  }, [])

  // Reuse of the exact sign-selection behaviour already used by the
  // Browse tab's onSelect — no new practice logic.
  const selectSign = useCallback((signId: string) => {
    setTargetSignId(signId)
    setPickedByUser(true)
    setRecordedBlob(null)
    setStage('ready')
  }, [])

  const practiseSign = useCallback(
    (signId: string) => {
      selectSign(signId)
      setTab('practice')
    },
    [selectSign],
  )

  // "Practice again" / "Practise this sign": straight to the camera practice
  // screen for that sign (the camera prompt is skipped; if the camera is
  // blocked the usual camera-denied screen with the quiz appears).
  const practiseNow = useCallback((signId: string) => {
    setTargetSignId(signId)
    setPickedByUser(true)
    setRecordedBlob(null)
    setStage('practicing')
    setTab('practice')
  }, [])

  const loadRecommendedSign = useCallback(async () => {
    setStage('loading')
    setErrorMessage(null)
    try {
      const { next_recommended_sign_id: signId } = await getNextGlossLesson()
      setTargetSignId(signId)
      setPickedByUser(false)
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
      if (result.outcome === 'capture_rejected') {
        setRecordedBlob(null)
        setRetakeMessage(lowHandTip(result.capture_check.hand_presence) ?? result.message)
        setStage('retake')
        return
      }
      setSessionAttempts((prev) => [...prev, result])
      setAttemptResult(result)
      setStage('feedback')
      afterAttempt(result)
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
      afterAttempt(result)
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
  const strongNeeded = progress?.strong_needed ?? STRONG_NEEDED
  const recState = progressState(recRow?.mastery_status, recRow?.attempts ?? 0)
  const activeDays = progress ? activeDaysThisWeek(progress.practice_calendar) : 0
  // Practised / Demonstrated: the same numbers as My Journey and Progress
  // (GET /gloss/progress/summary): Demonstrated out of the countable signs.
  const counts = summary?.counts ?? null
  const qualityNote = allSigns.find((s) => s.id === targetSignId)?.quality_note ?? null
  // Dictionary-only signs are never offered here, even if already practised.
  const recentSigns = (progress?.mastery_summary ?? [])
    .filter((r) => r.last_practiced_at && r.recommendable !== false)
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
          {summary && <WelcomeCard summary={summary} />}
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
                    {pickedByUser ? 'Selected sign' : 'Recommended next'}
                  </span>
                  <h3 className="text-[2.75rem] font-bold capitalize leading-[1.05] text-slate-900 sm:text-[3.25rem]">
                    {signLabel(targetSignId)}
                  </h3>
                  <p className="text-base text-slate-600">{recommendationReason(recRow)}</p>
                  {qualityNote && <QualityNote text={qualityNote} />}
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

                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[var(--brand-blue)] shadow-sm">
                    {PROGRESS_LABEL[recState]}
                  </span>
                  <StrongInARowMeter
                    streak={recRow?.consecutive_strong_streak ?? 0}
                    needed={strongNeeded}
                    size="lg"
                  />
                  <span className="text-sm text-slate-500">
                    {strongNeeded} strong camera attempts in a row = demonstrated
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#D5E2F6] bg-white shadow-[var(--shadow-sm)]">
                  <div className="relative h-[210px] w-full sm:h-[240px]">
                    <SignPreview key={targetSignId} signId={targetSignId} signName={signLabel(targetSignId)} />

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
                  value={counts ? String(counts.practised) : '–'}
                  caption="Different signs practised"
                />
                <GlossStatCard
                  accent="green"
                  icon={CalendarDays}
                  label="Active Days"
                  value={`${activeDays} of 7`}
                  caption="Days with practice in the last week"
                />
                <GlossStatCard
                  accent="purple"
                  icon={Award}
                  label="Demonstrated"
                  value={counts ? `${counts.demonstrated} of ${counts.countable}` : '–'}
                  caption={`${strongNeeded} strong attempts in a row${counts && counts.not_assessed ? ` · ${counts.not_assessed} signs not assessed by camera` : ''}`}
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
                    row={row}
                    strongNeeded={strongNeeded}
                    accentIndex={index}
                    onPracticeAgain={() => practiseNow(row.sign_id)}
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
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold capitalize text-slate-900">{signLabel(targetSignId)}</h2>
            {qualityNote && <QualityNote text={qualityNote} />}
          </div>
          {/* Equal columns; both media boxes are 4:3 under a toolbar row of the
              same height, so they line up at the top and the bottom. */}
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
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
          {qualityNote && <QualityNote text={qualityNote} />}
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
        <CheckingSign />
      )}

      {stage === 'retake' && targetSignId && (
        <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3 text-amber-900">
            <CameraOff size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold">Let&apos;s try that recording again</p>
              <p className="text-base">{retakeMessage}</p>
              <p className="text-sm text-amber-800">
                This attempt wasn&apos;t counted, so your progress on &ldquo;{signLabel(targetSignId)}&rdquo; is
                unchanged.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setStage('practicing')}>
              <Video size={16} />
              Record Again
            </Button>
            <Button variant="secondary" onClick={loadRecommendedSign}>
              Next Recommended Sign
            </Button>
          </div>
        </div>
      )}

      {stage === 'feedback' && attemptResult && targetSignId && (
        <AttemptFeedbackCard
          result={attemptResult}
          targetSignId={targetSignId}
          onPracticeAgain={() => {
            setRecordedBlob(null)
            setStage('practicing')
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

      {celebrate.length > 0 && <Celebration milestones={celebrate} onClose={() => setCelebrate([])} />}

      <GlossTabBar tabs={TABS} activeId={tab} onChange={(t) => { setCelebrate([]); setTab(t) }}>
        {tab === 'practice' && practiceContent}

        {tab === 'check' && (
          <CheckMySign sessionId={sessionId} onSession={setSessionId} onPractise={practiseNow} />
        )}

        {tab === 'recall' && (
          <RecallChallenge
            allSigns={allSigns}
            sessionId={sessionId}
            onSession={setSessionId}
            onAttempt={(r) => {
              afterAttempt(r)
              invalidateGlossActivity()
            }}
            onPractise={practiseNow}
          />
        )}

        {tab === 'journey' &&
          (summary ? (
            <MyJourney summary={summary} onOpenSign={practiseSign} onOpenReport={() => setShowReport(true)} />
          ) : (
            <p className="text-sm text-slate-500">
              {summaryError ? `My Journey is not available yet: ${summaryError}` : 'Loading your journey…'}
            </p>
          ))}

        {tab === 'browse' && (
          <SignBrowser
            signs={allSigns}
            mastery={progress?.mastery_summary ?? []}
            onSelect={(signId) => {
              setTargetSignId(signId)
              setPickedByUser(true)
              setRecordedBlob(null)
              setStage('ready')
              setTab('practice')
            }}
          />
        )}

        {tab === 'progress' && <ProgressReport />}

        {tab === 'history' && <HistoryList />}
      </GlossTabBar>

      {showReport && summary && <ProgressReportPrint summary={summary} onClose={() => setShowReport(false)} />}

      {showSummary && (
        <SessionSummaryModal
          attempts={sessionAttempts}
          baseline={sessionBaseline}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  )
}