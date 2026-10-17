import type { AdlCategory } from '../types'
import { formatCategory } from '../utils/format'
import styles from '../styles/dashboard.module.css'

const CATEGORY_CLASS: Record<AdlCategory, string> = {
  medication: styles.catMedication,
  meal: styles.catMeal,
  fluid_intake: styles.catFluid,
  hygiene: styles.catHygiene,
  mobility: styles.catMobility,
  symptom: styles.catSymptom,
  mood: styles.catMood,
  nurse_check: styles.catNurse,
  family_visit: styles.catFamily,
}

interface CategoryBadgeProps {
  category: AdlCategory | string
}

export default function CategoryBadge({ category }: CategoryBadgeProps) {
  const key = category as AdlCategory
  const className = CATEGORY_CLASS[key] ?? styles.catDefault
  return (
    <span className={`${styles.categoryBadge} ${className}`}>
      {formatCategory(category)}
    </span>
  )
}
