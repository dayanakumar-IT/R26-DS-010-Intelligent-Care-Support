import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import cls from './layout.module.css'
import { Button } from '../../shared/components/Button'
import { Icon } from '../../shared/components/Icons'
import { clearStoredUser, getStoredUser } from '../../config/auth'

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const currentUser = getStoredUser()

  const handleLogout = () => {
    clearStoredUser()
    navigate('/', { replace: true })
  }

  return (
    <div className={[cls.shell, collapsed ? cls.shellCollapsed : null].filter(Boolean).join(' ')}>
      <Sidebar collapsed={collapsed} />
      <main className={cls.main}>
        <div className={cls.topbar}>
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
          <div className={cls.topbarRight}>
            <div className="hidden items-center gap-3 sm:inline-flex">
              <div className="relative h-10 w-10 animate-pulse rounded-full bg-gradient-to-br from-[#2563EB] via-[#7C3AED] to-[#14B8A6] p-[2px] shadow-lg">
                <div
                  className="relative flex h-full w-full items-center justify-center rounded-full bg-white"
                  style={{ transform: 'perspective(240px) rotateY(-8deg)' }}
                >
                  <div className="absolute top-[11px] flex items-center gap-[8px]">
                    <span className="h-[3px] w-[3px] rounded-full bg-[#1F2937]" />
                    <span className="h-[3px] w-[3px] rounded-full bg-[#1F2937]" />
                  </div>
                  <span className="mt-3 h-[6px] w-[12px] rounded-b-full border-b border-[#1F2937]" />
                </div>
              </div>
              <div className="leading-tight">
                <p className="max-w-[180px] truncate text-sm font-semibold text-[#1F2937]">
                  {currentUser?.name ?? 'CareSense User'}
                </p>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {currentUser?.role ?? 'User'}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
        <div className={cls.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

