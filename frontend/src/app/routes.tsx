import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './layout/MainLayout'
import PrivateRoute from '../components/PrivateRoute'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Settings from '../pages/Settings'
import NotFound from '../pages/NotFound'
import { DeteriorationRoutes } from '../modules/deterioration-detection/routes'
import { FallDetectionRoutes } from '../modules/fall-detection/routes'
import { SignVitalsRoutes } from '../modules/sign-vitals/routes'
import { VoiceLogRoutes } from '../modules/voice-log/routes'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        {DeteriorationRoutes}
        {FallDetectionRoutes}
        {SignVitalsRoutes}
        {VoiceLogRoutes}
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
