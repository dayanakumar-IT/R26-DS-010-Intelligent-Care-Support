import { Card } from '../../../shared/components/Card'
import type { PracticeResult } from '../types/mediaPipe.types'
import cls from './signVitals.module.css'

const LESSONS = ['HELLO', 'HELP', 'THANK', 'SORRY', 'FOOD', 'WATER', 'PAIN', 'TIRED', 'HAPPY', 'CARE']

export function AdaptiveLearningPathway({ result }: { result: PracticeResult | null }) {
  const reviewNeeded = !!result?.revisionRecommended
  const reviewText = reviewNeeded
    ? '"HELP" flagged for review. System will re-introduce it in Lesson 6 for spaced repetition.'
    : 'Current retention is healthy. Continue to THANK YOU as next difficulty-matched sign.'

  return (
    <Card title="Adaptive Learning Pathway">
      <p>Personalized lesson sequencing based on accuracy, retention, and engagement.</p>
      <div className={cls.lessonTrack}>
        {LESSONS.map((lesson, index) => {
          const completed = index < 2
          const current = index === 2
          return (
            <div key={lesson} className={[cls.lessonNode, completed ? cls.lessonDone : '', current ? cls.lessonCurrent : ''].join(' ')}>
              <div>{completed ? '✓' : current ? '●' : '○'}</div>
              <small>L{index + 1}</small>
              <span>{lesson}</span>
            </div>
          )
        })}
      </div>
      <p className={cls.recommendationText}>{reviewText}</p>
      <div className={cls.forgettingCurve}>
        <div className={cls.curveLegend}>Forgetting Curve Analysis (HELP retention)</div>
        <div className={cls.curveBars}>
          {[100, 86, 72, 58, 45].map((v, i) => (
            <div key={v + i} className={cls.curveBarWrap}>
              <div className={cls.curveBar} style={{ height: `${v * 0.6}px` }} />
              <small>{['D1', 'D3', 'D7', 'D14', 'D30'][i]}</small>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
