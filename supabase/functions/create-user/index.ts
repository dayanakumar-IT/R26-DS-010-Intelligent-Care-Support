// supabase/functions/create-user/index.ts
//
// Admin-only account creation.
//
// The caller's JWT (from the Authorization header) is verified against
// profiles.role. Only an authenticated admin may create new accounts —
// this is the enforcement path referenced in 0002_profiles.sql, since
// public self-signup is intentionally not permitted by the profiles RLS
// policies.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically
// to every Edge Function as secrets — do not hardcode them.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_ROLES = new Set(['admin', 'supervisor', 'caregiver'])

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserBody {
  email: string
  password: string
  name: string
  role: string
  institution?: string
  ward?: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!jwt) {
    return jsonResponse({ error: 'Missing Authorization header.' }, 401)
  }

  // Service-role client: this function runs server-side, so it's safe to
  // use the service role key both to resolve the caller's identity from
  // their JWT and, once verified, to perform the privileged create below.
  // Never ship this key to the client.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user: caller },
    error: callerError,
  } = await adminClient.auth.getUser(jwt)

  if (callerError || !caller) {
    return jsonResponse({ error: 'Invalid or expired session.' }, 401)
  }

  // Verify the caller is an admin by checking their profile row.
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (profileError || !callerProfile || callerProfile.role !== 'admin') {
    return jsonResponse({ error: 'Forbidden: admin role required.' }, 403)
  }

  let body: CreateUserBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }

  const { email, password, name, role, institution, ward } = body

  if (!email || !password || !name || !role) {
    return jsonResponse({ error: 'email, password, name, and role are required.' }, 400)
  }

  if (!ALLOWED_ROLES.has(role)) {
    return jsonResponse(
      { error: `role must be one of: ${Array.from(ALLOWED_ROLES).join(', ')}.` },
      400,
    )
  }

  // Create the auth user.
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (createError || !created?.user) {
    const message = createError?.message ?? 'Failed to create user.'
    const status = /already.*registered|duplicate/i.test(message) ? 409 : 400
    return jsonResponse({ error: message }, status)
  }

  const newUser = created.user

  // Insert the matching profile row. This bypasses profiles' RLS (the
  // service-role client always does), which is fine here — the admin
  // check above is what actually gates this whole request.
  const { error: insertError } = await adminClient.from('profiles').insert({
    id: newUser.id,
    email,
    name,
    role,
    institution: institution ?? null,
    ward: ward ?? null,
  })

  if (insertError) {
    // Don't leave an orphaned auth user with no profile row behind.
    await adminClient.auth.admin.deleteUser(newUser.id)
    return jsonResponse({ error: `Failed to create profile: ${insertError.message}` }, 500)
  }

  return jsonResponse({ id: newUser.id, email: newUser.email }, 200)
})
