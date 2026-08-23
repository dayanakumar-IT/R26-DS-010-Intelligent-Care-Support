import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { VoiceLogLayout } from './components/VoiceLogLayout'
import { DashboardPage } from './pages/DashboardPage'
import { PatientsPage } from './pages/PatientsPage'
import { PatientProfilePage } from './pages/PatientProfilePage'
import { ADLReportsPage } from './pages/ADLReportsPage'
import { AlertsPage } from './pages/AlertsPage'
import { HandoverSummariesPage } from './pages/HandoverSummariesPage'
import { ReviewsPage } from './pages/ReviewsPage'
import { SettingsPage } from './pages/SettingsPage'

export const VoiceLogRoutes: RouteObject[] = [
  {
    path: '/voice-log',
    element: <VoiceLogLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'patients', element: <PatientsPage /> },
      { path: 'patients/:patientId', element: <PatientProfilePage /> },
      { path: 'adl-reports', element: <ADLReportsPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'handover-summaries', element: <HandoverSummariesPage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="dashboard" replace /> },
    ],
  },
]

