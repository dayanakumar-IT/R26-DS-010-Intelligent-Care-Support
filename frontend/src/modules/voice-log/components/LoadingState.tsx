import styles from '../styles/dashboard.module.css'

interface LoadingStateProps {
  message?: string
}

export default function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <div className={styles.loadingState}>
      <span className={styles.loadingSpinner} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
