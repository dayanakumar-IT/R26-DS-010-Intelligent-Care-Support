import cls from './signVitals.module.css'

export function LandmarkFeedbackLegend() {
  return (
    <div className={cls.legend}>
      <span><span className={cls.dotGreen} /> Correct / acceptable</span>
      <span><span className={cls.dotRed} /> Needs adjustment</span>
      <span style={{ color: '#E24B4A', fontWeight: 700 }}>Arrow = movement suggestion</span>
    </div>
  )
}
