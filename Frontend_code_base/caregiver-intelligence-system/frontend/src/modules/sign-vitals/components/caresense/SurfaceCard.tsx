import type { HTMLAttributes, ReactNode } from 'react'

export type SurfaceCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode
  titleAside?: ReactNode
  children: ReactNode
  accent?: 'purple' | 'green' | 'neutral'
}

export function SurfaceCard({
  title,
  titleAside,
  children,
  className,
  accent = 'neutral',
  ...rest
}: SurfaceCardProps) {
  const ring =
    accent === 'purple'
      ? 'border-violet-100/90 shadow-[0_8px_30px_rgba(109,40,217,0.08)]'
      : accent === 'green'
        ? 'border-emerald-100/90 shadow-[0_8px_30px_rgba(16,185,129,0.08)]'
        : 'border-slate-100/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)]'

  return (
    <div
      className={`rounded-2xl border bg-white/95 backdrop-blur-sm ${ring} ${className ?? ''}`}
      {...rest}
    >
      {title ? (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100/80 px-5 py-4">
          <div className="text-base font-semibold tracking-tight text-slate-900">{title}</div>
          {titleAside ? <div className="shrink-0 text-sm text-slate-500">{titleAside}</div> : null}
        </div>
      ) : null}
      <div className={title ? 'p-5 pt-4' : 'p-5'}>{children}</div>
    </div>
  )
}
