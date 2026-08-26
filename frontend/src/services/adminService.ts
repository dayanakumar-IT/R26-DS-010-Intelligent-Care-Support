import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { UserRole } from '../types/user'

export interface CreateUserInput {
  email: string
  password: string
  name: string
  role: UserRole
  institution?: string
  ward?: string
}

export interface CreateUserResult {
  id: string
  email: string
}

async function extractErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body && typeof body.error === 'string') {
        return body.error
      }
    } catch {
      // Response body wasn't JSON — fall through to the generic message.
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

// Calls the admin-only create-user Edge Function. The Supabase client
// attaches the current session's access token to the request automatically.
export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const { data, error } = await supabase.functions.invoke<CreateUserResult>('create-user', {
    body: input,
  })

  if (error) {
    throw new Error(await extractErrorMessage(error, 'Failed to create user.'))
  }
  if (!data) {
    throw new Error('create-user returned no data.')
  }

  return data
}
