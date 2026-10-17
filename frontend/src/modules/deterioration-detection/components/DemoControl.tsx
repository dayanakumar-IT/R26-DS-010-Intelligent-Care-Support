import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import Icon from '../../../shared/components/Icon'
import CaregiverSearchSelect from './CaregiverSearchSelect'
import { translateShapFactor } from '../constants'
import { useDeteriorationData } from '../context/useDeteriorationData'
import {
  getRiskHistory,
  getStagingStatus,
  revealNextDay,
  uploadRawData,
  uploadSurveyResponses,
} from '../services/api'
import type { StagingStatusDay, StagingStatusResponse } from '../services/api'
import styles from './DemoControl.module.css'

// Sourced from the official TILES-2018 EMA README, not invented — the
// exact question text and 1-5 answer labels for the stress item.
const STRESS_QUESTION = 'Overall, how would you rate your current level of stress?'
const STRESS_ANSWER_LABELS: Record<number, string> = {
  1: 'No stress at all',
  2: 'Very little stress',
  3: 'Some stress',
  4: 'A lot of stress',
  5: 'A great deal of stress',
}

function stressAnswerLabel(value: number): string {
  const rounded = Math.round(value)
  return STRESS_ANSWER_LABELS[rounded] ?? `Stress level ${value}`
}

interface ChartRow extends StagingStatusDay {
  baseline: number | null
  risk_probability: number | null
  top_shap_factor: string | null
}

// Cumulative average of hr_mean_full up to and including each row, once
// 2+ revealed days exist overall — a single point's "cumulative average"
// would just equal that point's own HR (visually redundant), so the whole
// series stays hidden until there's a second point to actually compare
// against.
function withRunningBaseline(rows: StagingStatusDay[]): ChartRow[] {
  const showBaseline = rows.length >= 2
  let sum = 0
  let count = 0
  return rows.map((row) => {
    if (row.hr_mean_full !== null) {
      sum += row.hr_mean_full
      count += 1
    }
    const baseline = showBaseline && count > 0 ? sum / count : null
    return { ...row, baseline, risk_probability: null, top_shap_factor: null }
  })
}

function RevealTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload as ChartRow | undefined
  if (!row) return null

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{String(label)}</p>
      <p className={styles.tooltipLine}>
        HR: {row.hr_mean_full !== null ? `${row.hr_mean_full.toFixed(1)} bpm` : 'No data'}
      </p>
      <p className={styles.tooltipLine}>
        Steps: {row.number_steps !== null ? row.number_steps.toLocaleString() : 'No data'}
      </p>
      {row.risk_probability !== null && (
        <p className={styles.tooltipLine}>Risk: {(row.risk_probability * 100).toFixed(1)}%</p>
      )}
      {row.real_stress !== null ? (
        <>
          <p className={styles.tooltipQuestion}>{STRESS_QUESTION}</p>
          <p className={styles.tooltipAnswer}>{stressAnswerLabel(row.real_stress)}</p>
          <p className={styles.tooltipMeta}>Answered on {row.feature_date}</p>
        </>
      ) : (
        <p className={styles.tooltipNoAnswer}>Did not answer</p>
      )}
    </div>
  )
}

