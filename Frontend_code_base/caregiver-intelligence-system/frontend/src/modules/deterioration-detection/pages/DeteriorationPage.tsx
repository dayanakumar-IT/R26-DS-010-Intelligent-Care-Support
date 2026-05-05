import { Card } from '../../../shared/components/Card'
import { Badge } from '../../../shared/components/Badge'
import cls from '../../../pages/pages.module.css'

export function DeteriorationPage() {
  return (
    <div className={cls.page}>
      <div className={cls.pageHeader}>
        <div>
          <div className={cls.pageTitle}>Deterioration Detection</div>
          <div className={cls.pageSubtitle}>
            Placeholder page for module routing.
          </div>
        </div>
        <Badge tone="warning">Beta</Badge>
      </div>
      <Card title="Coming soon">
        Connect this page to API + charts when backend is ready.
      </Card>
    </div>
  )
}

