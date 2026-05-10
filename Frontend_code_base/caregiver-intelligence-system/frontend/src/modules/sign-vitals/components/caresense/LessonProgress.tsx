type LessonProgressProps = {
  current: number
  total: number
  label?: string
  variant?: 'purple' | 'green'
}

export function LessonProgress({ current, total, label, variant = 'purple' }: LessonProgressProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  const fill =
    variant === 'green'
      ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
      : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'

  return (
    <div className="space-y-2">
      {label ? <div className="text-sm font-medium text-slate-700">{label}</div> : null}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Lesson {current} / {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${fill} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
