import { translateShapFactor } from '../constants'
import type { SimulateFactor } from '../services/api'
import styles from './ShapFactorsList.module.css'

interface ShapFactorsListProps {
  factors: SimulateFactor[]
  // Applied per direction group now (up to `limit` increasing + up to
  // `limit` reducing), not to the combined top-N-by-magnitude list as
  // before — splitting into two groups (see below) means a caregiver
  // whose top factors happened to be dominated by one direction would
  // otherwise show an empty second group even when reducing (or
  // increasing) factors exist further down the list.
  limit?: number
}

// Extracted out of RiskAnalysis so Caregiver Profiles' "Explanations"
// sub-tab uses the exact same plain-language mapping instead of a second
// copy. Redesigned per the dashboard-redesign "Why this assessment?"
// change: two visually separate groups by direction rather than one flat
// list with an inline "Increases risk"/"Decreases risk" label per row —
// and no UI copy implying causation ("causes...") anywhere here. SHAP
// values describe how a feature contributed to *this model's* output for
// this day, not a causal claim about the caregiver.
export default function ShapFactorsList({ factors, limit = 3 }: ShapFactorsListProps) {
  const increasing = factors.filter((factor) => factor.direction === 'increases_risk').slice(0, limit)
  const reducing = factors.filter((factor) => factor.direction === 'decreases_risk').slice(0, limit)

  if (increasing.length === 0 && reducing.length === 0) {
    return null
  }

  return (
    <div>
      <p className={styles.disclaimer}>
        How each factor contributed to the model&apos;s prediction — not a diagnosis.
      </p>

      <div className={styles.groups}>
        {increasing.length > 0 && (
          <div className={`${styles.group} ${styles.groupIncreasing}`}>
            <p className={`${styles.groupHeading} ${styles.groupHeadingIncreasing}`}>
              Factors increasing risk
            </p>
            <div className={styles.factorList}>
              {increasing.map((factor) => (
                <div key={factor.feature} className={styles.factorRow}>
                  <span className={`${styles.factorDot} ${styles.factorDotIncreasing}`} />
                  <span className={styles.factorLabel}>{translateShapFactor(factor.feature)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {reducing.length > 0 && (
          <div className={`${styles.group} ${styles.groupReducing}`}>
            <p className={`${styles.groupHeading} ${styles.groupHeadingReducing}`}>
              Factors reducing risk
            </p>
            <div className={styles.factorList}>
              {reducing.map((factor) => (
                <div key={factor.feature} className={styles.factorRow}>
                  <span className={`${styles.factorDot} ${styles.factorDotReducing}`} />
                  <span className={styles.factorLabel}>{translateShapFactor(factor.feature)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
