import type { HTMLAttributes } from 'react'
import cls from './styles.module.css'

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  const classes = [cls.badge, cls[`badge_${tone}`], className]
    .filter(Boolean)
    .join(' ')
  return <span className={classes} {...props} />
}

