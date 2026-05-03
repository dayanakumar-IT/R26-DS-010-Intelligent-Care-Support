import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import cls from './layout.module.css'
import { Button } from '../../shared/components/Button'
import { Icon } from '../../shared/components/Icons'

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)

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
          <div className={cls.topbarRight} />
        </div>
        <div className={cls.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

