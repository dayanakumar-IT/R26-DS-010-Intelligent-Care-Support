import type { ReactNode } from 'react'
import { Button } from '../../../../shared/components/Button'

type ModuleCardProps = {
  title: string
  description: string
  illustration: ReactNode
  ctaLabel: string
  onStart: () => void
  variant: 'sign' | 'vitals'
}

export function ModuleCard({ title, description, illustration, ctaLabel, onStart, variant }: ModuleCardProps) {
  const tone =
    variant === 'sign'
      ? 'from-violet-50/90 via-white to-fuchsia-50/50 border-violet-100/80'
      : 'from-emerald-50/90 via-white to-teal-50/40 border-emerald-100/80'

  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br ${tone} p-6 shadow-[0_12px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.1)]`}
    >
      <div className="mb-4 flex min-h-[168px] items-center justify-center rounded-2xl border border-white/60 bg-white/60 p-3 shadow-inner">
        {illustration}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>
      <div className="mt-5">
        <Button className="w-full sm:w-auto" onClick={onStart} aria-label={ctaLabel}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  )
}
