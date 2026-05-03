import type { RouteObject } from 'react-router-dom'
import { SignVitalsPage } from './pages/SignVitalsPage'

export const SignVitalsRoutes: RouteObject[] = [
  { path: '/sign-vitals', element: <SignVitalsPage /> },
  { path: '/reports', element: <SignVitalsPage mode="reports" /> },
  { path: '/settings', element: <SignVitalsPage mode="settings" /> },
]

