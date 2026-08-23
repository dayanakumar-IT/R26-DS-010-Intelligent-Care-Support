export type Branch = 'All Branches' | 'Female Branch' | 'Male Branch'
export type Gender = 'Female' | 'Male'

export type Patient = {
  id: string
  name: string
  branch: Exclude<Branch, 'All Branches'>
  gender: Gender
  room: string
  conditions: string[]
  allergies: string[]
  alertStatus: 'None' | 'New' | 'Monitoring'
  vitalsRisk: 'Low' | 'Medium' | 'High'
  hydration: 'Low' | 'Ok' | 'High'
  mood: 'Good' | 'Neutral' | 'Low'
  appetite: 'Good' | 'Ok' | 'Low'
  sleep: 'Good' | 'Ok' | 'Poor'
  mobility: 'Independent' | 'Walks with support' | 'Wheelchair'
}

export type AlertItem = {
  id: string
  time: string
  patientId: string
  type:
    | 'Missed Medication'
    | 'Late Medication'
    | 'Low Hydration'
    | 'High Blood Pressure'
    | 'Fall Risk'
    | 'Behavior Change'
  status: 'New' | 'In Progress' | 'Resolved'
  assignedTo: string
  message: string
  severity: 'Low' | 'Medium' | 'High'
}

export type HandoverSummaryItem = {
  id: string
  patientId: string
  branch: Exclude<Branch, 'All Branches'>
  room: string
  date: string
  updatedAt: string
  status: 'Ready' | 'Processing' | 'Needs Review'
  voiceEnabled: boolean
  summary: string
}

export type ADLReport = {
  id: string
  patientId: string
  date: string
  submittedBy: string
  submittedAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewed: boolean
  items: Array<{ label: string; value: string; tone?: 'good' | 'warn' | 'neutral' }>
  notes: string
}

const patientConditionSpec = [
  { id: 'P001', branch: 'Female Branch', gender: 'Female', conditions: 'Dementia + High Blood Pressure + Diabetes' },
  { id: 'P002', branch: 'Female Branch', gender: 'Female', conditions: "Parkinson’s + Dementia + High Cholesterol" },
  { id: 'P003', branch: 'Female Branch', gender: 'Female', conditions: 'Stroke + Paralysis + High Blood Pressure' },
  { id: 'P004', branch: 'Female Branch', gender: 'Female', conditions: 'Stroke + Diabetes + Heart Disease' },
  { id: 'P005', branch: 'Female Branch', gender: 'Female', conditions: 'Diabetes + High Blood Pressure + High Cholesterol' },
  { id: 'P006', branch: 'Female Branch', gender: 'Female', conditions: 'Heart Disease + Diabetes + Kidney Disease' },
  { id: 'P007', branch: 'Female Branch', gender: 'Female', conditions: 'Depression + Diabetes + High Blood Pressure' },
  { id: 'P008', branch: 'Female Branch', gender: 'Female', conditions: 'Depression + Stroke recovery' },
  { id: 'P009', branch: 'Female Branch', gender: 'Female', conditions: 'Reduced Brain Development + Paralysis' },
  { id: 'P010', branch: 'Female Branch', gender: 'Female', conditions: "Depression + Parkinson’s" },
  { id: 'P011', branch: 'Female Branch', gender: 'Female', conditions: 'Dementia + Diabetes + High Blood Pressure + Heart Disease' },
  { id: 'P012', branch: 'Female Branch', gender: 'Female', conditions: "Parkinson’s + Dementia + Depression" },
  { id: 'P013', branch: 'Female Branch', gender: 'Female', conditions: 'Depression only' },
  { id: 'P014', branch: 'Female Branch', gender: 'Female', conditions: 'Diabetes + High Blood Pressure + High Cholesterol' },
  { id: 'P015', branch: 'Female Branch', gender: 'Female', conditions: 'Dementia + High Blood Pressure + Diabetes' },
  { id: 'P016', branch: 'Female Branch', gender: 'Female', conditions: "Parkinson’s + Dementia + High Cholesterol" },
  { id: 'P017', branch: 'Female Branch', gender: 'Female', conditions: 'Stroke + Paralysis + High Blood Pressure' },
  { id: 'P018', branch: 'Female Branch', gender: 'Female', conditions: 'Stroke + Diabetes + Heart Disease' },
  { id: 'P019', branch: 'Male Branch', gender: 'Male', conditions: 'Diabetes + High Blood Pressure + High Cholesterol' },
  { id: 'P020', branch: 'Male Branch', gender: 'Male', conditions: 'High Blood Pressure + Heart Disease + Stroke history' },
  { id: 'P021', branch: 'Male Branch', gender: 'Male', conditions: 'Depression + Diabetes + High Blood Pressure' },
  { id: 'P022', branch: 'Male Branch', gender: 'Male', conditions: 'Depression + Stroke recovery' },
  { id: 'P023', branch: 'Male Branch', gender: 'Male', conditions: 'Reduced Brain Development + Paralysis' },
  { id: 'P024', branch: 'Male Branch', gender: 'Male', conditions: "Depression + Parkinson’s" },
  { id: 'P025', branch: 'Male Branch', gender: 'Male', conditions: 'Kidney Disease + Diabetes + High Blood Pressure' },
  { id: 'P026', branch: 'Male Branch', gender: 'Male', conditions: "Parkinson’s + Dementia + Depression" },
  { id: 'P027', branch: 'Male Branch', gender: 'Male', conditions: 'Depression only' },
  { id: 'P028', branch: 'Male Branch', gender: 'Male', conditions: 'Diabetes + High Blood Pressure + High Cholesterol' },
  { id: 'P029', branch: 'Male Branch', gender: 'Male', conditions: 'Dementia + High Blood Pressure + Diabetes' },
  { id: 'P030', branch: 'Male Branch', gender: 'Male', conditions: "Parkinson’s + Dementia + High Cholesterol" },
  { id: 'P031', branch: 'Male Branch', gender: 'Male', conditions: 'Stroke + Paralysis + High Blood Pressure' },
  { id: 'P032', branch: 'Male Branch', gender: 'Male', conditions: 'Stroke + Diabetes + Heart Disease' },
  { id: 'P033', branch: 'Male Branch', gender: 'Male', conditions: 'Diabetes + High Blood Pressure + High Cholesterol' },
  { id: 'P034', branch: 'Male Branch', gender: 'Male', conditions: 'High Blood Pressure + Heart Disease + Stroke history' },
  { id: 'P035', branch: 'Male Branch', gender: 'Male', conditions: 'Depression + Diabetes + High Blood Pressure' },
  { id: 'P036', branch: 'Male Branch', gender: 'Male', conditions: 'Depression + Stroke recovery' },
  { id: 'P037', branch: 'Male Branch', gender: 'Male', conditions: 'Reduced Brain Development + Paralysis' },
  { id: 'P038', branch: 'Male Branch', gender: 'Male', conditions: "Depression + Parkinson’s" },
  { id: 'P039', branch: 'Male Branch', gender: 'Male', conditions: 'Dementia + Diabetes + High Blood Pressure + Heart Disease' },
].map((p) => ({
  ...p,
  branch: p.branch as Exclude<Branch, 'All Branches'>,
  gender: p.gender as Gender,
}))

