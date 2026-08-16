import type { ReactNode } from 'react'
import { Card } from './Card'
import cls from './styles.module.css'

export function ChartCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  children?: ReactNode
}) {
  return (
    <Card
      title={
        <div className={cls.chartHeader}>
          <div>
            <div className={cls.chartTitle}>{title}</div>
            {subtitle ? <div className={cls.chartSubtitle}>{subtitle}</div> : null}
          </div>
          {right ? <div className={cls.chartRight}>{right}</div> : null}
        </div>
      }
    >
      <div className={cls.chartBody}>
        {children ?? <div className={cls.chartPlaceholder}>Chart placeholder</div>}
      </div>
    </Card>
  )
}

