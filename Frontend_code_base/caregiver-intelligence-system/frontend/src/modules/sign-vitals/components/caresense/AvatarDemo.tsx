import { CaregiverAvatar } from '../../../../components/signVitals/CaregiverAvatar'

type AvatarDemoProps = {
  word: string
  hint: string
}

export function AvatarDemo({ word, hint }: AvatarDemoProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-violet-100/80 bg-gradient-to-b from-violet-50/80 to-white p-6 shadow-inner">
        <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-violet-200/30 blur-2xl" />
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full border border-violet-100 bg-white/90 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700">
            Reference demonstration
          </div>
          <div className="w-full max-w-[220px]">
            <CaregiverAvatar lessonWord={word} showControls />
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tracking-tight text-slate-900">{word}</div>
            <p className="mt-1 max-w-sm text-sm text-slate-600">{hint}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
