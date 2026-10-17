import { lazy, Suspense, useEffect, useState } from 'react'
import Icon from '../../../shared/components/Icon'
import { useDeteriorationData } from '../context/useDeteriorationData'
import {
  generateRedistributionRecommendations,
  getRedistributionRecommendations,
  markRedistributionRecommendationReviewed,
} from '../services/api'
import type { RedistributionRecommendation } from '../services/api'
import type { RiskTier } from './CaregiverAvatar3D'
import styles from './Redistribution.module.css'

// Code-split, deduped by Vite with every other import of this module.
// This tab isn't the default landing view (Overview is, and it's also
// role-gated to admin/supervisor), so this doesn't reintroduce the
// "avatar loads on first visit" concern.
const CaregiverAvatar3D = lazy(() => import('./CaregiverAvatar3D'))

// Same thresholds used everywhere else in this module. Every risk_probability
// on this tab is a real number (never null — flagged/suggested caregivers
// both always have a latest scored value), but this still accepts null for
// consistency with the same helper's signature elsewhere.
function riskTierOf(probability: number | null): RiskTier {
  if (probability === null) return 'neutral'
  if (probability > 0.5) return 'high'
  if (probability >= 0.35) return 'moderate'
  return 'low'
}

function riskBadgeClass(tier: RiskTier): string {
  if (tier === 'high') return styles.riskBadgeHigh
  if (tier === 'moderate') return styles.riskBadgeModerate
  if (tier === 'low') return styles.riskBadgeLow
  return styles.riskBadgeNeutral
}

function statusBadgeClass(status: RedistributionRecommendation['status']): string {
  if (status === 'reviewed') return styles.statusReviewed
  if (status === 'dismissed') return styles.statusDismissed
  return styles.statusPending
}

// Deliberately NOT the shared WardChip component — that component's
// contract is specifically about the `ward` field (used everywhere else
// in this module) and its "No ward listed" copy. real_unit is a different,
// real field with its own null copy ("Unit not recorded"); reusing WardChip
// here would blur that distinction back together, which is the exact bug
// this fix is undoing.
function UnitBadge({ unit }: { unit: string | null }) {
  return <span className={styles.unitBadge}>{unit ?? 'Unit not recorded'}</span>
}

