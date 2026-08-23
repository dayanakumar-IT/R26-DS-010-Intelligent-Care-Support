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

/** riskLevel drives fill/stroke via getRiskNodeColor: critical=red, high=orange band, low=green */
export const GRAPH_NODES: GraphNode[] = [
  {
    id: 'F5',
    name: 'Nurse F5',
    ward: 'ICU Ward 3',
    role: 'Staff Nurse',
    riskScore: 72.4,
    riskLevel: 'high',
    workloadIndex: 72.4,
    shift: 'Day',
    consecutiveHighRisk: 0,
    dataSource: 'Multimodal · alert NONE',
  },
  {
    id: '7A',
    name: 'Nurse 7A',
    ward: 'ICU Ward 3',
    role: 'Staff Nurse',
    riskScore: 78.8,
    riskLevel: 'high',
    workloadIndex: 78.8,
    shift: 'Day',
    consecutiveHighRisk: 0,
    dataSource: 'Multimodal · alert NONE',
  },
  {
    id: '5C',
    name: 'Nurse 5C',
    ward: 'ICU Ward 3',
    role: 'Staff Nurse',
    riskScore: 88.9,
    riskLevel: 'critical',
    workloadIndex: 88.9,
    shift: 'Night',
    consecutiveHighRisk: 4,
    dataSource: 'Multimodal · alert HIGH',
  },
  {
    id: '6B',
    name: 'Nurse 6B',
    ward: 'ICU Ward 3',
    role: 'Senior Nurse',
    riskScore: 87.9,
    riskLevel: 'critical',
    workloadIndex: 87.9,
    shift: 'Evening',
    consecutiveHighRisk: 4,
    dataSource: 'Multimodal · alert HIGH',
  },
  {
    id: '94',
    name: 'Nurse 94',
    ward: 'ICU Ward 3',
    role: 'Charge Nurse',
    riskScore: 93.1,
    riskLevel: 'critical',
    workloadIndex: 93.1,
    shift: 'Night',
    consecutiveHighRisk: 5,
    dataSource: 'Multimodal · alert HIGH',
  },
  {
    id: '7E',
    name: 'Nurse 7E',
    ward: 'Rehabilitation',
    role: 'Staff Nurse',
    riskScore: 84.3,
    riskLevel: 'high',
    workloadIndex: 84.3,
    shift: 'Day',
    consecutiveHighRisk: 0,
    dataSource: 'Multimodal · alert NONE',
  },
  {
    id: '6D',
    name: 'Nurse 6D',
    ward: 'Rehabilitation',
    role: 'Staff Nurse',
    riskScore: 37.5,
    riskLevel: 'low',
    workloadIndex: 37.5,
    shift: 'Day',
    consecutiveHighRisk: 0,
    dataSource: 'Multimodal · alert LOW',
  },
  {
    id: '83',
    name: 'Nurse 83',
    ward: 'General Ward 7',
    role: 'Staff Nurse',
    riskScore: 81.1,
    riskLevel: 'high',
    workloadIndex: 81.1,
    shift: 'Day',
    consecutiveHighRisk: 0,
    dataSource: 'Multimodal · alert NONE',
  },
  {
    id: 'BG',
    name: 'Nurse BG',
    ward: 'General Ward 7',
    role: 'Staff Nurse',
    riskScore: 61.6,
    riskLevel: 'low',
    workloadIndex: 61.6,
    shift: 'Evening',
    consecutiveHighRisk: 0,
    dataSource: 'Multimodal · alert NONE',
  },
  {
    id: 'EG',
    name: 'Nurse EG',
    ward: 'General Ward 7',
    role: 'Staff Nurse',
    riskScore: 62.2,
    riskLevel: 'low',
    workloadIndex: 62.2,
    shift: 'Day',
    consecutiveHighRisk: 0,
    dataSource: 'Multimodal · alert NONE',
  },
  {
    id: 'CE',
    name: 'Nurse CE',
    ward: 'ICU Ward 3',
    role: 'Staff Nurse',
    riskScore: 89.2,
    riskLevel: 'critical',
    workloadIndex: 89.2,
    shift: 'Day',
    consecutiveHighRisk: 4,
    dataSource: 'Multimodal · alert HIGH',
  },
  {
    id: 'DF',
    name: 'Nurse DF',
    ward: 'ICU Ward 3',
    role: 'Staff Nurse',
    riskScore: 95.5,
    riskLevel: 'critical',
    workloadIndex: 95.5,
    shift: 'Night',
    consecutiveHighRisk: 5,
    dataSource: 'Multimodal · alert HIGH',
  },
  {
    id: 'E4',
    name: 'Nurse E4',
    ward: 'ICU Ward 3',
    role: 'Staff Nurse',
    riskScore: 90.6,
    riskLevel: 'critical',
    workloadIndex: 90.6,
    shift: 'Evening',
    consecutiveHighRisk: 4,
    dataSource: 'Multimodal · alert HIGH',
  },
  {
    id: '8B',
    name: 'Nurse 8B',
    ward: 'General Ward 7',
    role: 'Staff Nurse',
    riskScore: 74.0,
    riskLevel: 'high',
    workloadIndex: 74.0,
    shift: 'Day',
    consecutiveHighRisk: 0,
    dataSource: 'Multimodal · alert NONE',
  },
  {
    id: '15',
    name: 'Nurse 15',
    ward: 'General Ward 7',
    role: 'Staff Nurse',
    riskScore: 74.1,
    riskLevel: 'high',
    workloadIndex: 74.1,
    shift: 'Evening',
    consecutiveHighRisk: 0,
    dataSource: 'Multimodal · alert NONE',
  },
]

export const GRAPH_EDGES: GraphEdge[] = [
  { source: 'F5', target: '7A', sharedShifts: 6, edgeType: 'same-ward' },
  { source: 'F5', target: '5C', sharedShifts: 5, edgeType: 'same-ward' },
  { source: '7A', target: '6B', sharedShifts: 6, edgeType: 'same-ward' },
  { source: '5C', target: '94', sharedShifts: 7, edgeType: 'same-ward' },
  { source: '6B', target: 'CE', sharedShifts: 5, edgeType: 'same-ward' },
  { source: 'CE', target: 'DF', sharedShifts: 8, edgeType: 'same-ward' },
  { source: 'DF', target: 'E4', sharedShifts: 6, edgeType: 'same-ward' },
  { source: '94', target: 'E4', sharedShifts: 4, edgeType: 'same-ward' },
  { source: '83', target: 'BG', sharedShifts: 7, edgeType: 'same-ward' },
  { source: 'BG', target: 'EG', sharedShifts: 5, edgeType: 'same-ward' },
  { source: '83', target: '8B', sharedShifts: 6, edgeType: 'same-ward' },
  { source: '8B', target: '15', sharedShifts: 5, edgeType: 'same-ward' },
  { source: '7E', target: '6D', sharedShifts: 6, edgeType: 'same-ward' },
  { source: '7A', target: '83', sharedShifts: 2, edgeType: 'cross-ward' },
  { source: '5C', target: '8B', sharedShifts: 1, edgeType: 'cross-ward' },
  { source: '7E', target: 'F5', sharedShifts: 2, edgeType: 'cross-ward' },
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

/** workloadIndex is set to riskScore on nodes; tiers: >85 large, 70–85 medium, <70 small */
export function getNodeRadius(workloadIndex: number): number {
  if (workloadIndex > 85) return 32
  if (workloadIndex >= 70) return 26
  return 18
}
