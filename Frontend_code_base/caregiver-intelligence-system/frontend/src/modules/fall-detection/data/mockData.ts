import type { Patient, RoomData, FallAlert, RecordedEvent, HistoryEntry } from '../types'

export const PATIENTS: Patient[] = [
  // Room 01 — 6 Low, 4 Moderate, 2 High
  { id: 'P001', name: 'Patient 01', age: 72, gender: 'Male',   room: 'Room 01', roomId: 'R01', bed: 'Bed 1',  riskLevel: 'Low Risk',      riskScore: 25, posture: 'Lying',    status: 'Normal',     lastUpdated: '10:30:40 AM', confidence: 0.94, trend: [22,24,23,25,24,26,25,27,25,26], trendChange:  1, bodyTilt:  2, speed: 0.00 },
  { id: 'P002', name: 'Patient 02', age: 65, gender: 'Female', room: 'Room 01', roomId: 'R01', bed: 'Bed 2',  riskLevel: 'Moderate Risk', riskScore: 58, posture: 'Sitting',  status: 'Monitoring', lastUpdated: '10:30:38 AM', confidence: 0.87, trend: [50,52,55,53,57,56,58,57,59,58], trendChange:  8, bodyTilt:  8, speed: 0.00 },
  { id: 'P003', name: 'Patient 03', age: 68, gender: 'Male',   room: 'Room 01', roomId: 'R01', bed: 'Bed 3',  riskLevel: 'High Risk',     riskScore: 82, posture: 'Standing', status: 'Alert',      lastUpdated: '10:30:45 AM', confidence: 0.82, trend: [60,64,68,70,72,76,78,80,81,82], trendChange: 22, bodyTilt: 15, speed: 0.45 },
  { id: 'P004', name: 'Patient 04', age: 78, gender: 'Female', room: 'Room 01', roomId: 'R01', bed: 'Bed 4',  riskLevel: 'Low Risk',      riskScore: 32, posture: 'Walking',  status: 'Normal',     lastUpdated: '10:30:36 AM', confidence: 0.91, trend: [28,30,31,30,32,31,33,32,31,32], trendChange:  4, bodyTilt:  3, speed: 0.72 },
  { id: 'P005', name: 'Patient 05', age: 55, gender: 'Male',   room: 'Room 01', roomId: 'R01', bed: 'Bed 5',  riskLevel: 'High Risk',     riskScore: 79, posture: 'Standing', status: 'Alert',      lastUpdated: '10:30:42 AM', confidence: 0.78, trend: [62,65,68,70,72,74,75,77,78,79], trendChange: 17, bodyTilt: 18, speed: 0.20 },
  { id: 'P006', name: 'Patient 06', age: 60, gender: 'Female', room: 'Room 01', roomId: 'R01', bed: 'Bed 6',  riskLevel: 'Low Risk',      riskScore: 18, posture: 'Lying',    status: 'Normal',     lastUpdated: '10:30:33 AM', confidence: 0.96, trend: [15,16,17,16,18,17,18,18,18,18], trendChange:  3, bodyTilt:  1, speed: 0.00 },
  { id: 'P007', name: 'Patient 07', age: 73, gender: 'Male',   room: 'Room 01', roomId: 'R01', bed: 'Bed 7',  riskLevel: 'Moderate Risk', riskScore: 55, posture: 'Sitting',  status: 'Monitoring', lastUpdated: '10:30:30 AM', confidence: 0.89, trend: [44,46,48,50,51,52,53,54,55,55], trendChange: 11, bodyTilt:  7, speed: 0.00 },
  { id: 'P008', name: 'Patient 08', age: 69, gender: 'Female', room: 'Room 01', roomId: 'R01', bed: 'Bed 8',  riskLevel: 'Low Risk',      riskScore: 28, posture: 'Lying',    status: 'Normal',     lastUpdated: '10:30:28 AM', confidence: 0.95, trend: [22,24,25,26,27,26,27,28,27,28], trendChange:  6, bodyTilt:  2, speed: 0.00 },
  { id: 'P009', name: 'Patient 09', age: 81, gender: 'Male',   room: 'Room 01', roomId: 'R01', bed: 'Bed 9',  riskLevel: 'Low Risk',      riskScore: 35, posture: 'Sitting',  status: 'Normal',     lastUpdated: '10:30:25 AM', confidence: 0.92, trend: [28,30,31,32,33,33,34,34,35,35], trendChange:  7, bodyTilt:  5, speed: 0.00 },
  { id: 'P010', name: 'Patient 10', age: 63, gender: 'Female', room: 'Room 01', roomId: 'R01', bed: 'Bed 10', riskLevel: 'Low Risk',      riskScore: 22, posture: 'Lying',    status: 'Normal',     lastUpdated: '10:30:22 AM', confidence: 0.97, trend: [18,19,20,21,20,21,22,21,22,22], trendChange:  4, bodyTilt:  1, speed: 0.00 },
  { id: 'P011', name: 'Patient 11', age: 70, gender: 'Male',   room: 'Room 01', roomId: 'R01', bed: 'Bed 11', riskLevel: 'Moderate Risk', riskScore: 50, posture: 'Sitting',  status: 'Monitoring', lastUpdated: '10:30:20 AM', confidence: 0.88, trend: [38,40,42,44,45,46,47,48,49,50], trendChange: 12, bodyTilt:  6, speed: 0.00 },
  { id: 'P012', name: 'Patient 12', age: 76, gender: 'Female', room: 'Room 01', roomId: 'R01', bed: 'Bed 12', riskLevel: 'Moderate Risk', riskScore: 48, posture: 'Standing', status: 'Monitoring', lastUpdated: '10:30:40 AM', confidence: 0.86, trend: [38,40,42,43,44,45,46,47,47,48], trendChange: 10, bodyTilt: 10, speed: 0.30 },

  // Room 02 — 5 Low, 4 Moderate, 3 High
  { id: 'P013', name: 'Patient 13', age: 82, gender: 'Male',   room: 'Room 02', roomId: 'R02', bed: 'Bed 1',  riskLevel: 'High Risk',     riskScore: 88, posture: 'Walking',  status: 'Alert',      lastUpdated: '10:30:43 AM', confidence: 0.75, trend: [70,73,76,78,80,82,84,85,87,88], trendChange: 18, bodyTilt: 20, speed: 0.55 },
  { id: 'P014', name: 'Patient 14', age: 67, gender: 'Female', room: 'Room 02', roomId: 'R02', bed: 'Bed 2',  riskLevel: 'Moderate Risk', riskScore: 62, posture: 'Sitting',  status: 'Monitoring', lastUpdated: '10:30:41 AM', confidence: 0.88, trend: [52,54,55,57,58,59,60,61,62,62], trendChange: 10, bodyTilt:  9, speed: 0.00 },
  { id: 'P015', name: 'Patient 15', age: 74, gender: 'Male',   room: 'Room 02', roomId: 'R02', bed: 'Bed 3',  riskLevel: 'Low Risk',      riskScore: 27, posture: 'Lying',    status: 'Normal',     lastUpdated: '10:30:39 AM', confidence: 0.95, trend: [22,23,24,24,25,26,25,27,27,27], trendChange:  5, bodyTilt:  2, speed: 0.00 },
  { id: 'P016', name: 'Patient 16', age: 59, gender: 'Female', room: 'Room 02', roomId: 'R02', bed: 'Bed 4',  riskLevel: 'Low Risk',      riskScore: 33, posture: 'Sitting',  status: 'Normal',     lastUpdated: '10:30:37 AM', confidence: 0.93, trend: [26,27,28,29,30,31,31,32,33,33], trendChange:  7, bodyTilt:  4, speed: 0.00 },
  { id: 'P017', name: 'Patient 17', age: 77, gender: 'Male',   room: 'Room 02', roomId: 'R02', bed: 'Bed 5',  riskLevel: 'Moderate Risk', riskScore: 53, posture: 'Standing', status: 'Monitoring', lastUpdated: '10:30:35 AM', confidence: 0.85, trend: [42,44,46,47,48,49,50,51,52,53], trendChange: 11, bodyTilt: 11, speed: 0.25 },
  { id: 'P018', name: 'Patient 18', age: 71, gender: 'Female', room: 'Room 02', roomId: 'R02', bed: 'Bed 6',  riskLevel: 'Low Risk',      riskScore: 20, posture: 'Lying',    status: 'Normal',     lastUpdated: '10:30:32 AM', confidence: 0.97, trend: [16,17,18,18,19,19,20,20,20,20], trendChange:  4, bodyTilt:  1, speed: 0.00 },
  { id: 'P019', name: 'Patient 19', age: 85, gender: 'Male',   room: 'Room 02', roomId: 'R02', bed: 'Bed 7',  riskLevel: 'High Risk',     riskScore: 75, posture: 'Walking',  status: 'Alert',      lastUpdated: '10:30:44 AM', confidence: 0.80, trend: [58,60,63,65,67,69,71,73,74,75], trendChange: 17, bodyTilt: 14, speed: 0.40 },
  { id: 'P020', name: 'Patient 20', age: 66, gender: 'Female', room: 'Room 02', roomId: 'R02', bed: 'Bed 8',  riskLevel: 'Low Risk',      riskScore: 29, posture: 'Sitting',  status: 'Normal',     lastUpdated: '10:30:30 AM', confidence: 0.94, trend: [22,24,25,26,27,26,27,28,29,29], trendChange:  7, bodyTilt:  3, speed: 0.00 },
  { id: 'P021', name: 'Patient 21', age: 79, gender: 'Male',   room: 'Room 02', roomId: 'R02', bed: 'Bed 9',  riskLevel: 'Moderate Risk', riskScore: 57, posture: 'Sitting',  status: 'Monitoring', lastUpdated: '10:30:28 AM', confidence: 0.87, trend: [46,48,49,51,52,53,54,55,56,57], trendChange: 11, bodyTilt:  8, speed: 0.00 },
  { id: 'P022', name: 'Patient 22', age: 62, gender: 'Female', room: 'Room 02', roomId: 'R02', bed: 'Bed 10', riskLevel: 'Low Risk',      riskScore: 24, posture: 'Lying',    status: 'Normal',     lastUpdated: '10:30:25 AM', confidence: 0.96, trend: [19,20,21,22,22,23,23,24,24,24], trendChange:  5, bodyTilt:  2, speed: 0.00 },
  { id: 'P023', name: 'Patient 23', age: 83, gender: 'Male',   room: 'Room 02', roomId: 'R02', bed: 'Bed 11', riskLevel: 'High Risk',     riskScore: 73, posture: 'Standing', status: 'Alert',      lastUpdated: '10:30:46 AM', confidence: 0.81, trend: [56,58,60,62,64,66,68,70,71,73], trendChange: 17, bodyTilt: 16, speed: 0.15 },
  { id: 'P024', name: 'Patient 24', age: 58, gender: 'Female', room: 'Room 02', roomId: 'R02', bed: 'Bed 12', riskLevel: 'Moderate Risk', riskScore: 45, posture: 'Standing', status: 'Monitoring', lastUpdated: '10:30:40 AM', confidence: 0.83, trend: [34,36,38,39,40,41,42,43,44,45], trendChange: 11, bodyTilt:  9, speed: 0.35 },
]

