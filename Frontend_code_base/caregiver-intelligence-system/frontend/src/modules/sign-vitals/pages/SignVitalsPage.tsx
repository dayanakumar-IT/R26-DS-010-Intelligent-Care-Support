import { Card } from '../../../shared/components/Card'
import { Badge } from '../../../shared/components/Badge'
import cls from '../../../pages/pages.module.css'

export function SignVitalsPage({
  mode = 'vitals',
}: {
  mode?: 'vitals' | 'reports' | 'settings'
}) {
  const title =
    mode === 'reports' ? 'Reports' : mode === 'settings' ? 'Settings' : 'Sign & Vitals'
  const tone = mode === 'reports' ? 'info' : mode === 'settings' ? 'neutral' : 'success'

  return (
    <div className={cls.page}>
      <div className={cls.pageHeader}>
        <div>
          <div className={cls.pageTitle}>{title}</div>
          <div className={cls.pageSubtitle}>Placeholder page for module routing.</div>
        </div>
        <Badge tone={tone}>{mode}</Badge>
      </div>
      <Card title="Coming soon">
        {mode === 'vitals'
          ? 'Vitals capture + trends UI goes here.'
          : mode === 'reports'
            ? 'Reporting exports + summary views go here.'
            : 'Settings UI goes here.'}
      </Card>
    </div>
  )
}

