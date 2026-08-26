import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lottie } from 'lottie-react'
import Button from '../shared/components/Button'
import Icon from '../shared/components/Icon'
import { login } from '../services/authService'

const CAPABILITIES = [
  'Stress Risk Detection',
  'Patient Fall Monitoring',
  'Audio Logs',
  'Sign Language Tutoring',
]

// The previous simple SVG figure, kept as a graceful fallback for when the
// Lottie file at /caregiver-animation.json fails to load.
function FallbackCaregiverFigure() {
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <div className="animate-caresense-glow absolute h-36 w-36 rounded-full bg-white/15" />
      <svg
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
        className="animate-caresense-float relative h-24 w-24"
      >
        <circle cx="50" cy="30" r="15" fill="white" fillOpacity="0.92" />
        <path d="M21 90c0-18.7 13-33 29-33s29 14.3 29 33" fill="white" fillOpacity="0.85" />
      </svg>
    </div>
  )
}

function CaregiverIllustration() {
  const [lottieFailed, setLottieFailed] = useState(false)

  if (lottieFailed) {
    return <FallbackCaregiverFigure />
  }

  return (
    <Lottie
      src="/caregiver-animation.json"
      loop
      autoplay
      style={{ width: 280, height: 280, margin: '0 auto' }}
      subscriptions={{
        error: () => setLottieFailed(true),
      }}
    />
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Branded panel — hidden below md, ~45% width on desktop */}
      <div
        className="relative hidden w-[45%] flex-col justify-between overflow-hidden px-10 py-12 text-white md:flex"
        style={{
          background: 'linear-gradient(160deg, #0b1f4d 0%, #1e3a8a 50%, #3b5fc4 100%)',
        }}
      >
        <div>
          <span className="text-2xl font-semibold tracking-tight">CareSense</span>
          <p className="mt-1 text-sm text-white/70">Care Beyond Words</p>

          <h1 className="mt-10 max-w-sm text-3xl font-semibold leading-tight">
            Caregiver Workforce Intelligence Platform
          </h1>
        </div>

        <div className="flex flex-col items-center gap-8">
          {/* Caregiver illustration: Lottie animation, falls back to the
              previous simple SVG figure if the file fails to load. */}
          <CaregiverIllustration />

          <div className="flex flex-wrap justify-center gap-2">
            {CAPABILITIES.map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-white/60">
            Academic research prototype — not for clinical use
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            © R26-DS-010 | SLIIT IT4010 Research Project
          </p>
        </div>
      </div>

      {/* Form panel — full width on mobile, ~55% on desktop */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 md:w-[55%]">
        <div className="w-full max-w-sm">
          <div className="rounded-[var(--radius-lg)] bg-white p-8 shadow-[var(--shadow-md)]">
            <h2 className="mb-6 text-xl font-semibold text-slate-900">Log in to CareSense</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-blue-900/15"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Password
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 pr-10 text-sm outline-none transition focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-blue-900/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                  </button>
                </div>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" disabled={loading} className="mt-2 w-full">
                {loading ? 'Logging in…' : 'Log in'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Don&apos;t have an account? Contact your administrator.
            </p>
          </div>

          {/* Branded panel is hidden below md — keep this framing visible on mobile too */}
          <p className="mt-6 text-center text-xs text-slate-400 md:hidden">
            Academic research prototype — not for clinical use
          </p>
        </div>
      </div>
    </div>
  )
}