function splitConditions(raw: string) {
  const cleaned = raw.replace(/\s*only\s*$/i, '').trim()
  if (!cleaned) return []
  return cleaned
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean)
}

function deriveRoom(branch: Exclude<Branch, 'All Branches'>, n: number) {
  // Female rooms: 7 total (F-101..F-107). Male rooms: 10 total (M-101..M-110)
  if (branch === 'Female Branch') return `F-${101 + (n % 7)}`
  return `M-${101 + (n % 10)}`
}

function defaultVitalsRisk(conditions: string[]) {
  const s = conditions.join(' ').toLowerCase()
  if (s.includes('stroke') || s.includes('kidney') || s.includes('heart disease')) return 'High' as const
  if (s.includes('diabetes') || s.includes('high blood pressure') || s.includes('parkinson')) return 'Medium' as const
  return 'Low' as const
}

function defaultMobility(conditions: string[]) {
  const s = conditions.join(' ').toLowerCase()
  if (s.includes('paralysis')) return 'Wheelchair' as const
  if (s.includes('stroke')) return 'Walks with support' as const
  return 'Independent' as const
}

function makePatientsFromSpec(): Patient[] {
  return patientConditionSpec.map((p, idx) => {
    const conditions = splitConditions(p.conditions)
    const vitalsRisk = defaultVitalsRisk(conditions)
    const mobility = defaultMobility(conditions)
    const alertStatus = idx % 8 === 0 ? 'New' : idx % 4 === 0 ? 'Monitoring' : 'None'
    return {
      id: p.id,
      name: `Resident ${p.id}`,
      branch: p.branch,
      gender: p.gender,
      room: deriveRoom(p.branch, idx),
      conditions,
      allergies: [],
      alertStatus,
      vitalsRisk,
      hydration: idx % 9 === 0 ? 'Low' : 'Ok',
      mood: idx % 7 === 0 ? 'Low' : idx % 3 === 0 ? 'Neutral' : 'Good',
      appetite: idx % 10 === 0 ? 'Low' : idx % 4 === 0 ? 'Ok' : 'Good',
      sleep: idx % 11 === 0 ? 'Poor' : 'Ok',
      mobility,
    }
  })
}

