import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '../data/graphData'
import { getNodeRadius, getRiskNodeColor } from '../data/graphData'

type SimNode = GraphNode & d3.SimulationNodeDatum

type SimLink = d3.SimulationLinkDatum<SimNode> &
  Pick<GraphEdge, 'sharedShifts' | 'edgeType'>

export interface ForceGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick: (node: GraphNode) => void
  highlightWard: string | null
}

export function ForceGraph({ nodes, edges, onNodeClick, highlightWard }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{
    node: GraphNode
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth || 700
    const height = 500

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current).attr('viewBox', `0 0 ${width} ${height}`)

    const nodesCopy: SimNode[] = nodes.map((n) => ({ ...n }))
    const linksRaw: SimLink[] = edges.map((e) => ({ ...e }))

    const simulation = d3
      .forceSimulation<SimNode>(nodesCopy)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(linksRaw)
          .id((d) => d.id)
          .distance((d) => (d.edgeType === 'same-ward' ? 100 : 180)),
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide<SimNode>().radius((d) => getNodeRadius(d.workloadIndex) + 8),
      )

    const link = svg
      .append('g')
      .attr('stroke-linecap', 'round')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(linksRaw)
      .join('line')
      .attr('stroke', (d) => (d.edgeType === 'same-ward' ? '#CBD5E1' : '#E2E8F0'))
      .attr('stroke-width', (d) => Math.max(1, d.sharedShifts / 3))
      .attr('stroke-dasharray', (d) => (d.edgeType === 'cross-ward' ? '4 3' : ''))
      .attr('stroke-opacity', 0.6)

    const nodeLayer = svg.append('g')
    const node = nodeLayer
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodesCopy)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    node
      .filter((d) => d.riskLevel === 'critical' || d.riskLevel === 'high')
      .append('circle')
      .attr('class', 'graph-node-halo')
      .attr('r', (d) => getNodeRadius(d.workloadIndex) + 5)
      .attr('fill', 'none')
      .attr('stroke', (d) => getRiskNodeColor(d.riskLevel))
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', '3 2')
      .attr('pointer-events', 'none')

    node
      .append('circle')
      .attr('class', 'graph-node-fill')
      .attr('r', (d) => getNodeRadius(d.workloadIndex))
      .attr('fill', (d) => getRiskNodeColor(d.riskLevel))
      .attr('fill-opacity', (d) => (highlightWard && d.ward !== highlightWard ? 0.2 : 0.85))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)

    node
      .append('text')
      .text((d) => d.name.split(' ')[1]?.[0] ?? 'C')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#ffffff')
      .attr('font-size', (d) => (getNodeRadius(d.workloadIndex) > 24 ? 13 : 11))
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')

    node
      .append('text')
      .text((d) => `${d.riskScore}`)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => getNodeRadius(d.workloadIndex) + 14)
      .attr('fill', (d) => getRiskNodeColor(d.riskLevel))
      .attr('font-size', 10)
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')

    node
      .append('text')
      .text((d) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => getNodeRadius(d.workloadIndex) + 26)
      .attr('fill', '#6B7280')
      .attr('font-size', 9)
      .attr('pointer-events', 'none')

    node
      .on('mouseenter', (event, d) => {
        const el = svgRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        setTooltip({
          node: d,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        })
        d3.select(event.currentTarget).select('.graph-node-fill').attr('stroke-width', 3).attr('stroke', '#1E3A8A')
      })
      .on('mouseleave', (event) => {
        setTooltip(null)
        d3.select(event.currentTarget).select('.graph-node-fill').attr('stroke-width', 2).attr('stroke', '#ffffff')
      })
      .on('click', (_event, d) => {
        onNodeClick(d)
      })

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0)

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
    }
  }, [nodes, edges, highlightWard, onNodeClick])

  return (
    <div className="relative w-full">
      <svg ref={svgRef} className="w-full" style={{ height: '500px' }} />

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 min-w-[180px] rounded-xl border border-gray-100 bg-white p-3 shadow-lg"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 60,
          }}
        >
          <p className="text-sm font-semibold text-[#1F2937]">{tooltip.node.name}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {tooltip.node.ward} · {tooltip.node.role}
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Risk Score</span>
              <span className="font-medium" style={{ color: getRiskNodeColor(tooltip.node.riskLevel) }}>
                {tooltip.node.riskScore}/100
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Workload</span>
              <span className="font-medium text-[#1F2937]">{tooltip.node.workloadIndex}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Shift</span>
              <span className="font-medium text-[#1F2937]">{tooltip.node.shift}</span>
            </div>
            {tooltip.node.consecutiveHighRisk >= 2 ? (
              <div className="mt-1 text-xs font-medium text-red-500">
                {tooltip.node.consecutiveHighRisk} consecutive high-risk shifts
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-xs italic text-gray-300">Click to view profile</p>
        </div>
      ) : null}
    </div>
  )
}
