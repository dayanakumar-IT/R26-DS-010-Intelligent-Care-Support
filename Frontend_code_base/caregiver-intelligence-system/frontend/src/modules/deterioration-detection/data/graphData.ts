export interface GraphNode {
  id: string
  name: string
  ward: string
  role: string
  riskScore: number
  riskLevel: 'critical' | 'high' | 'moderate' | 'low'
  workloadIndex: number
  shift: string
  consecutiveHighRisk: number
  dataSource: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge {
  source: string
  target: string
  sharedShifts: number
  edgeType: 'same-ward' | 'cross-ward'
}

export const GRAPH_NODES: GraphNode[] = [
  {
    id: 'CG-001',
    name: 'Caregiver A',
    ward: 'ICU Ward 3',
    role: 'Senior Nurse',
    riskScore: 82,
    riskLevel: 'critical',
    workloadIndex: 94,
    shift: 'Night',
    consecutiveHighRisk: 4,
    dataSource: 'TILES-2018 Subject 001',
  },
  {
    id: 'CG-002',
    name: 'Caregiver B',
    ward: 'ICU Ward 3',
    role: 'Staff Nurse',
    riskScore: 71,
    riskLevel: 'high',
    workloadIndex: 88,
    shift: 'Day',
    consecutiveHighRisk: 3,
    dataSource: 'TILES-2018 Subject 002',
  },
  {
    id: 'CG-003',
    name: 'Caregiver C',
    ward: 'General Ward 7',
    role: 'Staff Nurse',
    riskScore: 58,
    riskLevel: 'moderate',
    workloadIndex: 71,
    shift: 'Day',
    consecutiveHighRisk: 1,
    dataSource: 'TILES-2018 Subject 003',
  },
  {
    id: 'CG-004',
    name: 'Caregiver D',
    ward: 'General Ward 7',
    role: 'Senior Nurse',
    riskScore: 44,
    riskLevel: 'moderate',
    workloadIndex: 55,
    shift: 'Evening',
    consecutiveHighRisk: 0,
    dataSource: 'TILES-2018 Subject 004',
  },
  {
    id: 'CG-005',
    name: 'Caregiver E',
    ward: 'Rehabilitation',
    role: 'Staff Nurse',
    riskScore: 29,
    riskLevel: 'low',
    workloadIndex: 42,
    shift: 'Day',
    consecutiveHighRisk: 0,
    dataSource: 'TILES-2018 Subject 005',
  },
  {
    id: 'CG-006',
    name: 'Caregiver F',
    ward: 'ICU Ward 3',
    role: 'Charge Nurse',
    riskScore: 76,
    riskLevel: 'high',
    workloadIndex: 85,
    shift: 'Night',
    consecutiveHighRisk: 3,
    dataSource: 'TILES-2018 Subject 006',
  },
  {
    id: 'CG-007',
    name: 'Caregiver G',
    ward: 'Rehabilitation',
    role: 'Staff Nurse',
    riskScore: 38,
    riskLevel: 'low',
    workloadIndex: 38,
    shift: 'Day',
    consecutiveHighRisk: 0,
    dataSource: 'TILES-2018 Subject 007',
  },
  {
    id: 'CG-008',
    name: 'Caregiver H',
    ward: 'General Ward 7',
    role: 'Staff Nurse',
    riskScore: 63,
    riskLevel: 'moderate',
    workloadIndex: 74,
    shift: 'Evening',
    consecutiveHighRisk: 2,
    dataSource: 'TILES-2018 Subject 008',
  },
  {
    id: 'CG-009',
    name: 'Caregiver I',
    ward: 'ICU Ward 3',
    role: 'Staff Nurse',
    riskScore: 69,
    riskLevel: 'high',
    workloadIndex: 82,
    shift: 'Day',
    consecutiveHighRisk: 2,
    dataSource: 'TILES-2018 Subject 009',
  },
  {
    id: 'CG-010',
    name: 'Caregiver J',
    ward: 'Rehabilitation',
    role: 'Senior Nurse',
    riskScore: 35,
    riskLevel: 'low',
    workloadIndex: 40,
    shift: 'Evening',
    consecutiveHighRisk: 0,
    dataSource: 'TILES-2018 Subject 010',
  },
]

export const GRAPH_EDGES: GraphEdge[] = [
  { source: 'CG-001', target: 'CG-006', sharedShifts: 8, edgeType: 'same-ward' },
  { source: 'CG-001', target: 'CG-002', sharedShifts: 5, edgeType: 'same-ward' },
  { source: 'CG-002', target: 'CG-009', sharedShifts: 6, edgeType: 'same-ward' },
  { source: 'CG-006', target: 'CG-009', sharedShifts: 4, edgeType: 'same-ward' },
  { source: 'CG-001', target: 'CG-009', sharedShifts: 3, edgeType: 'same-ward' },
  { source: 'CG-003', target: 'CG-008', sharedShifts: 7, edgeType: 'same-ward' },
  { source: 'CG-003', target: 'CG-004', sharedShifts: 5, edgeType: 'same-ward' },
  { source: 'CG-004', target: 'CG-008', sharedShifts: 4, edgeType: 'same-ward' },
  { source: 'CG-005', target: 'CG-007', sharedShifts: 6, edgeType: 'same-ward' },
  { source: 'CG-005', target: 'CG-010', sharedShifts: 4, edgeType: 'same-ward' },
  { source: 'CG-007', target: 'CG-010', sharedShifts: 3, edgeType: 'same-ward' },
  { source: 'CG-002', target: 'CG-003', sharedShifts: 2, edgeType: 'cross-ward' },
  { source: 'CG-004', target: 'CG-005', sharedShifts: 2, edgeType: 'cross-ward' },
  { source: 'CG-009', target: 'CG-008', sharedShifts: 1, edgeType: 'cross-ward' },
]

export function getRiskNodeColor(level: 'critical' | 'high' | 'moderate' | 'low'): string {
  const map = {
    critical: '#DC2626',
    high: '#EA580C',
    moderate: '#D97706',
    low: '#16A34A',
  }
  return map[level]
}

export function getNodeRadius(workloadIndex: number): number {
  if (workloadIndex >= 85) return 32
  if (workloadIndex >= 70) return 26
  if (workloadIndex >= 55) return 22
  return 18
}
