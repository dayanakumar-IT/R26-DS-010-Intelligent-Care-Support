import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/care-sense-logo.png'
import { Button } from '../shared/components/Button'
import cls from './pages.module.css'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  return (
    <div className={cls.authWrap}>
      <div className={cls.authCard}>
        <div className={cls.authBrand}>
          <img src={logo} alt="CareSense" className={cls.authLogo} />
          <div>
            <div className={cls.authTitle}>CareSense</div>
            <div className={cls.authSubtitle}>Care Beyond Words</div>
          </div>
        </div>

        <div className={cls.authForm}>
          <label className={cls.field}>
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@domain.com"
              autoComplete="email"
              required
            />
          </label>

          <label className={cls.field}>
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          <Button
            fullWidth
            disabled={!email || !password || loading}
            onClick={async () => {
              setLoading(true)
              try {
                // Frontend-only scaffold: no backend auth yet.
                navigate('/', { replace: true })
              } finally {
                setLoading(false)
              }
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>

          <div className={cls.authHint}>
            Frontend-only scaffold: enter any email/password to continue.
          </div>
        </div>
      </div>
    </div>
  )
}

