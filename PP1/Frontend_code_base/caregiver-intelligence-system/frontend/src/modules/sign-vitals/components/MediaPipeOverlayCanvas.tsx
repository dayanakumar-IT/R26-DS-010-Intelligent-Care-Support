import '@mediapipe/drawing_utils'
import { useEffect, useRef } from 'react'
import type { ColoredLandmark, HolisticResultsLike } from '../types/mediaPipe.types'

type DrawWindow = Window & {
  drawLandmarks?: (
    ctx: CanvasRenderingContext2D,
    landmarks?: Array<{ x: number; y: number }>,
    options?: { color?: string; lineWidth?: number; radius?: number },
  ) => void
  drawConnectors?: (
    ctx: CanvasRenderingContext2D,
    landmarks?: Array<{ x: number; y: number }>,
    connections?: Array<[number, number]>,
    options?: { color?: string; lineWidth?: number },
  ) => void
}

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]
const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
]

export function MediaPipeOverlayCanvas({
  results,
  scoredLandmarks,
  width,
  height,
}: {
  results: HolisticResultsLike | null
  scoredLandmarks: ColoredLandmark[]
  width: number
  height: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!results || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const drawWindow = window as DrawWindow
    if (!drawWindow.drawConnectors || !drawWindow.drawLandmarks) return
    const { drawConnectors, drawLandmarks } = drawWindow
    ctx.clearRect(0, 0, width, height)

    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#38bdf8', lineWidth: 2 })
    drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: '#1D9E75', lineWidth: 2 })
    drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: '#1D9E75', lineWidth: 2 })
    drawLandmarks(ctx, results.poseLandmarks, { color: '#7dd3fc', radius: 2 })
    drawLandmarks(ctx, results.leftHandLandmarks, { color: '#86efac', radius: 3 })
    drawLandmarks(ctx, results.rightHandLandmarks, { color: '#86efac', radius: 3 })

    scoredLandmarks.forEach((point) => {
      const x = point.x * width
      const y = point.y * height
      ctx.fillStyle = point.isCorrect ? '#1D9E75' : '#E24B4A'
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
      if (!point.isCorrect && point.correction) {
        const tx = (point.correction.x + point.correction.dx) * width
        const ty = (point.correction.y + point.correction.dy) * height
        ctx.strokeStyle = '#E24B4A'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(tx, ty)
        ctx.stroke()
      }
    })
  }, [results, scoredLandmarks, width, height])

  return <canvas ref={canvasRef} width={width} height={height} />
}
