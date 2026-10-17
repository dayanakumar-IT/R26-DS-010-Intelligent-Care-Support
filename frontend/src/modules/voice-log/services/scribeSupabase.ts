import { supabase } from '../../../services/supabaseClient'
import type { AdlAlert, AdlRecord, CaregiverProfile, Patient, WardHandoverPreview } from '../types'
import type { AdlRecordUpdate } from '../utils/adlRecordUpdate'

export async function fetchSupervisorPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, patient_code, gender, room_id')
    .order('patient_code')

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as Patient[]
}

export async function fetchCaregiverProfile(userId: string): Promise<CaregiverProfile | null> {
  const { data, error } = await supabase
    .from('caregiver_profiles')
    .select('id, display_name, profile_id')
    .eq('profile_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return data
}

export async function fetchCaregiverRecords(
  caregiverId: string,
  options?: { since?: string; until?: string; limit?: number; patientId?: number },
): Promise<AdlRecord[]> {
  let query = supabase
    .from('adl_records')
    .select('*')
    .eq('caregiver_id', caregiverId)
    .order('recorded_at', { ascending: false })

  if (options?.patientId != null) {
    query = query.eq('patient_id', options.patientId)
  }

  if (options?.since) {
    query = query.gte('recorded_at', options.since)
  }
  if (options?.until) {
    query = query.lte('recorded_at', options.until)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as AdlRecord[]
}

export async function fetchAllAdlRecords(limit = 500): Promise<AdlRecord[]> {
  const { data, error } = await supabase
    .from('adl_records')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as AdlRecord[]
}

export async function fetchAlerts(filter: 'all' | 'open' | 'acknowledged'): Promise<AdlAlert[]> {
  let query = supabase
    .from('adl_alerts')
    .select('*, adl_records!inner(*)')
    .eq('adl_records.category', 'symptom')
    .order('created_at', { ascending: false })

  if (filter === 'open') {
    query = query.eq('acknowledged', false)
  } else if (filter === 'acknowledged') {
    query = query.eq('acknowledged', true)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? [])
    .map((row) => normalizeAlertRow(row as Record<string, unknown>))
    .filter((alert) => alert.adl_record?.category === 'symptom')
}

function normalizeAlertRow(row: Record<string, unknown>): AdlAlert {
  const embedded = row.adl_records
  let adl_record: AdlRecord | null = null
  if (embedded && typeof embedded === 'object') {
    adl_record = (Array.isArray(embedded) ? embedded[0] : embedded) as AdlRecord
  }

  return {
    id: String(row.id),
    adl_record_id: String(row.adl_record_id),
    patient_id: Number(row.patient_id),
    created_at: String(row.created_at),
    acknowledged: Boolean(row.acknowledged),
    ack_by: (row.ack_by as string | null) ?? null,
    ack_at: (row.ack_at as string | null) ?? null,
    supervisor_action: (row.supervisor_action as string | null) ?? null,
    action_updated_at: (row.action_updated_at as string | null) ?? null,
    action_updated_by: (row.action_updated_by as string | null) ?? null,
    adl_record,
  }
}

export async function acknowledgeAlert(alertId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('adl_alerts')
    .update({
      acknowledged: true,
      ack_by: userId,
      ack_at: new Date().toISOString(),
    })
    .eq('id', alertId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateAlertSupervisorAction(
  alertId: string,
  userId: string,
  supervisorAction: string,
): Promise<void> {
  const { error } = await supabase
    .from('adl_alerts')
    .update({
      supervisor_action: supervisorAction.trim() || null,
      action_updated_at: new Date().toISOString(),
      action_updated_by: userId,
    })
    .eq('id', alertId)

  if (error) {
    throw new Error(error.message)
  }
}

export function subscribeAdlRecords(onChange: () => void) {
  const channel = supabase
    .channel('scribe-adl-records')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'adl_records' }, () => {
      onChange()
    })
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function fetchLatestWardHandover(): Promise<WardHandoverPreview | null> {
  const { data, error } = await supabase
    .from('scribe_handover_summaries')
    .select('patient_id, handover_at, summary_text, patients(patient_code)')
    .order('handover_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    return null
  }

  const patientEmbed = data.patients as { patient_code: string } | { patient_code: string }[] | null
  const patientCode = Array.isArray(patientEmbed)
    ? patientEmbed[0]?.patient_code
    : patientEmbed?.patient_code

  return {
    patient_id: Number(data.patient_id),
    patient_code: patientCode ?? `Patient #${data.patient_id}`,
    handover_at: String(data.handover_at),
    summary_text: String(data.summary_text),
  }
}

export function subscribeAdlAlerts(onChange: () => void) {
  const channel = supabase
    .channel('scribe-adl-alerts')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'adl_alerts' }, () => {
      onChange()
    })
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function updateAdlRecord(recordId: string, patch: AdlRecordUpdate): Promise<AdlRecord> {
  const payload = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [key, value === '' ? null : value]),
  )

  const { data, error } = await supabase
    .from('adl_records')
    .update(payload)
    .eq('id', recordId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return data as AdlRecord
}

export async function deleteAdlRecord(recordId: string): Promise<void> {
  const { error } = await supabase.from('adl_records').delete().eq('id', recordId)

  if (error) {
    throw new Error(error.message)
  }
}
