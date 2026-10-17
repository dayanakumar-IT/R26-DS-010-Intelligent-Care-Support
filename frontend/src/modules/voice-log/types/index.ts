export type AdlCategory =
  | 'medication'
  | 'meal'
  | 'fluid_intake'
  | 'hygiene'
  | 'mobility'
  | 'symptom'
  | 'mood'
  | 'nurse_check'
  | 'family_visit'

export interface Patient {
  id: number
  patient_code: string
  gender: string | null
  room_id: string | null
}

export interface AdlRecord {
  id: string
  patient_id: number
  caregiver_id: string
  recorded_at: string
  category: AdlCategory
  alert_required: boolean
  raw_transcript: string | null
  cleaned_transcript: string | null
  r2_audio_key: string | null
  client_recording_id: string | null
  medication_name?: string | null
  dosage?: string | null
  food_item?: string | null
  meal_type?: string | null
  intake_level?: string | null
  fluid_type?: string | null
  fluid_amount?: string | null
  hygiene_activity?: string | null
  mobility_type?: string | null
  destination?: string | null
  symptom_type?: string | null
  vital_type?: string | null
  vital_reading?: string | null
  vital_status?: string | null
  visitor_type?: string | null
  visit_reason?: string | null
  time_of_day?: string | null
}

export interface AdlAlert {
  id: string
  adl_record_id: string
  patient_id: number
  created_at: string
  acknowledged: boolean
  ack_by: string | null
  ack_at: string | null
  supervisor_action: string | null
  action_updated_at: string | null
  action_updated_by: string | null
  adl_record?: AdlRecord | null
}

export interface CaregiverProfile {
  id: string
  display_name: string
  profile_id: string | null
}

export interface ObservationResponse {
  id: string
  patient_id: number
  caregiver_id: string
  client_recording_id: string
  category: string
  alert_required: boolean
  r2_audio_key: string | null
  recorded_at: string
  duplicate: boolean
}

export interface DailyReportResponse {
  patient_id: number
  patient_code: string
  report_date: string
  report_text: string
  records: AdlRecord[]
}

export interface PeriodSummaryResponse {
  patient_id: number
  patient_code: string
  start_date: string
  end_date: string
  summary_text: string
  audio_url: string | null
  cached: boolean
}

export interface AvailableDatesResponse {
  patient_id: number
  patient_code: string
  dates: string[]
}

export interface CareActivityResponse {
  id: string
  patient_id: number
  caregiver_id: string
  status: 'in_progress' | 'completed'
  started_at: string
  completed_at: string | null
  daily_summary_text: string | null
}

export interface CaregiverSummary {
  id: string
  display_name: string
  ward: string | null
}

export interface PatientAssignment {
  id: string
  patient_id: number
  caregiver_id: string
  caregiver_name: string | null
  assigned_at: string
  ended_at: string | null
  handover_notes: string | null
}

export interface HandoverResponse {
  assignment: PatientAssignment
  summary_text: string
  handover_id: string | null
}

export interface HandoverSummaryResponse {
  patient_id: number
  summary_text: string
  handover_at: string
  from_caregiver_id: string | null
  to_caregiver_id: string
}

export interface WardHandoverPreview {
  patient_id: number
  patient_code: string
  handover_at: string
  summary_text: string
}

export type SyncStatus = 'pending' | 'uploading' | 'processing' | 'synced' | 'failed'

/** Care activity lifecycle on the Record tab. */
export type CareActivityPhase = 'idle' | 'in_progress' | 'processing' | 'completed'

export interface PendingRecording {
  clientRecordingId: string
  patientId: number
  patientCode: string
  recordedAt: string
  status: SyncStatus
  errorMessage?: string
}
