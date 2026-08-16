import type { RouteObject } from 'react-router-dom'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { CaregiverDetailPage } from './pages/CaregiverDetailPage'
import { DeteriorationPage } from './pages/DeteriorationPage'
import { TeamGraphPage } from './pages/TeamGraphPage'
import { WorkloadRedistributionPage } from './pages/WorkloadRedistributionPage'

export const DeteriorationRoutes: RouteObject[] = [
  {
    path: 'deterioration/caregiver/:id',
    element: <CaregiverDetailPage />,
  },
  {
    path: 'deterioration/redistribute',
    element: <WorkloadRedistributionPage />,
  },
  {
    path: 'deterioration/graph',
    element: <TeamGraphPage />,
  },
  {
    path: 'deterioration/analytics',
    element: <AnalyticsPage />,
  },
  {
    path: 'deterioration',
    element: <DeteriorationPage />,
  },
]
