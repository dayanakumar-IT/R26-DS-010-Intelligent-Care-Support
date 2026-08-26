import { useState } from 'react'
import Icon from '../../../shared/components/Icon'
import type { IconName } from '../../../shared/components/Icon'
import styles from './Overview.module.css'

interface TabDef {
  id: string
  label: string
  icon: IconName
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: 'activity' },
  { id: 'risk-analysis', label: 'Risk Analysis', icon: 'bar-chart-3' },
  { id: 'caregiver-profiles', label: 'Caregiver Profiles', icon: 'users' },
  { id: 'trends', label: 'Trends', icon: 'trending-up' },
]

export default function Overview() {
  const [activeTab, setActiveTab] = useState<string>(TABS[0]!.id)
  const activeLabel = TABS.find((tab) => tab.id === activeTab)?.label ?? ''

  return (
    <div>
      <div className={styles.tabRow} role="tablist" aria-label="Deterioration Detection views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.panel} role="tabpanel">
        <p className={styles.placeholder}>
          {activeLabel} — placeholder content, wired up in a later step.
        </p>
      </div>
    </div>
  )
}
