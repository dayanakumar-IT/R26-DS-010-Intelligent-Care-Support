import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, History, List, LogOut, TrendingUp, Video } from 'lucide-react'
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
import { getNextGlossLesson, listGlossSigns, submitMultipleChoiceAttempt, submitWebcamAttempt } from '../services/glossApi'
import type { GlossAttemptResult, GlossSign } from '../types/gloss'

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

    listGlossSigns()
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not submit your answer.')
      setStage('error')
    }
  }

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
        <div className="flex flex-col gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommended next</span>
          <h1 className="text-2xl font-semibold capitalize text-slate-900">{signLabel(targetSignId)}</h1>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setStage('camera-choice')}>
              <Video size={16} />
              Practice This Sign
            </Button>
            <Button variant="secondary" onClick={() => setTab('browse')}>
              <List size={16} />
              Browse All Signs
            </Button>
          </div>
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          to="/sign-vitals"
          className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft size={16} />
          Back to Sign & Vitals
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