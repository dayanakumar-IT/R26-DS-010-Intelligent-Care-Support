import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import cls from './layout.module.css'

export function MainLayout() {
  const [collapsed] = useState(false)

  return (
    <div className={[cls.shell, collapsed ? cls.shellCollapsed : null].filter(Boolean).join(' ')}>
      <Sidebar collapsed={collapsed} />
      <main className={cls.main}>
        <div className={cls.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

