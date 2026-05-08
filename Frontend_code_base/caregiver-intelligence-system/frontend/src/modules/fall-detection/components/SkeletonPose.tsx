import { useEffect, useRef, useState } from 'react'
import type { PostureType, RiskLevel } from '../types'

interface Joint { x: number; y: number }
type Skeleton = Record<string, Joint>

const BASE_POSES: Record<PostureType, Skeleton> = {
  Standing: {
    head: { x: 50, y: 12 }, neck: { x: 50, y: 24 },
    lShoulder: { x: 36, y: 32 }, rShoulder: { x: 64, y: 32 },
    lElbow: { x: 30, y: 50 }, rElbow: { x: 70, y: 50 },
    lWrist: { x: 28, y: 64 }, rWrist: { x: 72, y: 64 },
    torso: { x: 50, y: 52 },
    lHip: { x: 40, y: 62 }, rHip: { x: 60, y: 62 },
    lKnee: { x: 38, y: 78 }, rKnee: { x: 62, y: 78 },
    lAnkle: { x: 37, y: 94 }, rAnkle: { x: 63, y: 94 },
  },
  Walking: {
    head: { x: 50, y: 12 }, neck: { x: 50, y: 24 },
    lShoulder: { x: 36, y: 32 }, rShoulder: { x: 64, y: 32 },
    lElbow: { x: 28, y: 46 }, rElbow: { x: 72, y: 52 },
    lWrist: { x: 24, y: 58 }, rWrist: { x: 76, y: 66 },
    torso: { x: 50, y: 52 },
    lHip: { x: 40, y: 62 }, rHip: { x: 60, y: 62 },
    lKnee: { x: 34, y: 76 }, rKnee: { x: 64, y: 72 },
    lAnkle: { x: 30, y: 94 }, rAnkle: { x: 66, y: 88 },
  },
  Sitting: {
    head: { x: 50, y: 14 }, neck: { x: 50, y: 26 },
    lShoulder: { x: 36, y: 34 }, rShoulder: { x: 64, y: 34 },
    lElbow: { x: 30, y: 50 }, rElbow: { x: 70, y: 50 },
    lWrist: { x: 26, y: 62 }, rWrist: { x: 74, y: 62 },
    torso: { x: 50, y: 52 },
    lHip: { x: 38, y: 64 }, rHip: { x: 62, y: 64 },
    lKnee: { x: 30, y: 72 }, rKnee: { x: 70, y: 72 },
    lAnkle: { x: 30, y: 90 }, rAnkle: { x: 70, y: 90 },
  },
  Lying: {
    head: { x: 12, y: 44 }, neck: { x: 22, y: 50 },
    lShoulder: { x: 30, y: 44 }, rShoulder: { x: 30, y: 56 },
    lElbow: { x: 46, y: 40 }, rElbow: { x: 46, y: 60 },
    lWrist: { x: 60, y: 38 }, rWrist: { x: 60, y: 62 },
    torso: { x: 50, y: 50 },
    lHip: { x: 62, y: 44 }, rHip: { x: 62, y: 56 },
    lKnee: { x: 76, y: 44 }, rKnee: { x: 76, y: 56 },
    lAnkle: { x: 90, y: 44 }, rAnkle: { x: 90, y: 56 },
  },
}

const BONES: [string, string][] = [
  ['head', 'neck'], ['neck', 'lShoulder'], ['neck', 'rShoulder'],
  ['lShoulder', 'lElbow'], ['lElbow', 'lWrist'],
  ['rShoulder', 'rElbow'], ['rElbow', 'rWrist'],
  ['neck', 'torso'], ['torso', 'lHip'], ['torso', 'rHip'],
  ['lHip', 'lKnee'], ['lKnee', 'lAnkle'],
  ['rHip', 'rKnee'], ['rKnee', 'rAnkle'],
]

const HIGH_RISK_JOINTS = ['lKnee', 'rKnee', 'lAnkle', 'rAnkle', 'torso', 'lHip', 'rHip']

function addNoise(val: number, amp: number) {
  return val + (Math.random() - 0.5) * amp
}

interface SkeletonPoseProps {
  posture: PostureType
  riskLevel: RiskLevel
  animated?: boolean
  size?: number
}

export function SkeletonPose({ posture, riskLevel, animated = true, size = 200 }: SkeletonPoseProps) {
  const base = BASE_POSES[posture]
  const [jitter, setJitter] = useState(0)
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!animated) return
    const amp = riskLevel === 'High Risk' ? 3.5 : riskLevel === 'Moderate Risk' ? 1.8 : 0.8
    const interval = riskLevel === 'High Risk' ? 120 : 200
    frameRef.current = setInterval(() => setJitter(a => a + amp), interval)
    return () => { if (frameRef.current) clearInterval(frameRef.current) }
  }, [animated, riskLevel])

  const boneColor = riskLevel === 'High Risk' ? '#EF4444' : riskLevel === 'Moderate Risk' ? '#F59E0B' : '#16A34A'
  const amp = riskLevel === 'High Risk' ? 2.5 : riskLevel === 'Moderate Risk' ? 1.2 : 0.5

  const joints: Skeleton = Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, { x: addNoise(v.x, amp), y: addNoise(v.y, amp) }])
  )

  return (
    <svg
      width={size} height={size}
      viewBox="0 0 100 100"
      style={{ display: 'block' }}
      key={jitter}
    >
      {/* Background glow */}
      <defs>
        <radialGradient id="skelGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={boneColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={boneColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill="url(#skelGlow)" rx="8" />

      {/* Bones */}
      {BONES.map(([a, b]) => {
        const j1 = joints[a], j2 = joints[b]
        if (!j1 || !j2) return null
        return (
          <line
            key={`${a}-${b}`}
            x1={j1.x} y1={j1.y} x2={j2.x} y2={j2.y}
            stroke={boneColor} strokeWidth="2.5" strokeLinecap="round"
            opacity="0.85"
          />
        )
      })}

      {/* Joints */}
      {Object.entries(joints).map(([name, j]) => {
        const isHighRisk = riskLevel === 'High Risk' && HIGH_RISK_JOINTS.includes(name)
        const isHead = name === 'head'
        return (
          <circle
            key={name}
            cx={j.x} cy={j.y}
            r={isHead ? 7 : isHighRisk ? 4 : 3}
            fill={isHighRisk ? '#EF4444' : boneColor}
            stroke="white" strokeWidth="1.2"
            opacity="0.95"
          />
        )
      })}

      {/* Risk indicator dot */}
      {riskLevel === 'High Risk' && (
        <circle cx="88" cy="12" r="5" fill="#EF4444">
          <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  )
}
