import type { HTMLAttributes, ReactNode } from 'react'
import cls from './styles.module.css'

export function Card({
  title,
  titleAside,
  children,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { title?: ReactNode; titleAside?: ReactNode }) {
  return (
    <div className={[cls.card, className].filter(Boolean).join(' ')} {...props}>
      {title ? (
        <div className={cls.cardTitle}>
          <span className={cls.cardTitleMain}>{title}</span>
          {titleAside ? <span className={cls.cardTitleAside}>{titleAside}</span> : null}
        </div>
      ) : null}
      <div className={cls.cardBody}>{children}</div>
    </div>
  )
}

