import { useEffect, useState } from 'react'
import Icon from '../../../shared/components/Icon'
import CaregiverSearchSelect from './CaregiverSearchSelect'
import CollapsibleSection from './CollapsibleSection'
import RiskHistorySection from './RiskHistorySection'
import ShapFactorsList from './ShapFactorsList'
import { useDeteriorationData } from '../context/useDeteriorationData'
import type { RiskHistoryResponse, SimulateResponse } from '../services/api'
import styles from './RiskAnalysis.module.css'

// Same thresholds as the "high/moderate/low" split elsewhere in this module,
// expressed as fractions since risk_probability is 0-1 here (not the 0-100
// scale the backend's HIGH_RISK_THRESHOLD constant is documented against).
function riskBadgeClass(probability: number): string {
  if (probability > 0.66) return styles.badgeHigh
  if (probability >= 0.33) return styles.badgeModerate
  return styles.badgeLow
}

function predictionLabel(prediction: 0 | 1): string {
  return prediction === 1 ? 'Elevated stress predicted' : 'No elevated stress predicted'
}

// Rendered with key={caregiverId} by the parent, so switching caregivers
// remounts this fresh. Initial state is computed directly from the shared
// per-caregiver cache (see DeteriorationDataContext) rather than always
// starting at "loading": a caregiver viewed before renders instantly from
// cache with no network call and no loading flash; a new one starts loading
// and populates the cache for next time. Either way there's no synchronous
// setState reset inside the effect — the cache check happens once, at
// mount, via these useState initializers.
function CaregiverRiskPanel({ caregiverId }: { caregiverId: string }) {
  const { getCachedAssessment, fetchAndCacheAssessment, getCachedRiskHistory, fetchAndCacheRiskHistory } =
    useDeteriorationData()

  const cachedAssessment = getCachedAssessment(caregiverId)
  const cachedHistory = getCachedRiskHistory(caregiverId)

  const [assessment, setAssessment] = useState<SimulateResponse | null>(cachedAssessment ?? null)
  const [assessmentLoading, setAssessmentLoading] = useState(!cachedAssessment)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)

  const [history, setHistory] = useState<RiskHistoryResponse | null>(cachedHistory ?? null)
  const [historyLoading, setHistoryLoading] = useState(!cachedHistory)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    // Independent of the history call below — one failing must not block
    // or hide the other. Skipped entirely on a cache hit (see comment
    // above) rather than making a network call just to re-confirm data
    // we already have.
    if (!cachedAssessment) {
      fetchAndCacheAssessment(caregiverId)
        .then((result) => {
          if (isMounted) setAssessment(result)
        })
        .catch((err: unknown) => {
          if (isMounted) {
            setAssessmentError(err instanceof Error ? err.message : 'Failed to run assessment.')
          }
        })
        .finally(() => {
          if (isMounted) setAssessmentLoading(false)
        })
    }

    if (!cachedHistory) {
      fetchAndCacheRiskHistory(caregiverId)
        .then((result) => {
          if (isMounted) setHistory(result)
        })
        .catch((err: unknown) => {
          if (isMounted) {
            setHistoryError(err instanceof Error ? err.message : 'Failed to load risk history.')
          }
        })
        .finally(() => {
          if (isMounted) setHistoryLoading(false)
        })
    }

    return () => {
      isMounted = false
    }
    // This panel is remounted via key={caregiverId} whenever the selection
    // changes (see RiskAnalysis below), so this effect is intentionally
    // mount-once per caregiver; cachedAssessment/cachedHistory/
    // fetchAndCache* are only meant to be read once at that initial mount,
    // not re-triggered by every context re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caregiverId])

  return (
    <>
      <CollapsibleSection title="Current Assessment">
        {assessmentLoading ? (
          <p className={styles.status}>Running assessment…</p>
        ) : assessmentError ? (
          <div className={styles.errorBox} role="alert">
            <Icon name="warning" size={18} className={styles.errorIcon} />
            <p className={styles.errorText}>{assessmentError}</p>
          </div>
        ) : assessment ? (
          <div className={styles.assessmentCard}>
            <div className={styles.assessmentHeader}>
              <span className={`${styles.badge} ${riskBadgeClass(assessment.risk_probability)}`}>
                {(assessment.risk_probability * 100).toFixed(1)}%
              </span>
              <div>
                <p className={styles.assessmentPrediction}>
                  {predictionLabel(assessment.risk_prediction)}
                </p>
                <p className={styles.assessmentDate}>as of {assessment.feature_date}</p>
              </div>
            </div>
          </div>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection title="Why this assessment?">
        {assessmentLoading ? (
          <p className={styles.status}>Running assessment…</p>
        ) : assessmentError ? (
          <p className={styles.status}>Unavailable — see Current Assessment above.</p>
        ) : assessment ? (
          <ShapFactorsList factors={assessment.all_factors} />
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection title="Risk History">
        {historyLoading ? (
          <p className={styles.status}>Loading risk history…</p>
        ) : historyError ? (
          <div className={styles.errorBox} role="alert">
            <Icon name="warning" size={18} className={styles.errorIcon} />
            <p className={styles.errorText}>{historyError}</p>
          </div>
        ) : history ? (
          <RiskHistorySection history={history} caregiverId={caregiverId} />
        ) : null}
      </CollapsibleSection>
    </>
  )
}

export default function RiskAnalysis() {
  // Reused from context, not fetched again here — this is exactly the
  // duplicate GET /caregivers call this refactor was meant to eliminate:
  // previously RiskAnalysis fetched its own copy independently of
  // Overview's, so every visit to this tab hit the network again.
  const { caregivers, caregiversLoading, caregiversError, pendingCaregiverId, setPendingCaregiverId } =
    useDeteriorationData()
  // Read once from any pending cross-tab navigation (e.g. a "View
  // Assessment" button on Overview) — see contextDefinition.ts.
  const [selectedId, setSelectedId] = useState<string>(() => pendingCaregiverId ?? '')

  useEffect(() => {
    if (pendingCaregiverId !== null) setPendingCaregiverId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // No effect needed to "auto-select the first caregiver once loaded":
  // computed directly at render time instead, so there's no state to sync
  // when caregivers arrives.
  const effectiveSelectedId = selectedId || caregivers[0]?.id || ''

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
      <CaregiverSearchSelect
        caregivers={caregivers}
        selectedId={effectiveSelectedId}
        onSelect={setSelectedId}
      />

      {effectiveSelectedId && (
        <CaregiverRiskPanel key={effectiveSelectedId} caregiverId={effectiveSelectedId} />
      )}
    </div>
  )
}
