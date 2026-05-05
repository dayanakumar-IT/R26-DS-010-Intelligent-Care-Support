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
    path: '/',
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
      { path: 'dashboard', element: <Home /> },
      { path: 'Home', element: <Navigate to="/dashboard" replace /> },
      ...DeteriorationRoutes,
      ...VoiceLogRoutes,
      ...FallDetectionRoutes,
      ...SignVitalsRoutes,
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/login', element: <Navigate to="/" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

