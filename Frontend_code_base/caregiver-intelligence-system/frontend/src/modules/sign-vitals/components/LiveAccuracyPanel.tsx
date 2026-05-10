import { Card } from '../../../shared/components/Card'
import type { LiveScores } from '../types/mediaPipe.types'

export function LiveAccuracyPanel({ scores }: { scores: LiveScores }) {
  const pairs = [
    ['Hand Shape', scores.handShape],
    ['Hand Position', scores.handPosition],
    ['Movement Path', scores.movementPath],
    ['Facial Expression', scores.facialExpression],
    ['Timing', scores.timing],
    ['Overall Accuracy', scores.overall],
  ]
  return (
    <Card title="Live Accuracy">
      {pairs.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
          <span>{label}</span>
          <strong>{value}%</strong>
        </div>
      ))}
    </Card>
  )
}
