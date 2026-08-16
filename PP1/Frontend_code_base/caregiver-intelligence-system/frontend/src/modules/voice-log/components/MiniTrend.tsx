export function MiniTrend({
  points,
  tone = 'primary',
}: {
  points: number[]
  tone?: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const max = Math.max(...points, 1)

  const gradients: Record<typeof tone, [string, string]> = {
    primary: ['#7C3AED', '#1E3A8A'],
    success: ['#16A34A', '#0D9488'],
    warning: ['#F97316', '#EAB308'],
    danger:  ['#EF4444', '#F97316'],
  }
  const [from, to] = gradients[tone]

  return (
    <div className="flex items-end gap-[3px]" aria-hidden>
      {points.map((p, idx) => {
        const pct = Math.max(0.1, p / max)
        const h = Math.max(5, Math.round(pct * 28))
        const opacity = 0.55 + pct * 0.45
        return (
          <span
            key={idx}
            className="inline-block rounded-full"
            style={{
              width: 7,
              height: h,
              background: `linear-gradient(180deg, ${from}, ${to})`,
              opacity,
              borderRadius: 4,
              transition: 'height 220ms ease',
            }}
          />
        )
      })}
    </div>
  )
}
