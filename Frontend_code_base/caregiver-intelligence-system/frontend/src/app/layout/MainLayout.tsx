import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import cls from './layout.module.css'
import { Button } from '../../shared/components/Button'
import { Icon } from '../../shared/components/Icons'
import { AdminAvatarImg } from '../../shared/components/AdminAvatar'
import { clearStoredUser, getStoredUser } from '../../config/auth'
import { Mic } from 'lucide-react'

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const currentUser = getStoredUser()
  const hideRichTopbar = pathname.startsWith('/voice-log') || pathname.startsWith('/fall-detection')

  const topbarLeft = (
    <div className={cls.topbarLeft}>
      <Button
        variant="ghost"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => setCollapsed((v) => !v)}
        style={{
          transform: collapsed ? 'rotate(180deg)' : undefined,
        }}
      >
        <Icon name="chevron" />
      </Button>
      <div className={cls.breadcrumb}>CareSense</div>
    </div>
  )

  const handleLogout = () => {
    clearStoredUser()
    navigate('/login', { replace: true })
  }

  const displayName = currentUser?.name?.trim() || 'CareSense User'
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div className={[cls.shell, collapsed ? cls.shellCollapsed : null].filter(Boolean).join(' ')}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        showCollapseInSidebar={hideRichTopbar}
      />
      <main className={cls.main}>
        {hideRichTopbar ? null : (
          <div className={cls.topbar}>
            {topbarLeft}
            <div className={cls.topbarRight}>
              <div className="hidden items-center gap-3 sm:inline-flex">
                <div className="relative grid h-10 w-10 place-items-center rounded-full bg-white p-[2px] shadow-sm">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        'conic-gradient(from 220deg, var(--brand-blue), var(--brand-purple), var(--brand-accent), var(--brand-blue))',
                      filter: 'blur(0px)',
                    }}
                  />
                  <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-white">
                    {currentUser?.role === 'admin' ? (
                      <AdminAvatarImg size={36} />
                    ) : (
                      <span
                        className="select-none text-xs font-extrabold tracking-wide"
                        style={{ color: 'var(--text-strong)' }}
                        aria-hidden
                      >
                        {initials || 'CS'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="leading-tight">
                  <p className="max-w-[180px] truncate text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
                    {displayName}
                  </p>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text)' }}>
                    {currentUser?.role ?? 'User'}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Open Voice Log recorder"
                onClick={() => navigate('/voice-log/dashboard', { state: { openRecorder: true } })}
                title="Voice Log"
              >
                <span className="inline-flex items-center gap-2">
                  <Mic size={16} />
                  <span className="hidden md:inline">Mic</span>
                </span>
              </Button>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        )}
        <div className={cls.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

