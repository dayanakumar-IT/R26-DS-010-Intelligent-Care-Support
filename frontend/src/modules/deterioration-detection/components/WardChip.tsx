import styles from './WardChip.module.css'

// A small, restrained, deterministic palette — not the raw saturated hex
// values used elsewhere for risk color, since a ward chip is pure visual
// variety/scannability, not a semantic signal. Hashed by ward name so the
// same ward always gets the same chip color everywhere it appears, without
// hardcoding known ward names.
const WARD_CHIP_PALETTE: { bg: string; fg: string }[] = [
  { bg: '#eff6ff', fg: '#1d4ed8' },
  { bg: '#faf5ff', fg: '#7c3aed' },
  { bg: '#ecfeff', fg: '#0e7490' },
  { bg: '#fff7ed', fg: '#c2410c' },
  { bg: '#fefce8', fg: '#a16207' },
  { bg: '#fdf2f8', fg: '#be185d' },
]

function wardChipColors(ward: string): { bg: string; fg: string } {
  let hash = 0
  for (let i = 0; i < ward.length; i++) {
    hash = (hash * 31 + ward.charCodeAt(i)) | 0
  }
  return WARD_CHIP_PALETTE[Math.abs(hash) % WARD_CHIP_PALETTE.length]!
}

interface WardChipProps {
  ward: string | null
  // Only passed where clicking should act (Caregiver Profiles' roster) —
  // everywhere else this renders as a plain, non-interactive chip.
  onClick?: () => void
}

// Shared everywhere a ward is shown, per the request — Overview's
// Requires Attention cards, Team Risk Heatmap's row labels and
// improved/increase callouts, Caregiver Profiles' roster/header,
// CaregiverSearchSelect's dropdown.
export default function WardChip({ ward, onClick }: WardChipProps) {
  if (!ward) {
    return <span className={styles.wardChipNeutral}>No ward listed</span>
  }

  const colors = wardChipColors(ward)
  const style = { background: colors.bg, color: colors.fg }

  if (onClick) {
    return (
      <button
        type="button"
        className={`${styles.wardChip} ${styles.wardChipClickable}`}
        style={style}
        onClick={(event) => {
          // This chip is sometimes nested inside a larger clickable row
          // (Caregiver Profiles' roster) — stop the click from also
          // triggering that row's own onClick (e.g. selecting a different
          // caregiver when the intent was only to filter by ward).
          event.stopPropagation()
          onClick()
        }}
        title={`Filter roster to ${ward}`}
      >
        {ward}
      </button>
    )
  }

  return (
    <span className={styles.wardChip} style={style}>
      {ward}
    </span>
  )
}
