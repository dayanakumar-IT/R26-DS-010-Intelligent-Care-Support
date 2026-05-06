import { useMemo } from 'react'

// Palette: #1E3A8A navy | #2563EB blue | #14B8A6 teal | #7C3AED purple | #EF4444 red | #F59E0B amber

// ─── Donut Chart ────────────────────────────────────────────────────────────
interface DonutSegment { label: string; value: number; color: string }
interface DonutChartProps { segments: DonutSegment[]; size?: number; thickness?: number; centerLabel?: string; centerSub?: string }

export function DonutChart({ segments, size = 140, thickness = 28, centerLabel, centerSub }: DonutChartProps) {
  const cx = size / 2, cy = size / 2, r = (size - thickness) / 2 - 4
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  let cumulative = 0
  const slices = segments.map(seg => {
    const pct = seg.value / total
    const dashLen = pct * circumference
    const offset = circumference - cumulative * circumference
    cumulative += pct
    return { ...seg, dashLen, offset }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={thickness}
          strokeDasharray={`${s.dashLen} ${circumference - s.dashLen}`}
          strokeDashoffset={s.offset}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      ))}
      {centerLabel && (
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text-strong)">{centerLabel}</text>
      )}
      {centerSub && (
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="var(--text)">{centerSub}</text>
      )}
    </svg>
  )
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
interface SparklineProps { data: number[]; color?: string; width?: number; height?: number; filled?: boolean }

