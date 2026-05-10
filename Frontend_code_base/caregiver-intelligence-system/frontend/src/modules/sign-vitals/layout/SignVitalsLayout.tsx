import { Outlet } from 'react-router-dom'

/** Pastel CareSense shell for Sign & Vitals sub-routes */
export function SignVitalsLayout() {
  return (
    <div className="min-h-full bg-gradient-to-br from-[#faf9ff] via-white to-[#f0fdf4] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <Outlet />
      </div>
    </div>
  )
}
