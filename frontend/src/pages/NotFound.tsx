import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <h1 className="text-3xl font-semibold text-slate-900">404</h1>
      <p className="text-sm text-slate-500">This page doesn&apos;t exist.</p>
      <Link to="/dashboard" className="text-sm font-medium text-[var(--brand-blue)] hover:underline">
        Back to dashboard
      </Link>
    </div>
  )
}
