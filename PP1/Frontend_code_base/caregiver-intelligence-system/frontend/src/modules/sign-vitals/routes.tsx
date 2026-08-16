import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { SignVitalsLayout } from './layout/SignVitalsLayout'
import { AssessmentReportPage } from './pages/AssessmentReportPage'
import { NoCameraGamePage } from './pages/NoCameraGamePage'
import { ParkinsonsVitalsPage } from './pages/ParkinsonsVitalsPage'
import { RewardsPage } from './pages/RewardsPage'
import { SignLanguageLearnPage } from './pages/SignLanguageLearnPage'
import { SignReviewPage } from './pages/SignReviewPage'
import { SignVitalsDashboardPage } from './pages/SignVitalsDashboardPage'

export const SignVitalsRoutes: RouteObject[] = [
  {
    path: 'sign-vitals',
    element: <SignVitalsLayout />,
    children: [
      { index: true, element: <SignVitalsDashboardPage /> },
      /* Internal module screens — no sidebar entries */
      { path: 'sign-live', element: <SignLanguageLearnPage /> },
      { path: 'sign-game', element: <NoCameraGamePage /> },
      { path: 'nonverbal-vitals', element: <ParkinsonsVitalsPage /> },
      { path: 'assessment', element: <AssessmentReportPage /> },
      { path: 'rewards', element: <RewardsPage /> },
      { path: 'review', element: <SignReviewPage /> },
      /* Legacy paths */
      { path: 'learn', element: <Navigate to="/sign-vitals/sign-live" replace /> },
      { path: 'game', element: <Navigate to="/sign-vitals/sign-game" replace /> },
      { path: 'parkinsons', element: <Navigate to="/sign-vitals/nonverbal-vitals" replace /> },
    ],
  },
]
