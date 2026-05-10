import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, GitBranch, Share2 } from 'lucide-react'
import { ForceGraph } from '../components/ForceGraph'
import type { GraphNode } from '../data/graphData'
import { getRiskNodeColor, GRAPH_EDGES, GRAPH_NODES } from '../data/graphData'
import { CAREGIVERS } from '../data/caregiverData'

type DetailRow = {
  label: string
  value: string
  color?: string
}

/**
 * `/deterioration/caregiver/:id` expects `CaregiverProfile.id` (e.g. CG-001), while graph nodes use nurse codes (e.g. F5).
 * Build map from caregiver names · then overlays for nurses that exist only on the graph until profiles are added.
 */
const GRAPH_NODE_ID_TO_CAREGIVER_ID: Record<string, string> = {
  ...Object.fromEntries(
    CAREGIVERS.filter((c) => c.name !== 'Nurse cohort reserve').map((c) => {
      const suffix = c.name.replace(/^Nurse\s+/i, '').trim()
      return [suffix, c.id] as const
    }),
  ),
  '15': 'CG-010',
  EG: 'CG-009',
  CE: 'CG-003',
  DF: 'CG-005',
  E4: 'CG-004',
  '8B': 'CG-007',
}

function caregiverRouteId(node: GraphNode): string {
  return GRAPH_NODE_ID_TO_CAREGIVER_ID[node.id] ?? node.id
}

