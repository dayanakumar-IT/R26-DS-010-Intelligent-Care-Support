import { Navigate, createBrowserRouter } from 'react-router-dom'
import { MainLayout } from './layout/MainLayout'
import { Home } from '../pages/Home'
import { Login } from '../pages/Login'
import { NotFound } from '../pages/NotFound'
import { DeteriorationRoutes } from '../modules/deterioration-detection/routes'
import { VoiceLogRoutes } from '../modules/voice-log/routes'
import { FallDetectionRoutes } from '../modules/fall-detection/routes'
import { SignVitalsRoutes } from '../modules/sign-vitals/routes'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      ...DeteriorationRoutes,
      ...VoiceLogRoutes,
      ...FallDetectionRoutes,
      ...SignVitalsRoutes,
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

