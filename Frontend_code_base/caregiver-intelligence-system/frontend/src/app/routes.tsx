import { Navigate, createBrowserRouter } from 'react-router-dom'
import { MainLayout } from './layout/MainLayout'
import { Home } from '../pages/Home'
import { Login } from '../pages/Login'
import { NotFound } from '../pages/NotFound'
import { PrivateRoute } from '../components/PrivateRoute'
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
    element: (
      <PrivateRoute>
        <MainLayout />
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <Navigate to="deterioration" replace /> },
      { path: 'dashboard', element: <Home /> },
      ...DeteriorationRoutes,
      ...VoiceLogRoutes,
      ...FallDetectionRoutes,
      ...SignVitalsRoutes,
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '*', element: <Navigate to="/deterioration" replace /> },
])

