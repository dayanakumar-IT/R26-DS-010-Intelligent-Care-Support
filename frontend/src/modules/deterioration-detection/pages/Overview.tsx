import Icon from '../../../shared/components/Icon'
import type { IconName } from '../../../shared/components/Icon'
import CaregiverProfiles from '../components/CaregiverProfiles'
import DemoControl from '../components/DemoControl'
import OverviewSummary from '../components/OverviewSummary'
import Redistribution from '../components/Redistribution'
import RiskAnalysis from '../components/RiskAnalysis'
import Trends from '../components/Trends'
import { useDeteriorationData } from '../context/useDeteriorationData'
import type { UserRole } from '../../../types/user'
// Side-effect import: defines the module's --risk-*/--transition-fast
// custom properties globally (CSS Modules don't scope :root blocks). This
// is the module's one always-mounted page component, so importing here
// guarantees the tokens exist before any tab's styles need them.
import '../styles/tokens.css'
import styles from './Overview.module.css'

interface TabDef {
  id: string
  label: string
  icon: IconName
  // Omitted = visible to every role (matches the other 4 tabs' existing,
  // unconditional visibility — not something this change touches). Only
  // Redistribution is actually gated right now.
  roles?: UserRole[]
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: 'activity' },
  { id: 'risk-analysis', label: 'Risk Analysis', icon: 'bar-chart-3' },
  { id: 'caregiver-profiles', label: 'Caregiver Profiles', icon: 'users' },
  { id: 'trends', label: 'Trends', icon: 'trending-up' },
  { id: 'redistribution', label: 'Redistribution', icon: 'users', roles: ['admin', 'supervisor'] },
  { id: 'demo-control', label: 'Demo Control', icon: 'settings', roles: ['admin'] },
]

export default function Overview() {
  const {
    activeTab,
    setActiveTab,
    me,
    meLoading,
    meError,
    caregivers,
    caregiversLoading,
    caregiversError,
    modelPerformance,
    modelPerformanceLoading,
    modelPerformanceError,
    riskSummary,
    riskSummaryLoading,
    riskSummaryError,
  } = useDeteriorationData()

  // Same "all three or nothing" observed behavior as before this data moved
  // into the shared context — me/caregivers/modelPerformance were always
  // fetched together for this tab's cards, just via one combined
  // Promise.all previously. Now they're three independently-cached context
  // slices, combined here at render time instead of at fetch time.
  const overviewLoading = meLoading || caregiversLoading || modelPerformanceLoading
  const overviewError = meError ?? caregiversError ?? modelPerformanceError
  const overviewReady = !overviewLoading && !overviewError && me !== null && modelPerformance !== null

  // Only Redistribution is actually restricted right now — every other
  // tab keeps its existing unconditional visibility (tab.roles is
  // undefined for them, so the filter passes them through).
  const visibleTabs = TABS.filter((tab) => !tab.roles || (me && tab.roles.includes(me.role)))

  return (
    <div>
      <div className={styles.tabRow} role="tablist" aria-label="Deterioration Detection views">
        {visibleTabs.map((tab) => (
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
        {activeTab === 'overview' ? (
          overviewLoading ? (
            <p className={styles.status}>Loading overview…</p>
          ) : overviewError ? (
            <div className={styles.errorBox} role="alert">
              <Icon name="warning" size={18} className={styles.errorIcon} />
              <p className={styles.errorText}>{overviewError}</p>
            </div>
          ) : overviewReady ? (
            <OverviewSummary
              me={me}
              caregivers={caregivers}
              modelPerformance={modelPerformance}
              riskSummary={riskSummary}
              riskSummaryLoading={riskSummaryLoading}
              riskSummaryError={riskSummaryError}
            />
          ) : null
        ) : activeTab === 'risk-analysis' ? (
          <RiskAnalysis />
        ) : activeTab === 'caregiver-profiles' ? (
          <CaregiverProfiles />
        ) : activeTab === 'trends' ? (
          <Trends />
        ) : activeTab === 'redistribution' ? (
          <Redistribution />
        ) : (
          <DemoControl />
        )}
      </div>
    </div>
  )
}