export function Sparkline({ data, color = '#F97316', width = 80, height = 28, filled = false }: SparklineProps) {
  const points = useMemo(() => {
    if (data.length < 2) return ''
    const min = Math.min(...data), max = Math.max(...data)
    const range = max - min || 1
    const xStep = width / (data.length - 1)
    return data.map((v, i) => `${i * xStep},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  }, [data, width, height])

  const fillPath = useMemo(() => {
    if (!filled || data.length < 2) return ''
    const min = Math.min(...data), max = Math.max(...data)
    const range = max - min || 1
    const xStep = width / (data.length - 1)
    const pts = data.map((v, i) => `${i * xStep},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
    return `M 0,${height} L ${pts} L ${(data.length - 1) * xStep},${height} Z`
  }, [data, width, height, filled])

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {filled && fillPath && <path d={fillPath} fill={color} fillOpacity="0.15" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Line Chart ──────────────────────────────────────────────────────────────
interface LineChartProps {
  data: Array<{ label: string; values: { key: string; value: number; color: string }[] }>
  width?: number; height?: number; showGrid?: boolean
}

export function LineChart({ data, width = 400, height = 180, showGrid = true }: LineChartProps) {
  const padL = 36, padR = 16, padT = 12, padB = 28
  const W = width - padL - padR, H = height - padT - padB

  const allVals = data.flatMap(d => d.values.map(v => v.value))
  const min = 0, max = Math.max(...allVals, 1)
  const keys = data[0]?.values.map(v => ({ key: v.key, color: v.color })) ?? []

  const xPos = (i: number) => padL + (i / (data.length - 1)) * W
  const yPos = (v: number) => padT + H - ((v - min) / (max - min)) * H

  const yTicks = [0, 25, 50, 75, 100].filter(t => t <= max + 10)

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {showGrid && yTicks.map(t => (
        <g key={t}>
          <line x1={padL} y1={yPos(t)} x2={padL + W} y2={yPos(t)} stroke="var(--border)" strokeDasharray="4 3" strokeWidth="1" />
          <text x={padL - 4} y={yPos(t) + 4} textAnchor="end" fontSize="9" fill="var(--text)">{t}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={xPos(i)} y={height - 6} textAnchor="middle" fontSize="9" fill="var(--text)">{d.label}</text>
      ))}
      {keys.map(({ key, color }) => {
        const pts = data.map((d, i) => {
          const v = d.values.find(vv => vv.key === key)?.value ?? 0
          return `${xPos(i)},${yPos(v)}`
        }).join(' ')
        return (
          <polyline key={key} points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )
      })}
      {data.map((d, i) => keys.map(({ key, color }) => {
        const v = d.values.find(vv => vv.key === key)?.value ?? 0
        return <circle key={`${i}-${key}`} cx={xPos(i)} cy={yPos(v)} r="3" fill={color} />
      }))}
    </svg>
  )
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────
interface BarChartProps {
  data: Array<{ label: string; low: number; moderate: number; high: number }>
  width?: number; height?: number
}

export function BarChart({ data, width = 340, height = 160 }: BarChartProps) {
  const padL = 32, padR = 12, padT = 10, padB = 24
  const W = width - padL - padR, H = height - padT - padB
  const barW = (W / data.length) * 0.65
  const gap = W / data.length
  const maxVal = Math.max(...data.flatMap(d => [d.low + d.moderate + d.high]), 1)

  const yPos = (v: number) => padT + H - (v / maxVal) * H
  const yTicks = [0, 5, 10, 15]

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {yTicks.map(t => (
        <g key={t}>
          <line x1={padL} y1={yPos(t)} x2={padL + W} y2={yPos(t)} stroke="var(--border)" strokeDasharray="4 3" strokeWidth="1" />
          <text x={padL - 4} y={yPos(t) + 4} textAnchor="end" fontSize="9" fill="var(--text)">{t}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = padL + i * gap + (gap - barW) / 2
        const totalH = (d.low + d.moderate + d.high) / maxVal * H
        const lowH = (d.low / maxVal) * H
        const modH = (d.moderate / maxVal) * H
        const hiH = (d.high / maxVal) * H
        const base = padT + H
        return (
          <g key={i}>
            <rect x={x} y={base - lowH} width={barW} height={lowH} fill="#16A34A" rx="2" />
            <rect x={x} y={base - lowH - modH} width={barW} height={modH} fill="#F59E0B" rx="2" />
            <rect x={x} y={base - totalH} width={barW} height={hiH} fill="#EF4444" rx="2" />
            <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize="9" fill="var(--text)">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Horizontal Bar ──────────────────────────────────────────────────────────
interface HBarProps { label: string; value: number; max: number; color: string; showValue?: boolean }

export function HBar({ label, value, max, color, showValue = true }: HBarProps) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text)', marginBottom: 3 }}>
        <span>{label}</span>
        {showValue && <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{value}%</span>}
      </div>
      <div style={{ height: 8, background: 'var(--muted)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ─── Risk Score Arc ───────────────────────────────────────────────────────────
interface RiskArcProps { score: number; size?: number }

export function RiskArc({ score, size = 80 }: RiskArcProps) {
  const cx = size / 2, cy = size / 2 + 4, r = size / 2 - 10
  const color = score >= 71 ? '#EF4444' : score >= 41 ? '#F59E0B' : '#16A34A'
  const startAngle = -200, endAngle = 20
  const totalArc = endAngle - startAngle
  const filledArc = (score / 100) * totalArc
  const toRad = (d: number) => (d * Math.PI) / 180
  const px = (angle: number) => cx + r * Math.cos(toRad(angle))
  const py = (angle: number) => cy + r * Math.sin(toRad(angle))

  const bgPath = `M ${px(startAngle)} ${py(startAngle)} A ${r} ${r} 0 1 1 ${px(endAngle)} ${py(endAngle)}`
  const fgPath = `M ${px(startAngle)} ${py(startAngle)} A ${r} ${r} 0 ${filledArc > 180 ? 1 : 0} 1 ${px(startAngle + filledArc)} ${py(startAngle + filledArc)}`

  return (
    <svg width={size} height={size * 0.8} viewBox={`0 0 ${size} ${size * 0.8}`}>
      <path d={bgPath} fill="none" stroke="var(--muted)" strokeWidth="7" strokeLinecap="round" />
      <path d={fgPath} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" style={{ transition: 'all 0.5s ease' }} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="15" fontWeight="800" fill={color}>{score}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="8" fill="var(--text)">/100</text>
    </svg>
  )
}

// ─── Mini Area Chart ──────────────────────────────────────────────────────────
interface MiniAreaProps { data: number[]; color: string; width?: number; height?: number }

export function MiniArea({ data, color, width = 120, height = 40 }: MiniAreaProps) {
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const xStep = width / (data.length - 1)
  const pts = data.map((v, i) => `${i * xStep},${height - ((v - min) / range) * (height - 6) - 3}`)
  const area = `M 0,${height} L ${pts.join(' L ')} L ${(data.length - 1) * xStep},${height} Z`
  const line = pts.join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace('#','')})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
