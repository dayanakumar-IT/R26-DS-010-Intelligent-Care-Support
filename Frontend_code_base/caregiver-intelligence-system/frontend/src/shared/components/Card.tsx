import type { HTMLAttributes, ReactNode } from 'react'
import cls from './styles.module.css'

export function Card({
  title,
  children,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { title?: ReactNode }) {
  return (
    <div className={[cls.card, className].filter(Boolean).join(' ')} {...props}>
      {title ? <div className={cls.cardTitle}>{title}</div> : null}
      <div className={cls.cardBody}>{children}</div>
    </div>
  )
}

