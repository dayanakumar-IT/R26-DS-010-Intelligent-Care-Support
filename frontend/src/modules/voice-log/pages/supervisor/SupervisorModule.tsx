import { useState } from 'react'
import { Bell, LayoutDashboard, Settings, Users } from 'lucide-react'
import ModuleTabs, { TabPanel, type ModuleTabDef } from '../../components/ModuleTabs'
import { ToastProvider } from '../../components/Toast'
import type { User } from '../../../../types/user'
import DashboardTab from './tabs/DashboardTab'
import AlertsTab from './tabs/AlertsTab'
import PatientsTab from './tabs/PatientsTab'
import SupervisorSettingsTab from './tabs/SupervisorSettingsTab'

const TABS: ModuleTabDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface SupervisorModuleProps {
  user: User
}

export default function SupervisorModule({ user }: SupervisorModuleProps) {
  const [activeTab, setActiveTab] = useState(TABS[0]!.id)
  const [patientsTabPatientId, setPatientsTabPatientId] = useState<number | null>(null)

  const navigateToPatients = (patientId?: number) => {
    setPatientsTabPatientId(patientId ?? null)
    setActiveTab('patients')
  }

  return (
    <ToastProvider>
      <div>
        <ModuleTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ariaLabel="ADL Monitoring supervisor views"
        />
        <TabPanel>
          {activeTab === 'dashboard' && (
            <DashboardTab
              user={user}
              onNavigateToAlerts={() => setActiveTab('alerts')}
              onNavigateToPatients={navigateToPatients}
            />
          )}
          {activeTab === 'alerts' && <AlertsTab userId={user.id} />}
          {activeTab === 'patients' && (
            <PatientsTab initialPatientId={patientsTabPatientId} />
          )}
          {activeTab === 'settings' && <SupervisorSettingsTab user={user} />}
        </TabPanel>
      </div>
    </ToastProvider>
  )
}
