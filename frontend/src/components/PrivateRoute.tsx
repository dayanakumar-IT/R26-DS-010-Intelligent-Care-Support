import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'

interface PrivateRouteProps {
  children: ReactNode
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setHasSession(Boolean(data.session))
      setLoading(false)
    })

    // Keep this reactive to sign-in/sign-out events (e.g. token refresh
    // failures, or logging out in another tab) rather than only checking once.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setHasSession(Boolean(session))
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking your session…
      </div>
    )
  }

  if (!hasSession) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
