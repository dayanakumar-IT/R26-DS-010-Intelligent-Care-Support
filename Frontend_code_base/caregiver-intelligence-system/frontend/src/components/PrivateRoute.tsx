import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getStoredUser } from '../config/auth'

interface PrivateRouteProps {
  children: ReactNode
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const user = getStoredUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