// A small avatar + name + unit + risk% identity block, reused for both the
// flagged caregiver (top row) and the suggested candidate (sub-block) —
// same four facts, different visual weight depending on where it's used.
function CaregiverIdentity({
  name,
  unit,
  riskProbability,
  avatarSize,
}: {
  name: string | null
  unit: string | null
  // Null only in practice if a live lookup genuinely found no scored row
  // for this caregiver at read time — shown as "—" rather than a
  // fabricated 0%.
  riskProbability: number | null
  avatarSize: number
}) {
  const tier = riskTierOf(riskProbability)
  return (
    <div className={styles.identity}>
      <Suspense fallback={<div className={styles.avatarFallback} style={{ width: avatarSize, height: avatarSize }} />}>
        <CaregiverAvatar3D riskTier={tier} width={avatarSize} height={avatarSize} />
      </Suspense>
      <div className={styles.identityText}>
        <p className={styles.identityName}>{name ?? 'Unknown caregiver'}</p>
        <div className={styles.badgeRow}>
          <UnitBadge unit={unit} />
          <span className={`${styles.riskBadge} ${riskBadgeClass(tier)}`}>
            {riskProbability === null ? '—' : `${(riskProbability * 100).toFixed(1)}%`}
          </span>
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({
  rec,
  onMarkReviewed,
  reviewing,
}: {
  rec: RedistributionRecommendation
  onMarkReviewed: () => void
  reviewing: boolean
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTopRow}>
        <CaregiverIdentity
          name={rec.flagged_caregiver_name}
          unit={rec.flagged_unit}
          riskProbability={rec.flagged_risk_probability}
          avatarSize={40}
        />
        <span className={`${styles.statusBadge} ${statusBadgeClass(rec.status)}`}>{rec.status}</span>
      </div>

      <p className={styles.reasoning}>{rec.reasoning}</p>

      {rec.suggested_caregiver_id ? (
        <div className={styles.suggestedBlock}>
          <p className={styles.suggestedLabel}>Suggested replacement</p>
          <CaregiverIdentity
            name={rec.suggested_caregiver_name}
            unit={rec.suggested_unit}
            riskProbability={rec.suggested_risk_probability}
            avatarSize={32}
          />
        </div>
      ) : (
        <p className={styles.noMatch}>No match found.</p>
      )}

      {rec.status === 'pending' ? (
        <div className={styles.reviewFooter}>
          <button type="button" className={styles.reviewButton} onClick={onMarkReviewed} disabled={reviewing}>
            {reviewing ? 'Marking…' : 'Mark Reviewed'}
          </button>
          <p className={styles.reviewCaption}>
            Reviewing acknowledges this recommendation. Reassigning a caregiver&apos;s supervisor is a separate
            action, not yet automated.
          </p>
        </div>
      ) : (
        rec.reviewed_at && (
          <p className={styles.reviewedMeta}>Reviewed {new Date(rec.reviewed_at).toLocaleDateString()}</p>
        )
      )}
    </div>
  )
}

// Not part of the shared DeteriorationDataContext cache — unlike
// everything else there (fetched once, read many times), this data
// mutates on every Generate/Mark Reviewed action, so it lives entirely in
// this component's own local state with explicit refetches after each
// mutation, rather than forcing it into the "fetch once, cache forever"
// pattern the rest of this module uses for genuinely static-per-session
// data.
export default function Redistribution() {
  const { me } = useDeteriorationData()

  const [recommendations, setRecommendations] = useState<RedistributionRecommendation[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateSummary, setGenerateSummary] = useState<{
    flagged: number
    matched: number
    unmatched: number
  } | null>(null)

  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)

  // Reusable "refetch and reset loading/error" helper — called only from
  // event-handler contexts (handleGenerate's .then() below), never
  // directly inside a useEffect body, since calling something that
  // synchronously sets state from inside an effect is exactly the
  // set-state-in-effect anti-pattern this module has run into before.
  const loadRecommendations = () => {
    setLoading(true)
    setError(null)
    getRedistributionRecommendations()
      .then((result) => setRecommendations(result.recommendations))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load recommendations.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let isMounted = true
    // Deliberately not calling loadRecommendations() here — its
    // synchronous setLoading(true)/setError(null) resets are redundant on
    // mount anyway (those are already this state's initial values) and
    // would trip the same rule. This inline fetch only sets state from
    // async callbacks.
    getRedistributionRecommendations()
      .then((result) => {
        if (isMounted) setRecommendations(result.recommendations)
      })
      .catch((err: unknown) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load recommendations.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const handleGenerate = () => {
    setGenerating(true)
    setGenerateError(null)
    setGenerateSummary(null)
    generateRedistributionRecommendations()
      .then((result) => {
        setGenerateSummary({
          flagged: result.flagged_count,
          matched: result.matched_count,
          unmatched: result.unmatched_count,
        })
        loadRecommendations()
      })
      .catch((err: unknown) => {
        setGenerateError(err instanceof Error ? err.message : 'Failed to generate recommendations.')
      })
      .finally(() => setGenerating(false))
  }

  const handleMarkReviewed = (id: string) => {
    setReviewingId(id)
    setReviewError(null)
    markRedistributionRecommendationReviewed(id)
      .then((updated) => {
        setRecommendations((prev) =>
          prev ? prev.map((rec) => (rec.id === id ? { ...rec, ...updated } : rec)) : prev,
        )
      })
      .catch((err: unknown) => {
        setReviewError(err instanceof Error ? err.message : 'Failed to mark reviewed.')
      })
      .finally(() => setReviewingId(null))
  }

  return (
    <div>
      <h2 className={styles.title}>Redistribution Recommendations</h2>
      <p className={styles.intro}>
        {me?.role === 'admin'
          ? 'Evaluates every historical caregiver for sustained elevated risk (3 or more of their last 5 assessments) and suggests a lower-risk same-unit replacement where one exists.'
          : 'Evaluates your own caregivers for sustained elevated risk. A suggested replacement can come from any unit, including a caregiver supervised by someone else.'}
      </p>

      <div className={styles.actionsRow}>
        <button type="button" className={styles.generateButton} onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate Recommendations'}
        </button>
        {generateSummary && (
          <p className={styles.summaryText}>
            Flagged {generateSummary.flagged} caregiver{generateSummary.flagged === 1 ? '' : 's'} —{' '}
            {generateSummary.matched} matched, {generateSummary.unmatched} unmatched.
          </p>
        )}
      </div>
      {generateError && (
        <div className={styles.errorBox} role="alert">
          <Icon name="warning" size={18} className={styles.errorIcon} />
          <p className={styles.errorText}>{generateError}</p>
        </div>
      )}

      {loading ? (
        <p className={styles.status}>Loading recommendations…</p>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <Icon name="warning" size={18} className={styles.errorIcon} />
          <p className={styles.errorText}>{error}</p>
        </div>
      ) : !recommendations || recommendations.length === 0 ? (
        <p className={styles.status}>
          No recommendations yet. Click &quot;Generate Recommendations&quot; to run an evaluation.
        </p>
      ) : (
        <div className={styles.list}>
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              reviewing={reviewingId === rec.id}
              onMarkReviewed={() => handleMarkReviewed(rec.id)}
            />
          ))}
        </div>
      )}

      {reviewError && (
        <div className={styles.errorBox} role="alert">
          <Icon name="warning" size={18} className={styles.errorIcon} />
          <p className={styles.errorText}>{reviewError}</p>
        </div>
      )}
    </div>
  )
}
