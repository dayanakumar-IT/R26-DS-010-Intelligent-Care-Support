import { Play, Square } from 'lucide-react'
import Button from '../../../shared/components/Button'
import styles from '../styles/dashboard.module.css'

interface PlayToggleButtonProps {
  playing: boolean
  disabled?: boolean
  onToggle: () => void
  className?: string
}

/** The single ▶ Play / ■ Stop toggle used everywhere a recording plays. */
export default function PlayToggleButton({
  playing,
  disabled = false,
  onToggle,
  className,
}: PlayToggleButtonProps) {
  return (
    <Button
      variant="secondary"
      disabled={disabled}
      onClick={onToggle}
      className={`${styles.tableActionButton} ${className ?? ''}`}
    >
      {playing ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      {playing ? 'Stop' : 'Play'}
    </Button>
  )
}
