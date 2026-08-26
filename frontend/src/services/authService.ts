  import type { AuthSession as Session } from '@supabase/supabase-js'
  import { supabase } from './supabaseClient'
  import type { User, UserRole } from '../types/user'

  export interface SignupDetails {
    name: string
    email: string
    password: string
  }

  // TODO: wire to Supabase auth in a later step.
  export async function signup(details: SignupDetails): Promise<User> {
    void details
    throw new Error('authService.signup is not wired up yet')
  }

  export interface AuthResult {
    session: Session
    profile: User
  }

  async function fetchProfile(userId: string): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, role, institution, ward')
      .eq('id', userId)
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? 'No profile found for this account.')
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      institution: data.institution ?? '',
      ward: data.ward ?? '',
    }
  }

  export async function login(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw new Error(error.message)
    }
    if (!data.session) {
      throw new Error('Login did not return a session.')
    }

    const profile = await fetchProfile(data.user.id)
    return { session: data.session, profile }
  }

  export async function logout(): Promise<void> {
    await supabase.auth.signOut()
  }

  export async function getStoredUser(): Promise<User | null> {
    const { data } = await supabase.auth.getSession()

    if (!data.session) {
      return null
    }

    return fetchProfile(data.session.user.id)
  }
