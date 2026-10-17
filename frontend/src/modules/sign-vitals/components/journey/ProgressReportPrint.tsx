import { Printer, X } from 'lucide-react'
import type { GlossProgressSummary } from '../../types/gloss'
import { STATUS_STYLE, fmtDate } from '../../utils/journey'

/**
 * ProgressReportPrint.tsx
 * GLOSS component — "My progress report": a printable page (Print, or Save
 * as PDF from the browser's print dialog). Only earned milestones and real
 * attempt counts from GET /gloss/progress/summary.
 */

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #gloss-progress-report, #gloss-progress-report * { visibility: visible !important; }
  #gloss-progress-report { position: absolute; inset: 0; margin: 0; box-shadow: none; border: 0; max-height: none; overflow: visible; }
  .gloss-no-print { display: none !important; }
}`

export default function ProgressReportPrint({ summary, onClose }: { summary: GlossProgressSummary; onClose: () => void }) {
  const earnedSkill = summary.skill_badges.filter((b) => b.earned_at)
  const earnedPractice = summary.practice_badges.filter((b) => b.earned_at)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4" role="dialog" aria-modal="true" aria-label="My progress report">
      <style>{PRINT_CSS}</style>
      <article id="gloss-progress-report" className="w-full max-w-3xl rounded-[var(--radius-lg)] bg-white p-8 text-slate-800 shadow-xl">
        <p className="mb-4 rounded-[var(--radius-md)] bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
          Your supervisors can see this report.
        </p>
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--brand-blue)]">My progress report — Sign language (GLOSS)</h1>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} · from your camera
              attempts with the current version of the camera check
            </p>
          </div>
          <div className="gloss-no-print flex gap-2">
            <button type="button" onClick={() => window.print()} className="flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--brand-blue)] px-3 py-2 text-sm font-semibold text-white">
              <Printer size={16} aria-hidden="true" /> Print / Save as PDF
            </button>
            <button type="button" onClick={onClose} aria-label="Close report" className="rounded-[var(--radius-md)] border border-slate-200 px-2 text-slate-500">
              <X size={18} />
            </button>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Level', summary.level?.name ?? 'None yet'],
            ['Demonstrated', `${summary.counts.demonstrated} of ${summary.counts.countable}`],
            ['Retained', String(summary.counts.retained)],
            ['Active days this month', String(summary.monthly.active_days)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[var(--radius-md)] border border-slate-200 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">{k}</div>
              <div className="text-lg font-semibold">{v}</div>
            </div>
          ))}
        </section>
        {summary.next_level && (
          <p className="mb-6 text-sm">Next level: <b>{summary.next_level.name}</b> — {summary.next_level.missing}.</p>
        )}

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">Signs by category</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1 pr-2 font-medium">Category</th>
                <th className="py-1 pr-2 font-medium">Demonstrated</th>
                <th className="py-1 font-medium">Signs</th>
              </tr>
            </thead>
            <tbody>
              {summary.categories.map((c) => (
                <tr key={c.key} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-2 font-medium">{c.name}{c.badge_earned_at ? ` (badge ${fmtDate(c.badge_earned_at)})` : ''}</td>
                  <td className="py-1.5 pr-2">{c.demonstrated} / {c.countable}</td>
                  <td className="py-1.5 capitalize">
                    {c.signs.map((s) => `${s.sign_id.replace(/_/g, ' ')}: ${s.countable ? STATUS_STYLE[s.status].label : 'not counted'}`).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">Not counted (camera check unreliable): hurt, pain, me, sleep.</p>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-lg font-semibold">Skill badges and levels</h2>
            {earnedSkill.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
              <ul className="text-sm">{earnedSkill.map((b) => <li key={`${b.type}:${b.key}`}>{b.name} — {fmtDate(b.earned_at)}</li>)}</ul>
            )}
          </div>
          <div>
            <h2 className="mb-1 text-lg font-semibold">Practice badges</h2>
            {earnedPractice.length + summary.monthly.badges.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
              <ul className="text-sm">
                {earnedPractice.map((b) => <li key={b.key}>{b.name} — {fmtDate(b.earned_at)}</li>)}
                {summary.monthly.badges.map((b) => (
                  <li key={b.key}>{b.days} active days in {new Date(`${b.month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} — {fmtDate(b.earned_at)}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </article>
    </div>
  )
}