export const organizationStats = {
  totalPatients: 39,
  femaleResidents: 18,
  maleResidents: 21,
  rooms: {
    total: 17,
    female: 7,
    male: 10,
  },
  caregivers: 7,
  doctors: 2,
  nurses: 2,
}

// Kept for non-dashboard mock features (if needed later)
export const careStats = {
  activeAlerts: 6,
  pendingReviews: 5,
}

export const patients: Patient[] = makePatientsFromSpec()

export const alertsToday: AlertItem[] = [
  {
    id: 'A-1001',
    time: '08:12',
    patientId: 'P008',
    type: 'Missed Medication',
    status: 'New',
    assignedTo: 'Caregiver 01',
    severity: 'High',
    message: 'Morning BP medication not recorded within scheduled window (08:00–08:10).',
  },
  {
    id: 'A-1002',
    time: '09:04',
    patientId: 'P004',
    type: 'Low Hydration',
    status: 'In Progress',
    assignedTo: 'Nurse 01',
    severity: 'Medium',
    message: 'Hydration intake below threshold since morning round; encourage small sips and monitor.',
  },
  {
    id: 'A-1003',
    time: '10:22',
    patientId: 'P039',
    type: 'Low Hydration',
    status: 'Resolved',
    assignedTo: 'Nurse 02',
    severity: 'Low',
    message: 'Hydration reminder completed; intake improved after follow-up.',
  },
  {
    id: 'A-1004',
    time: '11:10',
    patientId: 'P009',
    type: 'Behavior Change',
    status: 'New',
    assignedTo: 'Caregiver 03',
    severity: 'Medium',
    message: 'Agitation noted during hygiene routine; de-escalation recommended and re-check in 30 minutes.',
  },
  {
    id: 'A-1005',
    time: '12:35',
    patientId: 'P038',
    type: 'Late Medication',
    status: 'In Progress',
    assignedTo: 'Doctor 01',
    severity: 'Medium',
    message: 'Post-lunch medication administered late; confirm dose timing and monitor for symptoms.',
  },
  {
    id: 'A-1006',
    time: '14:06',
    patientId: 'P001',
    type: 'Fall Risk',
    status: 'Resolved',
    assignedTo: 'Caregiver 02',
    severity: 'Low',
    message: 'High-risk transfer completed safely with support; ensure call-bell within reach.',
  },
]

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function makeTimeLabel(h: number, m: number) {
  return `${pad2(h)}:${pad2(m)}`
}

function makeSummaryText(p: Patient) {
  const key = p.conditions.slice(0, 2).join(' and ')
  return [
    `${p.id} completed routine care with stable observations.`,
    `Meals were taken as tolerated; medication administered per schedule.`,
    `Mobility: ${p.mobility}. Hydration: ${p.hydration}. Mood: ${p.mood}.`,
    key ? `Key conditions: ${key}.` : null,
    `Continue monitoring and follow branch protocol for evening handover.`,
  ]
    .filter(Boolean)
    .join(' ')
}

export const handoverSummaries: HandoverSummaryItem[] = (() => {
  // Provide 39 summaries across recent days for filtering.
  const today = new Date()
  const days = [0, 0, 0, 1, 2] // skew towards today
  return patients.map((p, idx) => {
    const dayOffset = days[idx % days.length] ?? 0
    const d = new Date(today)
    d.setDate(today.getDate() - dayOffset)
    const date = isoDate(d)

    const baseH = 12 + (idx % 6) // 12..17
    const baseM = (idx * 7) % 60
    const updatedAt = `${date} ${makeTimeLabel(baseH, baseM)}`

    const status: HandoverSummaryItem['status'] =
      idx % 11 === 0 ? 'Needs Review' : idx % 17 === 0 ? 'Processing' : 'Ready'

    return {
      id: `HS-${2000 + idx + 1}`,
      patientId: p.id,
      branch: p.branch,
      room: p.room,
      date,
      updatedAt,
      status,
      voiceEnabled: true,
      summary: status === 'Processing' ? 'Summary generation in progress.' : makeSummaryText(p),
    }
  })
})()