export function TeamGraphPage() {
  const navigate = useNavigate()
  const [highlightWard, setHighlightWard] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
  }, [])

  const detailRows: DetailRow[] = selectedNode
    ? [
        { label: 'Ward', value: selectedNode.ward },
        {
          label: 'Risk Score',
          value: `${selectedNode.riskScore}/100`,
          color: getRiskNodeColor(selectedNode.riskLevel),
        },
        { label: 'Workload', value: `${selectedNode.workloadIndex}%` },
        { label: 'Shift', value: selectedNode.shift },
        { label: 'High-risk streak', value: `${selectedNode.consecutiveHighRisk} shifts` },
        { label: 'Dataset', value: selectedNode.dataSource },
      ]
    : []

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/deterioration')}
        className="flex items-center gap-2 text-sm text-[#2563EB] hover:underline"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to Deterioration Detection
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1F2937]">Team Relationship Graph</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Hosseini Nurse Dataset
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Graph-based relational workforce modeling · Nodes = caregivers · Edges = shared shifts · Node size =
            workload · Node color = risk level
          </p>
        </div>
      </div>

      <div className="flex gap-3 rounded-2xl border border-purple-100 bg-purple-50 p-4">
        <GitBranch size={18} className="mt-0.5 shrink-0 text-[#7C3AED]" aria-hidden />
        <div>
          <p className="text-sm font-medium text-[#7C3AED]">Research Objective 4 — Graph-Based Relational Analysis</p>
          <p className="mt-0.5 text-xs text-purple-700">
            Network constructed from TILES-2018 shift schedule data. Edges represent shared shift periods between
            caregiver pairs. This relational view reveals how workload imbalance propagates through teams — something
            no tabular dashboard can convey. Cluster density indicates team interdependency. Isolated high-risk nodes
            indicate caregivers working without adequate peer support.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Total Nodes</p>
          <p className="mt-1 text-2xl font-bold text-[#1F2937]">{GRAPH_NODES.length}</p>
          <p className="text-xs text-gray-400">caregivers</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Total Edges</p>
          <p className="mt-1 text-2xl font-bold text-[#1F2937]">{GRAPH_EDGES.length}</p>
          <p className="text-xs text-gray-400">shared shift links</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" style={{ borderLeft: '4px solid #DC2626' }}>
          <p className="text-xs text-gray-400">High-Risk Cluster</p>
          <p className="mt-1 text-2xl font-bold text-[#DC2626]">ICU Ward 3</p>
          <p className="text-xs text-gray-400">4 nodes elevated</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Cross-Ward Edges</p>
          <p className="mt-1 text-2xl font-bold text-[#7C3AED]">
            {GRAPH_EDGES.filter((e) => e.edgeType === 'cross-ward').length}
          </p>
          <p className="text-xs text-gray-400">inter-ward connections</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[#1F2937]">Workforce Network</h2>
                <p className="mt-0.5 text-xs text-gray-400">Drag nodes to rearrange · Hover to inspect · Click to view profile</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 self-center text-xs text-gray-400">Highlight:</span>
                {['ICU Ward 3', 'General Ward 7', 'Rehabilitation'].map((ward) => (
                  <button
                    key={ward}
                    type="button"
                    onClick={() => setHighlightWard(highlightWard === ward ? null : ward)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      highlightWard === ward ? 'bg-[#1E3A8A] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {ward}
                  </button>
                ))}
                {highlightWard ? (
                  <button type="button" onClick={() => setHighlightWard(null)} className="rounded-full px-3 py-1 text-xs text-gray-400 hover:text-gray-600">
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            <ForceGraph
              nodes={GRAPH_NODES}
              edges={GRAPH_EDGES}
              onNodeClick={handleNodeClick}
              highlightWard={highlightWard}
            />

            <div className="mt-4 border-t border-gray-50 pt-4">
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#DC2626]" />
                  Critical risk
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#EA580C]" />
                  High risk
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#D97706]" />
                  Moderate risk
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#16A34A]" />
                  Low risk
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <div className="h-px w-6 bg-gray-400" />
                  Same-ward shift
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-px w-6 bg-gray-300"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg,#9CA3AF 0,#9CA3AF 4px,transparent 4px,transparent 7px)',
                    }}
                  />
                  Cross-ward link
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Node size</span>
                  <span className="text-gray-500">= workload index</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-1">
          {selectedNode ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1F2937]">Selected Node</h3>
                <button type="button" onClick={() => setSelectedNode(null)} className="text-lg leading-none text-gray-300 hover:text-gray-500" aria-label="Clear selection">
                  ×
                </button>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: getRiskNodeColor(selectedNode.riskLevel) }}
                >
                  {selectedNode.name.split(' ')[1]?.[0] ?? 'C'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1F2937]">{selectedNode.name}</p>
                  <p className="text-xs text-gray-400">{selectedNode.role}</p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {detailRows.map((item) => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="font-medium text-[#1F2937]" style={item.color ? { color: item.color } : undefined}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/deterioration/caregiver/${caregiverRouteId(selectedNode)}`)}
                className="mt-4 h-9 w-full rounded-xl bg-[#1E3A8A] text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                View Full Profile →
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
              <Share2 size={24} className="mx-auto mb-2 text-gray-200" aria-hidden />
              <p className="text-xs text-gray-400">Click any node to inspect caregiver details</p>
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[#1F2937]">Ward Risk Summary</h3>
            <div className="mt-3 space-y-3">
              {[
                { ward: 'ICU Ward 3', avg: 74, count: 4, color: '#DC2626' },
                { ward: 'General Ward 7', avg: 55, count: 3, color: '#D97706' },
                { ward: 'Rehabilitation', avg: 34, count: 3, color: '#16A34A' },
              ].map((item) => (
                <div key={item.ward}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-gray-600">{item.ward}</span>
                    <span className="font-bold" style={{ color: item.color }}>
                      {item.avg}/100
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${item.avg}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{item.count} caregivers</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs leading-relaxed text-gray-400">
              <span className="font-medium text-gray-500">Research Note:</span>{' '}
              Node risk scores computed from XGBoost physiological classifier trained on Hosseini Nurse Stress Dataset
              (EDA, skin temperature, and HRV features · 13,287 signal windows · 15 nurses). Graph nodes represent real
              nurses with real model-derived risk scores. Edge topology illustrates the graph-based relational workforce
              model designed for Research Objective 4 — in deployment, edges would be derived from hospital shift
              schedule overlap data to reveal workload propagation patterns across caregiver pairs. · Hosseini Nurse
              Stress Dataset © PhysioNet — used under academic research license.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
