import Icon from '../../../shared/components/Icon'

export default function Overview() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[var(--radius-lg)] border border-dashed border-slate-300 bg-white p-8">
      <Icon name="warning" className="text-amber-500" size={28} />
      <h1 className="text-xl font-semibold text-slate-900">
        Sign & Vitals — under construction
      </h1>
      <p className="text-sm text-slate-500">
        This module has no data or logic wired up yet.
      </p>
    </div>
  )
}
