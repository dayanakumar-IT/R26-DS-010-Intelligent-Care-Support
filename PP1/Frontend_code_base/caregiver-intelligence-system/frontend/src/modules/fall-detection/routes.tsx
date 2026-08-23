import type { RouteObject } from 'react-router-dom'
import { FallDetectionPage } from './pages/FallDetectionPage'

export const FallDetectionRoutes: RouteObject[] = [
  { path: '/fall-detection', element: <FallDetectionPage /> },
]

