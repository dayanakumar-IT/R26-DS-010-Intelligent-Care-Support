import { useEffect, useState } from 'react'
import { getStoredUser } from '../../../services/authService'
import type { User } from '../../../types/user'
import { fetchCaregiverProfile } from '../services/scribeSupabase'
import type { CaregiverProfile } from '../types'

interface VoiceLogUserState {
  loading: boolean
  user: User | null
  caregiverProfile: CaregiverProfile | null
  error: string | null
}

export function useVoiceLogUser(): VoiceLogUserState {
  const [state, setState] = useState<VoiceLogUserState>({
    loading: true,
    user: null,
    caregiverProfile: null,
    error: null,
  })

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const user = await getStoredUser()
        if (!isMounted) return

        if (!user) {
          setState({ loading: false, user: null, caregiverProfile: null, error: null })
          return
        }

        let caregiverProfile: CaregiverProfile | null = null
        if (user.role === 'caregiver') {
          caregiverProfile = await fetchCaregiverProfile(user.id)
        }

        if (!isMounted) return
        setState({ loading: false, user, caregiverProfile, error: null })
      } catch (err) {
        if (!isMounted) return
        setState({
          loading: false,
          user: null,
          caregiverProfile: null,
          error: err instanceof Error ? err.message : 'Failed to load user profile.',
        })
      }
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [])

  return state
}

export function isSupervisorRole(role: User['role'] | undefined): boolean {
  return role === 'supervisor' || role === 'admin'
}
