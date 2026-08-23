import { Badge } from '../shared/components/Badge'
import { Card } from '../shared/components/Card'
import { ChartCard } from '../shared/components/ChartCard'
import { Table } from '../shared/components/Table'
import cls from './pages.module.css'

export function Home() {
  const rows = [
    { name: 'Patient A', status: 'Stable', risk: 'Low' },
    { name: 'Patient B', status: 'Monitor', risk: 'Medium' },
    { name: 'Patient C', status: 'Alert', risk: 'High' },
  ] as const

  return (
    <div className={cls.page}>
      <div className={cls.pageHeader}>
        <div>
          <div className={cls.pageTitle}>Dashboard</div>
          <div className={cls.pageSubtitle}>
            Quick view of patient signals and caregiver actions.
          </div>
        </div>
        <Badge tone="info">Live</Badge>
      </div>

      <div className={cls.grid3}>
        <Card title="Deterioration">
          <div className={cls.metricRow}>
            <div className={cls.metricValue}>3</div>
            <div className={cls.metricLabel}>signals to review</div>
          </div>
        </Card>
        <Card title="Falls">
          <div className={cls.metricRow}>
            <div className={cls.metricValue}>0</div>
            <div className={cls.metricLabel}>events today</div>
          </div>
        </Card>
        <Card title="Voice Logs">
          <div className={cls.metricRow}>
            <div className={cls.metricValue}>12</div>
            <div className={cls.metricLabel}>entries</div>
          </div>
        </Card>
      </div>

      <div className={cls.grid2}>
        <ChartCard title="Vitals trend" subtitle="Placeholder visualization" />
        <Card title="Recent patients">
          <Table
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'status', header: 'Status' },
              { key: 'risk', header: 'Risk', align: 'right' },
            ]}
            rows={[...rows]}
            getRowKey={(r) => r.name}
          />
        </Card>
      </div>
    </div>
  )
}

