import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
  Shield,
  Users,
  XCircle,
} from 'lucide-react'
import { authenticateUser, getStoredUser, saveUserToStorage } from '../config/auth'
import logoImage from '../assets/caresense-logo-provided.png'

type VisualRole = 'admin' | 'supervisor'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [visualRole, setVisualRole] = useState<VisualRole>('admin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDemoCredentials, setShowDemoCredentials] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showLeft, setShowLeft] = useState(false)
  const formRef = useRef<HTMLDivElement | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    const frame = window.setTimeout(() => setShowLeft(true), 60)
    const user = getStoredUser()
    if (user) {
      navigate('/deterioration', { replace: true })
    }
    return () => window.clearTimeout(frame)
  }, [navigate])

  const triggerShake = () => {
    if (!formRef.current) {
      return
    }

    formRef.current.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-8px)' },
        { transform: 'translateX(8px)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 400, easing: 'ease-in-out' },
    )
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    await new Promise((resolve) => setTimeout(resolve, 1200))
    const user = authenticateUser(email, password)

    if (!user) {
      setLoading(false)
      setError('Invalid email or password. Please try again.')
      triggerShake()
      return
    }

    saveUserToStorage(user)
    setLoading(false)
    setSuccess(true)

    await new Promise((resolve) => setTimeout(resolve, 800))
    navigate('/deterioration', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      <div
        className="relative hidden w-[45%] overflow-hidden px-8 py-10 lg:flex lg:flex-col"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(20,184,166,0.15), transparent 40%), linear-gradient(135deg, #1E3A8A 0%, #7C3AED 100%)',
        }}
      >
        <div
          className={`transition-all duration-700 ${showLeft ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          style={{ transitionDelay: '0ms' }}
        >
          <div className="inline-flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/20 p-1.5">
              <img src={logoImage} alt="CareSense logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">CareSense</p>
              <p className="text-sm text-white/70">Care Beyond Words</p>
            </div>
          </div>
        </div>

        <div className="my-auto space-y-5">
          <div
            className={`max-w-md transition-all duration-700 ${showLeft ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transitionDelay: '150ms' }}
          >
            <h1 className="text-4xl font-bold leading-tight text-white">
              Protecting Those
              <br />
              Who Protect Others
            </h1>
            <p className="mt-4 text-sm text-white/80">
              AI-powered caregiver wellbeing monitoring and workforce intelligence platform.
            </p>
          </div>

          <div
            className={`flex flex-wrap gap-2 transition-all duration-700 ${showLeft ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transitionDelay: '300ms' }}
          >
            <span
              className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs text-white"
              style={{ animation: 'bounce 3.6s ease-in-out infinite' }}
            >
              <Shield className="h-3.5 w-3.5" />
              Real-time Risk Detection
            </span>
            <span
              className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs text-white"
              style={{ animation: 'bounce 4.2s ease-in-out infinite' }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Predictive Analytics
            </span>
            <span
              className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs text-white"
              style={{ animation: 'bounce 4.8s ease-in-out infinite' }}
            >
              <Users className="h-3.5 w-3.5" />
              Workload Intelligence
            </span>
          </div>
        </div>

        <div
          className={`mt-auto rounded-2xl border border-white/20 bg-white/10 p-4 text-white backdrop-blur-sm transition-all duration-700 ${showLeft ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          style={{ transitionDelay: '450ms' }}
        >
          <p className="text-xs uppercase tracking-wide text-white/75">Research Prototype</p>
          <p className="mt-2 text-sm">TILES-2018 Dataset · 212 Healthcare Workers · 10-Week Study</p>
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-white/90">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            Hosseini Nurse Dataset Active
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-white px-5 py-10 lg:w-[55%]">
        <div ref={formRef} className="w-full max-w-md">
          <div>
            <h2 className="text-2xl font-bold text-[#1F2937]">Welcome back</h2>
            <p className="mt-1 text-sm text-gray-500">Sign in to CareSense</p>
            <div className="mt-4 h-px w-full bg-gray-200" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-[#F3F4F6] p-1">
            <button
              type="button"
              onClick={() => setVisualRole('admin')}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                visualRole === 'admin' ? 'bg-[#1E3A8A] text-white' : 'text-gray-500'
              }`}
            >
              <Shield className="h-4 w-4" />
              Admin
            </button>
            <button
              type="button"
              onClick={() => setVisualRole('supervisor')}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                visualRole === 'supervisor' ? 'bg-[#1E3A8A] text-white' : 'text-gray-500'
              }`}
            >
              <Users className="h-4 w-4" />
              Supervisor
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[#1F2937]">Email address</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-xl border border-gray-200 pl-10 pr-3 text-sm text-[#1F2937] outline-none transition-all placeholder:text-gray-400 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[#1F2937]">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="h-12 w-full rounded-xl border border-gray-200 pl-10 pr-10 text-sm text-[#1F2937] outline-none transition-all placeholder:text-gray-400 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <div className="text-right">
              <button type="button" className="text-xs text-[#2563EB] transition hover:underline">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="flex h-12 w-full items-center justify-center rounded-xl font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-80"
              style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #7C3AED 100%)' }}
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              ) : success ? (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Welcome!
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-[#FEF2F2] px-3 py-2 text-sm text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowDemoCredentials((value) => !value)}
              className="inline-flex items-center gap-1 text-xs text-gray-400 transition hover:text-gray-500"
            >
              Show demo credentials
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showDemoCredentials ? 'rotate-180' : ''}`}
              />
            </button>
            {showDemoCredentials && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <p>
                  <span className="font-semibold text-gray-700">Admin:</span> admin@caresense.lk / Admin@2026
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-gray-700">Supervisor:</span> supervisor@caresense.lk /
                  Sup@2026
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-xs text-gray-400">
            <p>© R26-DS-010 | SLIIT IT4010 Research Project</p>
            <p className="mt-1 inline-flex items-center justify-center gap-1">
              For academic research only · Not for clinical use · Data: TILES-2018 &amp; Nurse Stress Dataset
              <span className="group relative inline-flex">
                <Info className="h-3.5 w-3.5 cursor-help text-gray-400" />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-72 -translate-x-1/2 rounded-md bg-[#1F2937] px-2 py-1.5 text-left text-[11px] text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                  This is an academic research prototype developed under SLIIT Final Year Research Project
                  IT4010. All caregiver profiles are simulated from anonymized public datasets. Not intended
                  for clinical deployment.
                </span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

