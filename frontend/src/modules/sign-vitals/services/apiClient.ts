import { supabase } from '../../../services/supabaseClient'

// Base URL for the sign-vitals FastAPI backend. Reads an optional Vite env
// var if the project defines one later, but falls back to the local dev
// default so nothing outside this module needs to change to get GLOSS/
// Parkinson's education working today.
const API_BASE_URL: string =
  (import.meta.env.VITE_SIGNVITALS_API_URL as string | undefined) ?? 'http://localhost:8000'

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    throw new Error('You need to be logged in to use this feature.')
  }
  return data.session.access_token
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
      return body.detail
    }
  } catch {
    // Response body wasn't JSON — fall through to the generic message.
  }
  return fallback
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Request failed (${response.status})`))
  }
  return response.json() as Promise<T>
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Request failed (${response.status})`))
  }
  return response.json() as Promise<T>
}

export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Request failed (${response.status})`))
  }
  return response.json() as Promise<T>
}
