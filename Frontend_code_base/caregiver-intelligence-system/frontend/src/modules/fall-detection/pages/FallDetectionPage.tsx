import { Card } from '../../../shared/components/Card'
import { Badge } from '../../../shared/components/Badge'
import cls from '../../../pages/pages.module.css'

export function FallDetectionPage() {
  return (
    <div className={cls.page}>
      <div className={cls.pageHeader}>
        <div>
          <div className={cls.pageTitle}>Fall Detection</div>
          <div className={cls.pageSubtitle}>Placeholder page for module routing.</div>
        </div>
        <Badge tone="success">Ready</Badge>
      </div>
      <Card title="Coming soon">Fall alerts + timeline UI goes here.</Card>
    </div>
  )
}

