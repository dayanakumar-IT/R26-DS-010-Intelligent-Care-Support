import type {
  AvailableDatesResponse,
  CareActivityResponse,
  CaregiverSummary,
  DailyReportResponse,
  HandoverResponse,
  HandoverSummaryResponse,
  ObservationResponse,
  Patient,
  PatientAssignment,
  PeriodSummaryResponse,
} from '../types'

/** Dev: Vite proxy (/api/scribe). Prod: override with VITE_SCRIBE_API_URL. */
const SCRIBE_API_BASE =
  (import.meta.env.VITE_SCRIBE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? '/api/scribe' : 'http://127.0.0.1:8004')

function wrapFetchError(error: unknown): Error {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return new Error(
      `Cannot reach the SCRIBE backend (${SCRIBE_API_BASE}). ` +
        'Start it with .\\run.ps1 in backend_services/voice-log, then refresh.',
    )
  }
  if (error instanceof Error) {
    return error
  }
  return new Error('Unexpected error contacting the SCRIBE backend.')
}

async function scribeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (error) {
    throw wrapFetchError(error)
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string }
    return body.detail ?? response.statusText
  } catch {
    return response.statusText
  }
}

export async function fetchPatients(caregiverId?: string): Promise<Patient[]> {
  const query = caregiverId ? `?caregiver_id=${encodeURIComponent(caregiverId)}` : ''
  const response = await scribeFetch(`${SCRIBE_API_BASE}/patients${query}`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<Patient[]>
}

export async function fetchCaregivers(): Promise<CaregiverSummary[]> {
  const response = await scribeFetch(`${SCRIBE_API_BASE}/patients/caregivers`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<CaregiverSummary[]>
}

export async function startCareActivity(params: {
  patientId: number
  caregiverId: string
}): Promise<CareActivityResponse> {
  const response = await scribeFetch(`${SCRIBE_API_BASE}/care-activities/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient_id: params.patientId,
      caregiver_id: params.caregiverId,
    }),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<CareActivityResponse>
}

export async function completeCareActivity(activityId: string): Promise<CareActivityResponse> {
  const response = await scribeFetch(`${SCRIBE_API_BASE}/care-activities/${activityId}/complete`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<CareActivityResponse>
}

export async function fetchCurrentAssignment(patientId: number): Promise<PatientAssignment | null> {
  const response = await scribeFetch(`${SCRIBE_API_BASE}/assignments/patients/${patientId}/current`)
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const body = await response.json()
  return body as PatientAssignment | null
}

export async function fetchAssignmentHistory(patientId: number): Promise<PatientAssignment[]> {
  const response = await scribeFetch(`${SCRIBE_API_BASE}/assignments/patients/${patientId}/history`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<PatientAssignment[]>
}

export async function performHandover(params: {
  patientId: number
  toCaregiverId: string
  assignedBy?: string
  handoverNotes?: string
}): Promise<HandoverResponse> {
  const response = await scribeFetch(`${SCRIBE_API_BASE}/assignments/patients/${params.patientId}/handover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to_caregiver_id: params.toCaregiverId,
      assigned_by: params.assignedBy ?? null,
      handover_notes: params.handoverNotes ?? null,
    }),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<HandoverResponse>
}

export async function fetchHandoverSummary(
  patientId: number,
  caregiverId?: string,
): Promise<HandoverSummaryResponse> {
  const query = caregiverId ? `?caregiver_id=${encodeURIComponent(caregiverId)}` : ''
  const response = await scribeFetch(
    `${SCRIBE_API_BASE}/assignments/patients/${patientId}/handover-summary${query}`,
  )
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<HandoverSummaryResponse>
}

export async function downloadReport(
  patientId: number,
  startDate: string,
  endDate: string,
  format: 'pdf' | 'excel',
): Promise<Blob> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const response = await scribeFetch(
    `${SCRIBE_API_BASE}/patients/${patientId}/export/${format}?${params.toString()}`,
  )
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.blob()
}

export async function uploadObservation(params: {
  audio: Blob
  filename: string
  patientId: number
  caregiverId: string
  clientRecordingId: string
  recordedAt?: string
  careActivityId?: string
}): Promise<ObservationResponse> {
  const form = new FormData()
  form.append('audio', params.audio, params.filename)
  form.append('patient_id', String(params.patientId))
  form.append('caregiver_id', params.caregiverId)
  form.append('client_recording_id', params.clientRecordingId)
  if (params.recordedAt) {
    form.append('recorded_at', params.recordedAt)
  }
  if (params.careActivityId) {
    form.append('care_activity_id', params.careActivityId)
  }

  const response = await scribeFetch(`${SCRIBE_API_BASE}/observations`, {
    method: 'POST',
    body: form,
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<ObservationResponse>
}

export async function fetchDailyReport(
  patientId: number,
  reportDate?: string,
): Promise<DailyReportResponse> {
  const query = reportDate ? `?report_date=${reportDate}` : ''
  const response = await scribeFetch(`${SCRIBE_API_BASE}/patients/${patientId}/daily-report${query}`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<DailyReportResponse>
}

export async function fetchPeriodSummary(
  patientId: number,
  startDate: string,
  endDate: string,
  regenerate = false,
): Promise<PeriodSummaryResponse> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    regenerate: String(regenerate),
  })
  const response = await scribeFetch(
    `${SCRIBE_API_BASE}/patients/${patientId}/period-summary?${params.toString()}`,
  )
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<PeriodSummaryResponse>
}

export async function fetchAvailableDates(
  patientId: number,
  caregiverId?: string,
): Promise<AvailableDatesResponse> {
  const params = new URLSearchParams()
  if (caregiverId) {
    params.set('caregiver_id', caregiverId)
  }
  const query = params.toString()
  const response = await scribeFetch(
    `${SCRIBE_API_BASE}/patients/${patientId}/available-dates${query ? `?${query}` : ''}`,
  )
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const body = (await response.json()) as AvailableDatesResponse
  return {
    ...body,
    dates: body.dates.map((value) => value.slice(0, 10)),
  }
}

export async function fetchAudioUrl(patientId: number, recordingId: string): Promise<string> {
  const response = await scribeFetch(
    `${SCRIBE_API_BASE}/patients/${patientId}/audio/${recordingId}`,
  )
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const body = (await response.json()) as { url: string }
  return body.url
}

export { SCRIBE_API_BASE }
