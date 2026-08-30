import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { formatLiveClock } from '../utils/format'
import styles from '../styles/dashboard.module.css'

export default function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const { date, time } = formatLiveClock(now)

  return (
    <div className={styles.liveClock} aria-live="polite" aria-atomic="true">
      <CalendarClock size={16} aria-hidden="true" />
      <div className={styles.liveClockText}>
        <span className={styles.liveClockDate}>{date}</span>
        <span className={styles.liveClockTime}>{time}</span>
      </div>
    </div>
  )
}
