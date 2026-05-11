import { Card } from '../../../shared/components/Card'
import type { EngagementState } from '../types/mediaPipe.types'
import cls from './signVitals.module.css'

export function EngagementMonitor({ engagement }: { engagement: EngagementState }) {
  const notice = engagement.isFatigued
    ? 'User showing signs of fatigue. Suggest a 2-minute break or switch to HELLO.'
    : engagement.isBored
      ? 'Engagement dropping. Recommend easier review sign and brief pace reset.'
      : 'Learner remains focused. Continue current sign practice.'

  return (
    <Card title="Engagement Monitor">
      <div className={cls.miniPreview}>
        <div>Current Emotion: {engagement.emotion}</div>
        <div>Engagement Level: {engagement.engagement}%</div>
        <div>Boredom Detected: {engagement.isBored ? 'Yes' : 'No'}</div>
        <div>Practice Time: {Math.floor(engagement.sessionSeconds / 60)}m {engagement.sessionSeconds % 60}s</div>
      </div>
      <p className={cls.recommendationText}>
        AI Recommendation: {notice}
      </p>
    </Card>
  )
}
