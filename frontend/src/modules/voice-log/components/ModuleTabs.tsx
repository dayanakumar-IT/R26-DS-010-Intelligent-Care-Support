import type { LucideIcon } from 'lucide-react'
import tabStyles from '../styles/ModuleTabs.module.css'

export interface ModuleTabDef {
  id: string
  label: string
  icon: LucideIcon
}

interface ModuleTabsProps {
  tabs: ModuleTabDef[]
  activeTab: string
  onTabChange: (tabId: string) => void
  ariaLabel: string
}

export default function ModuleTabs({ tabs, activeTab, onTabChange, ariaLabel }: ModuleTabsProps) {
  return (
    <div className={tabStyles.tabRow} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${tabStyles.tab} ${isActive ? tabStyles.tabActive : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className={tabStyles.panel} role="tabpanel">
      {children}
    </div>
  )
}