function isoDateFromParts(y: number, m: number, d: number) {
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

export const adlReports: ADLReport[] = (() => {
  const reports: ADLReport[] = []
  let seq = 0

  // Generate: every patient, every day in March 2026 (31 days)
  for (let day = 1; day <= 31; day += 1) {
    const date = isoDateFromParts(2026, 3, day)

    for (let pIdx = 0; pIdx < patients.length; pIdx += 1) {
      const p = patients[pIdx]!
      const idx = day * 100 + pIdx // stable pseudo-index for variability
      const submittedAt = `${String(8 + ((pIdx + day) % 10)).padStart(2, '0')}:${String((pIdx * 7 + day * 3) % 60).padStart(2, '0')}`
      const reviewed = (pIdx + day) % 4 !== 0

      const items: ADLReport['items'] = [
        { label: 'Hygiene', value: idx % 3 === 0 ? 'Assisted, completed' : 'Completed', tone: 'good' },
        { label: 'Breakfast', value: idx % 5 === 0 ? 'Half portion' : 'Taken well', tone: idx % 5 === 0 ? 'neutral' : 'good' },
        { label: 'Medication after breakfast', value: idx % 6 === 0 ? 'Delayed (given later)' : 'Given', tone: idx % 6 === 0 ? 'warn' : 'good' },
        { label: 'Lunch', value: idx % 7 === 0 ? 'Half portion' : 'Taken', tone: idx % 7 === 0 ? 'neutral' : 'good' },
        { label: 'Tea', value: 'Taken', tone: 'good' },
        { label: 'Dinner', value: 'Taken', tone: 'good' },
        { label: 'Mobility', value: p.mobility, tone: p.mobility === 'Wheelchair' ? 'neutral' : 'good' },
        { label: 'Diaper Change', value: idx % 9 === 0 ? 'Completed' : 'Not required', tone: idx % 9 === 0 ? 'neutral' : 'good' },
        { label: 'Symptoms', value: idx % 10 === 0 ? 'Mild fatigue' : 'None reported', tone: idx % 10 === 0 ? 'warn' : 'good' },
        { label: 'Emotional Observations', value: p.mood === 'Low' ? 'Low mood; reassurance provided' : 'Calm, cooperative', tone: p.mood === 'Low' ? 'warn' : 'good' },
      ]

      seq += 1
      reports.push({
        id: `R-${String(3000 + seq).padStart(6, '0')}`,
        patientId: p.id,
        date,
        submittedBy: `Caregiver ${String((pIdx % 7) + 1).padStart(2, '0')}`,
        submittedAt,
        reviewedBy: reviewed ? `Nurse ${String((pIdx % 2) + 1).padStart(2, '0')}` : undefined,
        reviewedAt: reviewed ? `${String(10 + ((pIdx + day) % 8)).padStart(2, '0')}:${String((pIdx * 11 + day * 5) % 60).padStart(2, '0')}` : undefined,
        reviewed,
        items,
        notes:
          idx % 10 === 0
            ? 'Observed mild fatigue. Encourage rest and fluids as allowed.'
            : 'Routine care completed. Continue monitoring and encourage hydration.',
      })
    }
  }

  return reports
})()

export const sampleADLReport: ADLReport = {
  id: 'R-3001',
  patientId: 'P008',
  date: 'Today',
  submittedBy: 'Caregiver 02',
  submittedAt: '16:12',
  reviewedBy: 'Nurse 01',
  reviewedAt: '16:28',
  reviewed: true,
  items: [
    { label: 'Hygiene', value: 'Assisted, completed', tone: 'good' },
    { label: 'Breakfast', value: 'Taken well', tone: 'good' },
    { label: 'Medication after breakfast', value: 'Given', tone: 'good' },
    { label: 'Lunch', value: 'Half portion', tone: 'neutral' },
    { label: 'Tea', value: 'Taken', tone: 'good' },
    { label: 'Dinner', value: 'Planned', tone: 'neutral' },
    { label: 'Mobility', value: 'Walks with support', tone: 'neutral' },
    { label: 'Diaper change', value: 'Not required', tone: 'neutral' },
    { label: 'Symptoms', value: 'None reported', tone: 'good' },
    { label: 'Emotional observations', value: 'Calm, cooperative', tone: 'good' },
  ],
  notes:
    'Patient engaged well with morning routine. Continue BP monitoring and encourage hydration in small intervals.',
}

export function getBranchCounts(list: Patient[]) {
  const female = list.filter((p) => p.branch === 'Female Branch').length
  const male = list.filter((p) => p.branch === 'Male Branch').length
  return { female, male, total: list.length }
}

export function getKidneyPatients(list: Patient[]) {
  return list.filter((p) => p.conditions.some((c) => c.toLowerCase().includes('kidney'))).length
}

