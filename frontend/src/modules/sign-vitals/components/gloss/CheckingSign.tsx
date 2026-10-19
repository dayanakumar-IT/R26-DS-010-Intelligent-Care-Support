import { useEffect, useState } from 'react'

// Shown while an attempt is being checked. The steps follow the real order
// of work on the server; they advance on a timer, so they are a guide to
// what is happening, not a measurement.
const STEPS = [
  { after: 0, text: 'Sending your clip' },
  { after: 1200, text: 'Finding your hands' },
  { after: 3000, text: 'Comparing the movement' },
]

export default function CheckingSign({ title = 'Checking your sign…' }: { title?: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - started), 250)
    return () => clearInterval(id)
  }, [])

  const current = STEPS.reduce((index, step, i) => (elapsed >= step.after ? i : index), 0)

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--brand-blue)] motion-reduce:animate-none"
        />
        <p className="text-base font-semibold text-slate-800">{title}</p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="gloss-checking-bar h-full w-1/3 rounded-full bg-[var(--brand-blue)] motion-reduce:w-full motion-reduce:opacity-40" />
      </div>
      <ol className="flex flex-col gap-1.5 text-base">
        {STEPS.map((step, i) => (
          <li
            key={step.text}
            className={i < current ? 'text-slate-500' : i === current ? 'font-medium text-slate-800' : 'text-slate-400'}
          >
            <span aria-hidden="true" className="mr-2 inline-block w-4 text-center">
              {i < current ? '✓' : i === current ? '•' : '·'}
            </span>
            {step.text}
          </li>
        ))}
      </ol>
      <p className="text-sm text-slate-500">This usually takes a few seconds.</p>
      <style>{`
        @keyframes gloss-checking { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        .gloss-checking-bar { animation: gloss-checking 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .gloss-checking-bar { animation: none; } }
      `}</style>
    </div>
  )
}