// Keyed by caregiverId in the parent (remounts fresh per selection, same
// pattern as CaregiverRiskPanel etc. elsewhere in this module) — so
// re-selecting a caregiver re-checks their real staging status from
// scratch rather than carrying over another caregiver's wizard progress.
function DemoControlWizard({ caregiverId }: { caregiverId: string }) {
  const { setActiveTab, setPendingCaregiverId, refetchRiskSummary, invalidateCaregiver } = useDeteriorationData()

  // Single source of truth for "how far along is this caregiver" —
  // fetched once on mount and refreshed after every mutation (upload,
  // reveal). This is what lets re-selecting a caregiver who already has
  // data from an earlier visit show real progress instead of a blank
  // wizard, and it's why steps 1/2's "done" state below is derived from
  // this rather than only from a fresh upload in this same session.
  const [status, setStatus] = useState<StagingStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [riskByDate, setRiskByDate] = useState<
    Map<string, { risk_probability: number | null; top_shap_factor: string | null }>
  >(new Map())

  const refreshStatus = () =>
    Promise.all([getStagingStatus(caregiverId), getRiskHistory(caregiverId)]).then(
      ([staging, riskHistory]) => {
        setStatus(staging)
        setRiskByDate(
          new Map(
            riskHistory.history.map((h) => [
              h.feature_date,
              { risk_probability: h.risk_probability, top_shap_factor: h.top_shap_factor },
            ]),
          ),
        )
      },
    )

  useEffect(() => {
    let isMounted = true
    refreshStatus()
      .catch((err: unknown) => {
        if (isMounted) setStatusError(err instanceof Error ? err.message : 'Failed to load staging status.')
      })
      .finally(() => {
        if (isMounted) setStatusLoading(false)
      })
    return () => {
      isMounted = false
    }
    // Mount-once per caregiver (remounted via key={caregiverId} in the
    // parent) — refreshStatus is called again explicitly after each
    // mutation below, not via a dependency change here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caregiverId])

  const hasStagedData = (status?.total_staged ?? 0) > 0
  const hasSurveyData = status?.days.some((day) => day.real_stress !== null) ?? false

  // Step 1 + 2 share ONE backend call (POST /admin/upload-raw-data takes
  // both files in a single multipart request — an existing endpoint this
  // task doesn't touch). The wizard still shows two visual steps: Step 1's
  // button only stages the HR file locally client-side (no network call
  // yet); Step 2's button fires the real combined upload using both files.
  const [hrFile, setHrFile] = useState<File | null>(null)
  const [hrFileReady, setHrFileReady] = useState(false)
  const [dsFile, setDsFile] = useState<File | null>(null)
  const [rawUploading, setRawUploading] = useState(false)
  const [rawUploadError, setRawUploadError] = useState<string | null>(null)
  const [freshRawResult, setFreshRawResult] = useState<{ days_staged: number } | null>(null)

  const step2Done = hasStagedData || freshRawResult !== null
  const step1Done = hrFileReady || step2Done

  const handleUploadSummary = () => {
    if (!hrFile || !dsFile) return
    setRawUploading(true)
    setRawUploadError(null)
    uploadRawData(caregiverId, hrFile, dsFile)
      .then((result) => {
        setFreshRawResult(result)
        return refreshStatus()
      })
      .catch((err: unknown) => {
        setRawUploadError(err instanceof Error ? err.message : 'Failed to upload HR/summary data.')
      })
      .finally(() => setRawUploading(false))
  }

  // Step 3 — its own real backend call.
  const [emaFile, setEmaFile] = useState<File | null>(null)
  const [surveyUploading, setSurveyUploading] = useState(false)
  const [surveyUploadError, setSurveyUploadError] = useState<string | null>(null)
  const [freshSurveyResult, setFreshSurveyResult] = useState<{ dates_matched: number } | null>(null)

  const step3Done = hasSurveyData || freshSurveyResult !== null

  const handleUploadSurvey = () => {
    if (!emaFile) return
    setSurveyUploading(true)
    setSurveyUploadError(null)
    uploadSurveyResponses(caregiverId, emaFile)
      .then((result) => {
        setFreshSurveyResult(result)
        return refreshStatus()
      })
      .catch((err: unknown) => {
        setSurveyUploadError(err instanceof Error ? err.message : 'Failed to upload survey responses.')
      })
      .finally(() => setSurveyUploading(false))
  }

  // Reveal
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)

  const handleReveal = () => {
    setRevealing(true)
    setRevealError(null)
    revealNextDay(caregiverId)
      .then(() => {
        // reveal-next-day just wrote a new daily_features row for this
        // caregiver — the shared context's per-caregiver caches
        // (assessment/riskHistory/caregiverHistory/baselineHistory, all
        // built from that same table) and the team-wide risk-summary
        // (whose "not yet monitored"/risk-level counts include this
        // caregiver) were populated before that write and don't know
        // about it yet. Bust both here, in the one place that mutation
        // happens, rather than leaving Overview/Caregiver Profiles to
        // discover it's stale on their own — this component's own chart
        // above never had this problem (refreshStatus already calls
        // getStagingStatus/getRiskHistory directly, bypassing the shared
        // cache entirely, since this data was always expected to mutate
        // within a session).
        invalidateCaregiver(caregiverId)
        refetchRiskSummary()
        return refreshStatus()
      })
      .catch((err: unknown) => {
        setRevealError(err instanceof Error ? err.message : 'Failed to reveal next day.')
      })
      .finally(() => setRevealing(false))
  }

  if (statusLoading) {
    return <p className={styles.status}>Loading caregiver status…</p>
  }
  if (statusError) {
    return (
      <div className={styles.errorBox} role="alert">
        <Icon name="warning" size={18} className={styles.errorIcon} />
        <p className={styles.errorText}>{statusError}</p>
      </div>
    )
  }

  const revealedDays = (status?.days ?? []).filter((day) => day.revealed)
  const chartRows: ChartRow[] = withRunningBaseline(revealedDays).map((row) => ({
    ...row,
    ...(riskByDate.get(row.feature_date) ?? { risk_probability: null, top_shap_factor: null }),
  }))
  const showRiskAxis = chartRows.some((row) => row.risk_probability !== null)
  const lastRow = chartRows[chartRows.length - 1]
  const dayNumber = chartRows.length
  const allRevealed = (status?.total_staged ?? 0) > 0 && (status?.revealed_count ?? 0) >= (status?.total_staged ?? 0)

  return (
    <div>
      <div className={styles.wizard}>
        <WizardStep
          number={1}
          title="Upload Heart Rate Data"
          done={step1Done}
          summary={step1Done ? (step2Done ? 'HR file included in upload below' : 'HR file selected') : null}
        >
          <input
            type="file"
            accept=".gz"
            className={styles.fileInput}
            onChange={(event) => {
              setHrFile(event.target.files?.[0] ?? null)
              setHrFileReady(false)
            }}
          />
          <button
            type="button"
            className={styles.stepButton}
            disabled={!hrFile}
            onClick={() => setHrFileReady(true)}
          >
            Upload HR Data
          </button>
          <p className={styles.stepCaption}>
            Sent together with the Summary file in Step 2 (one combined upload) — this just confirms the
            file is ready.
          </p>
        </WizardStep>

        <WizardStep
          number={2}
          title="Upload Daily Activity Summary"
          done={step2Done}
          active={step1Done && !step2Done}
          summary={
            step2Done
              ? `${freshRawResult?.days_staged ?? status?.total_staged ?? 0} day(s) staged`
              : null
          }
        >
          <input
            type="file"
            accept=".gz"
            className={styles.fileInput}
            onChange={(event) => setDsFile(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className={styles.stepButton}
            disabled={!hrFile || !dsFile || rawUploading}
            onClick={handleUploadSummary}
          >
            {rawUploading ? 'Uploading…' : 'Upload Summary Data'}
          </button>
          {rawUploadError && <p className={styles.stepError}>{rawUploadError}</p>}
        </WizardStep>

        <WizardStep
          number={3}
          title="Upload Survey Responses"
          done={step3Done}
          active={step2Done && !step3Done}
          summary={
            step3Done
              ? `${freshSurveyResult?.dates_matched ?? status?.days.filter((d) => d.real_stress !== null).length ?? 0} day(s) matched with a real response`
              : null
          }
        >
          <p className={styles.surveyQuestion}>{STRESS_QUESTION}</p>
          <input
            type="file"
            accept=".csv"
            className={styles.fileInput}
            onChange={(event) => setEmaFile(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className={styles.stepButton}
            disabled={!emaFile || surveyUploading}
            onClick={handleUploadSurvey}
          >
            {surveyUploading ? 'Uploading…' : 'Upload Survey Responses'}
          </button>
          {surveyUploadError && <p className={styles.stepError}>{surveyUploadError}</p>}
        </WizardStep>
      </div>

      {step2Done && step3Done && (
        <div className={styles.revealSection}>
          <div className={styles.revealHeader}>
            <h3 className={styles.revealTitle}>Reveal</h3>
            <button
              type="button"
              className={styles.revealButton}
              disabled={revealing || allRevealed}
              onClick={handleReveal}
            >
              {allRevealed ? 'All staged days revealed' : revealing ? 'Revealing…' : 'Reveal Next Day'}
            </button>
          </div>
          {revealError && <p className={styles.stepError}>{revealError}</p>}

          {chartRows.length > 0 && (
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
                  <XAxis dataKey="feature_date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis
                    yAxisId="hr"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    width={40}
                    tickFormatter={(value: number) => `${Math.round(value)}`}
                  />
                  {showRiskAxis && (
                    <YAxis
                      yAxisId="risk"
                      orientation="right"
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      width={44}
                      domain={[0, 1]}
                      tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                    />
                  )}
                  <Tooltip content={RevealTooltip} />
                  <Line
                    yAxisId="hr"
                    type="monotone"
                    dataKey="hr_mean_full"
                    name="Heart rate"
                    stroke="var(--brand-blue)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive
                  />
                  {chartRows.length >= 2 && (
                    <Line
                      yAxisId="hr"
                      type="monotone"
                      dataKey="baseline"
                      name="Personal baseline"
                      stroke="var(--text-secondary)"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive
                    />
                  )}
                  {showRiskAxis && (
                    <Line
                      yAxisId="risk"
                      type="monotone"
                      dataKey="risk_probability"
                      name="Risk"
                      stroke="var(--brand-purple)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                      isAnimationActive
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {lastRow && (
            <div className={dayNumber === 7 ? styles.statusLineHighlight : styles.statusLine}>
              <p className={styles.statusText}>
                {dayNumber <= 6 &&
                  `Day ${dayNumber}: heart rate averaged ${
                    lastRow.hr_mean_full !== null ? lastRow.hr_mean_full.toFixed(1) : 'an unknown'
                  } bpm. Still building baseline — need ${7 - dayNumber} more day${
                    7 - dayNumber === 1 ? '' : 's'
                  } before a personalized assessment is possible.`}
                {dayNumber === 7 &&
                  "Day 7: baseline established. The system now has enough history to compare future days against this caregiver's own normal pattern."}
                {dayNumber >= 8 &&
                  `Day ${dayNumber}: risk assessed at ${
                    lastRow.risk_probability !== null ? (lastRow.risk_probability * 100).toFixed(1) : '—'
                  }%. ${
                    lastRow.top_shap_factor ? translateShapFactor(lastRow.top_shap_factor) : 'No dominant factor'
                  } was the strongest contributing signal today.`}
              </p>
              {dayNumber >= 8 && (
                <button
                  type="button"
                  className={styles.viewProfileButton}
                  onClick={() => {
                    setPendingCaregiverId(caregiverId)
                    setActiveTab('caregiver-profiles')
                  }}
                >
                  View in Caregiver Profile →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WizardStep({
  number,
  title,
  done,
  active = true,
  summary,
  children,
}: {
  number: number
  title: string
  done: boolean
  active?: boolean
  summary: string | null
  children: React.ReactNode
}) {
  return (
    <div className={`${styles.step} ${done ? styles.stepDone : ''} ${!active && !done ? styles.stepInactive : ''}`}>
      <div className={styles.stepHeader}>
        <span className={styles.stepBadge}>{done ? '✓' : number}</span>
        <p className={styles.stepTitle}>{title}</p>
      </div>
      {done && summary ? (
        <p className={styles.stepSummary}>{summary}</p>
      ) : active ? (
        <div className={styles.stepBody}>{children}</div>
      ) : (
        <p className={styles.stepSummary}>Complete the previous step first.</p>
      )}
    </div>
  )
}

export default function DemoControl() {
  const { caregivers, caregiversLoading, caregiversError } = useDeteriorationData()
  const [selectedId, setSelectedId] = useState('')

  if (caregiversLoading) {
    return <p className={styles.status}>Loading caregivers…</p>
  }
  if (caregiversError) {
    return (
      <div className={styles.errorBox} role="alert">
        <Icon name="warning" size={18} className={styles.errorIcon} />
        <p className={styles.errorText}>{caregiversError}</p>
      </div>
    )
  }

  return (
    <div>
      <p className={styles.intro}>
        Stage real historical data for a caregiver, then reveal it one day at a time to demo how the
        risk model builds up its assessment.
      </p>
      <CaregiverSearchSelect caregivers={caregivers} selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId && <DemoControlWizard key={selectedId} caregiverId={selectedId} />}
    </div>
  )
}
