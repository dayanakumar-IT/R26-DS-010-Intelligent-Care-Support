import { Card } from '../../../shared/components/Card'
import { Badge } from '../../../shared/components/Badge'
import cls from '../../../pages/pages.module.css'

export function VoiceLogPage() {
  return (
    <div className={cls.page}>
      <div className={cls.pageHeader}>
        <div>
          <div className={cls.pageTitle}>Voice Log</div>
          <div className={cls.pageSubtitle}>Placeholder page for module routing.</div>
        </div>
        <Badge tone="info">Module</Badge>
      </div>
      <Card title="Coming soon">Voice log capture + analysis UI goes here.</Card>
    </div>
  )
}