export const ROOMS: RoomData[] = [
  { id: 'R01', name: 'Room 01', totalBeds: 12, lowRisk: 6, moderateRisk: 4, highRisk: 2, alerts: 3, bedsOccupied: 12, bedsAvailable: 0 },
  { id: 'R02', name: 'Room 02', totalBeds: 12, lowRisk: 5, moderateRisk: 4, highRisk: 3, alerts: 5, bedsOccupied: 12, bedsAvailable: 0 },
]

const TODAY = '06-05-2026'

export const ALERTS: FallAlert[] = [
  { id: 'A001', patientId: 'P003', patientName: 'Patient 03', room: 'Room 01', bed: 'Bed 3',  riskLevel: 'High Risk',     alertType: 'Immediate Response',  description: 'Risk increasing rapidly',          time: '10:30:45 AM', date: TODAY, status: 'New' },
  { id: 'A002', patientId: 'P005', patientName: 'Patient 05', room: 'Room 01', bed: 'Bed 5',  riskLevel: 'High Risk',     alertType: 'Abnormal Posture',     description: 'Abnormal posture detected',          time: '10:29:43 AM', date: TODAY, status: 'New' },
  { id: 'A003', patientId: 'P007', patientName: 'Patient 07', room: 'Room 01', bed: 'Bed 7',  riskLevel: 'Moderate Risk', alertType: 'Unstable Movement',    description: 'Unstable movement detected',         time: '10:28:36 AM', date: TODAY, status: 'New' },
  { id: 'A004', patientId: 'P012', patientName: 'Patient 12', room: 'Room 01', bed: 'Bed 12', riskLevel: 'Moderate Risk', alertType: 'Posture Change',        description: 'Posture change detected',            time: '10:25:40 AM', date: TODAY, status: 'Acknowledged' },
  { id: 'A005', patientId: 'P013', patientName: 'Patient 13', room: 'Room 02', bed: 'Bed 1',  riskLevel: 'High Risk',     alertType: 'Immediate Response',   description: 'Rapid downward body movement',       time: '10:30:43 AM', date: TODAY, status: 'New' },
  { id: 'A006', patientId: 'P019', patientName: 'Patient 19', room: 'Room 02', bed: 'Bed 7',  riskLevel: 'High Risk',     alertType: 'Abnormal Movement',    description: 'Abnormal gait pattern detected',     time: '10:30:44 AM', date: TODAY, status: 'New' },
  { id: 'A007', patientId: 'P023', patientName: 'Patient 23', room: 'Room 02', bed: 'Bed 11', riskLevel: 'High Risk',     alertType: 'Instability',          description: 'Prolonged imbalance while standing', time: '10:30:46 AM', date: TODAY, status: 'New' },
  { id: 'A008', patientId: 'P024', patientName: 'Patient 24', room: 'Room 02', bed: 'Bed 12', riskLevel: 'Moderate Risk', alertType: 'Recovery',             description: 'Back to normal posture',             time: '10:20:30 AM', date: TODAY, status: 'Acknowledged' },
]

