import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Button from '../shared/components/Button'
import { getStoredUser } from '../services/authService'
import { createUser } from '../services/adminService'
import type { User, UserRole } from '../types/user'

const ROLE_OPTIONS: UserRole[] = ['admin', 'supervisor', 'caregiver']

function CreateUserForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('caregiver')
  const [institution, setInstitution] = useState('')
  const [ward, setWard] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    setSubmitting(true)
    try {
      const result = await createUser({
        name,
        email,
        password,
        role,
        institution: institution || undefined,
        ward: ward || undefined,
      })
      setStatus({ type: 'success', message: `Created ${result.email}.` })
      setName('')
      setEmail('')
      setPassword('')
      setRole('caregiver')
      setInstitution('')
      setWard('')
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create user.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Name
        <input
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Temporary password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Role
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          className="rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Institution
        <input
          type="text"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          className="rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Ward
        <input
          type="text"
          value={ward}
          onChange={(event) => setWard(event.target.value)}
          className="rounded-[var(--radius-md)] border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]"
        />
      </label>

      {status && (
        <p className={`text-sm ${status.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {status.message}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="mt-1 w-full">
        {submitting ? 'Creating…' : 'Create user'}
      </Button>
    </form>
  )
}

export default function Settings() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    let isMounted = true

    getStoredUser().then((profile) => {
      if (isMounted) setCurrentUser(profile)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const isAdmin = currentUser?.role === 'admin'

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-slate-800">Account</h2>
        <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-slate-700">
          Full name
          <input
            type="text"
            disabled
            placeholder="TODO: wire to backend"
            className="rounded-[var(--radius-md)] border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-400"
          />
        </label>
        <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-slate-700">
          Institution
          <input
            type="text"
            disabled
            placeholder="TODO: wire to backend"
            className="rounded-[var(--radius-md)] border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-400"
          />
        </label>
        <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-slate-700">
          Ward
          <input
            type="text"
            disabled
            placeholder="TODO: wire to backend"
            className="rounded-[var(--radius-md)] border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-400"
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-slate-800">Security</h2>
        <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-slate-700">
          Change password
          <input
            type="password"
            disabled
            placeholder="TODO: wire to backend"
            className="rounded-[var(--radius-md)] border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-400"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" disabled />
          Two-factor authentication (TODO: wire to backend)
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-slate-800">Application</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" disabled />
          Email notifications (TODO: wire to backend)
        </label>
        <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-slate-700">
          Theme
          <select
            disabled
            defaultValue="todo"
            className="rounded-[var(--radius-md)] border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-400"
          >
            <option value="todo">TODO: wire to backend</option>
          </select>
        </label>
      </section>

      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-slate-800">User Management</h2>
          <p className="text-sm text-slate-500">
            Create a new caregiver, supervisor, or admin account.
          </p>
          <CreateUserForm />
        </section>
      )}
    </div>
  )
}
