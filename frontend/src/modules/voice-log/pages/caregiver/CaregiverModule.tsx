import { useCallback, useEffect, useState } from 'react'
import { History, LayoutDashboard, Mic, Settings } from 'lucide-react'
import ModuleTabs, { TabPanel, type ModuleTabDef } from '../../components/ModuleTabs'
import { ToastProvider } from '../../components/Toast'
import type { Patient } from '../../types'
import type { User } from '../../../../types/user'
import { fetchPatients } from '../../services/scribeApi'
import DashboardTab from './tabs/DashboardTab'
import RecordTab from './tabs/RecordTab'
import HistoryTab from './tabs/HistoryTab'
import CaregiverSettingsTab from './tabs/CaregiverSettingsTab'

const TABS: ModuleTabDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'record', label: 'Record', icon: Mic },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface CaregiverModuleProps {
  user: User
  caregiverId: string
}

export default function CaregiverModule({ user, caregiverId }: CaregiverModuleProps) {
  const [activeTab, setActiveTab] = useState(TABS[0]!.id)
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<number | ''>('')

  useEffect(() => {
    let isMounted = true
    fetchPatients(caregiverId)
      .then((data) => {
        if (!isMounted) return
        setPatients(data)
        if (data.length > 0) {
          setSelectedPatientId((current) => current || data[0]!.id)
        }
      })
      .catch(() => {
        /* Record tab surfaces patient load errors */
      })
    return () => {
      isMounted = false
    }
  }, [caregiverId])

  const handleStartRecording = useCallback(() => {
    if (!selectedPatientId) return
    setActiveTab('record')
  }, [selectedPatientId])

  return (
    <ToastProvider>
      <div>
        <ModuleTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ariaLabel="Voice Log caregiver views"
        />
        <TabPanel>
          {activeTab === 'dashboard' && (
            <DashboardTab
              user={user}
              caregiverId={caregiverId}
              patients={patients}
              selectedPatientId={selectedPatientId}
              onPatientChange={setSelectedPatientId}
              onStartRecording={handleStartRecording}
            />
          )}
          {activeTab === 'record' && (
            <RecordTab
              caregiverId={caregiverId}
              user={user}
              patients={patients}
              selectedPatientId={selectedPatientId}
              onPatientChange={setSelectedPatientId}
              onPatientsLoaded={setPatients}
            />
          )}
          {activeTab === 'history' && <HistoryTab caregiverId={caregiverId} />}
          {activeTab === 'settings' && <CaregiverSettingsTab user={user} />}
        </TabPanel>
      </div>
    </ToastProvider>
  )
}