export const RECORDED_EVENTS: RecordedEvent[] = [
  { id: 'EV001', patientId: 'P003', patientName: 'Patient 03', room: 'Room 01', bed: 'Bed 3',  riskLevel: 'High Risk',     time: '10:25:10 AM', date: TODAY, duration: '00:05' },
  { id: 'EV002', patientId: 'P005', patientName: 'Patient 05', room: 'Room 01', bed: 'Bed 5',  riskLevel: 'High Risk',     time: '10:28:18 AM', date: TODAY, duration: '00:05' },
  { id: 'EV003', patientId: 'P013', patientName: 'Patient 13', room: 'Room 02', bed: 'Bed 1',  riskLevel: 'Moderate Risk', time: '10:20:35 AM', date: TODAY, duration: '00:05' },
  { id: 'EV004', patientId: 'P012', patientName: 'Patient 12', room: 'Room 01', bed: 'Bed 12', riskLevel: 'Moderate Risk', time: '10:18:52 AM', date: TODAY, duration: '00:05' },
]

export const PATIENT_HISTORY: Record<string, HistoryEntry[]> = {
  P001: [
    { time: '10:30:40 AM', event: 'Resting in bed — stable',               riskLevel: 'Low Risk',      riskScore: 25, duration: '30:00' },
    { time: '10:00:00 AM', event: 'Minor position adjustment',              riskLevel: 'Low Risk',      riskScore: 20, duration: '0:30' },
    { time: '09:45:00 AM', event: 'Woke up — checked position, settled',   riskLevel: 'Low Risk',      riskScore: 30, duration: '1:00' },
  ],
  P002: [
    { time: '10:30:38 AM', event: 'Unstable sit-to-stand transition',       riskLevel: 'Moderate Risk', riskScore: 58, duration: '0:45' },
    { time: '10:28:00 AM', event: 'Prolonged sitting — slight sway',        riskLevel: 'Moderate Risk', riskScore: 48, duration: '2:00' },
    { time: '10:25:00 AM', event: 'Stable seated position',                 riskLevel: 'Low Risk',      riskScore: 30, duration: '5:00' },
  ],
  P003: [
    { time: '10:30:45 AM', event: 'Unstable standing — excessive sway',    riskLevel: 'High Risk',     riskScore: 82, duration: '0:15' },
    { time: '10:29:30 AM', event: 'Rapid posture transition detected',      riskLevel: 'High Risk',     riskScore: 76, duration: '0:22' },
    { time: '10:28:10 AM', event: 'Abnormal gait pattern',                  riskLevel: 'Moderate Risk', riskScore: 68, duration: '0:35' },
    { time: '10:26:55 AM', event: 'Standing up too quickly after sleep',    riskLevel: 'Moderate Risk', riskScore: 62, duration: '0:12' },
    { time: '10:25:00 AM', event: 'Normal movement — monitoring',           riskLevel: 'Low Risk',      riskScore: 38, duration: '1:20' },
    { time: '10:22:15 AM', event: 'Sitting position maintained',            riskLevel: 'Low Risk',      riskScore: 28, duration: '3:00' },
  ],
  P005: [
    { time: '10:30:42 AM', event: 'Excessive body leaning while standing',  riskLevel: 'High Risk',     riskScore: 79, duration: '0:20' },
    { time: '10:29:20 AM', event: 'Sway escalating — instability detected', riskLevel: 'High Risk',     riskScore: 72, duration: '0:35' },
    { time: '10:28:00 AM', event: 'Moderate sway while standing',           riskLevel: 'Moderate Risk', riskScore: 58, duration: '0:45' },
    { time: '10:26:00 AM', event: 'Normal standing position',               riskLevel: 'Low Risk',      riskScore: 35, duration: '2:00' },
  ],
  P007: [
    { time: '10:30:30 AM', event: 'Difficulty standing up from chair',      riskLevel: 'Moderate Risk', riskScore: 55, duration: '0:40' },
    { time: '10:28:15 AM', event: 'Chair transfer — slight imbalance',      riskLevel: 'Moderate Risk', riskScore: 50, duration: '0:30' },
    { time: '10:25:00 AM', event: 'Seated — stable, no concern',            riskLevel: 'Low Risk',      riskScore: 32, duration: '5:00' },
  ],
  P011: [
    { time: '10:30:20 AM', event: 'Prolonged sitting with body lean',       riskLevel: 'Moderate Risk', riskScore: 50, duration: '1:00' },
    { time: '10:28:00 AM', event: 'Minor posture deviation noted',           riskLevel: 'Moderate Risk', riskScore: 44, duration: '0:45' },
    { time: '10:24:00 AM', event: 'Stable seated position',                 riskLevel: 'Low Risk',      riskScore: 28, duration: '8:00' },
  ],
  P012: [
    { time: '10:30:40 AM', event: 'Slow unstable gait near bed',            riskLevel: 'Moderate Risk', riskScore: 48, duration: '0:35' },
    { time: '10:28:50 AM', event: 'Posture change — standing to walking',   riskLevel: 'Moderate Risk', riskScore: 44, duration: '0:25' },
    { time: '10:26:00 AM', event: 'Normal standing — monitoring',           riskLevel: 'Low Risk',      riskScore: 30, duration: '3:00' },
  ],
  P013: [
    { time: '10:30:43 AM', event: 'Unsteady walking detected',              riskLevel: 'High Risk',     riskScore: 88, duration: '0:08' },
    { time: '10:29:20 AM', event: 'Dragging or weak leg movement',          riskLevel: 'High Risk',     riskScore: 82, duration: '0:18' },
    { time: '10:27:45 AM', event: 'Slow unstable walking',                  riskLevel: 'Moderate Risk', riskScore: 65, duration: '0:45' },
    { time: '10:25:10 AM', event: 'Normal walking pattern',                 riskLevel: 'Low Risk',      riskScore: 34, duration: '2:00' },
  ],
  P019: [
    { time: '10:30:44 AM', event: 'Sudden stumbling — near-fall event',     riskLevel: 'High Risk',     riskScore: 75, duration: '0:12' },
    { time: '10:29:00 AM', event: 'Abnormal gait — dragging foot',          riskLevel: 'High Risk',     riskScore: 68, duration: '0:30' },
    { time: '10:27:20 AM', event: 'Losing balance while turning',           riskLevel: 'Moderate Risk', riskScore: 58, duration: '0:20' },
    { time: '10:25:00 AM', event: 'Slow walking — monitoring',              riskLevel: 'Low Risk',      riskScore: 36, duration: '3:00' },
  ],
  P023: [
    { time: '10:30:46 AM', event: 'Prolonged imbalance while standing',     riskLevel: 'High Risk',     riskScore: 73, duration: '0:18' },
    { time: '10:29:10 AM', event: 'Repeated balance correction movements',  riskLevel: 'High Risk',     riskScore: 66, duration: '0:25' },
    { time: '10:27:30 AM', event: 'Standing still but swaying',             riskLevel: 'Moderate Risk', riskScore: 55, duration: '0:40' },
    { time: '10:25:00 AM', event: 'Standing — stable position',             riskLevel: 'Low Risk',      riskScore: 30, duration: '4:00' },
  ],
}

export const RISK_TREND_DATA = [
  { label: '30 Apr', low: 12, moderate: 6, high: 3, total: 21 },
  { label: '01 May', low: 11, moderate: 7, high: 4, total: 22 },
  { label: '02 May', low: 13, moderate: 6, high: 3, total: 22 },
  { label: '03 May', low: 10, moderate: 8, high: 4, total: 22 },
  { label: '04 May', low: 11, moderate: 7, high: 5, total: 23 },
  { label: '05 May', low: 10, moderate: 9, high: 4, total: 23 },
  { label: '06 May', low: 11, moderate: 8, high: 5, total: 24 },
]

export const POSTURE_DIST = [
  { label: 'Standing', value: 45, color: '#F97316' },
  { label: 'Sitting',  value: 25, color: '#3B82F6' },
  { label: 'Walking',  value: 20, color: '#10B981' },
  { label: 'Lying',    value: 10, color: '#8B5CF6' },
]

export const ALERT_TREND = [2, 3, 1, 4, 3, 5, 6, 4]
