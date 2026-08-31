import LoadingState from '../components/LoadingState'
import { isSupervisorRole, useVoiceLogUser } from '../hooks/useVoiceLogUser'
import CaregiverModule from './caregiver/CaregiverModule'
import SupervisorModule from './supervisor/SupervisorModule'

export default function Overview() {
  const { loading, user, caregiverProfile, error } = useVoiceLogUser()

  if (loading) {
    return <LoadingState message="Loading Voice Log…" />
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 text-sm text-[var(--text-secondary)]">
        You must be signed in to use Voice Log.
      </div>
    )
  }

  if (user.role === 'caregiver') {
    if (!caregiverProfile) {
      return (
        <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          No caregiver profile is linked to your account. Ask an administrator to set{' '}
          <code className="rounded bg-amber-100 px-1">caregiver_profiles.profile_id</code> for your
          login before recording observations.
        </div>
      )
    }
    return <CaregiverModule user={user} caregiverId={caregiverProfile.id} />
  }

  if (isSupervisorRole(user.role)) {
    return <SupervisorModule user={user} />
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 text-sm text-[var(--text-secondary)]">
      Your role does not have access to the Voice Log module.
    </div>
  )
}
