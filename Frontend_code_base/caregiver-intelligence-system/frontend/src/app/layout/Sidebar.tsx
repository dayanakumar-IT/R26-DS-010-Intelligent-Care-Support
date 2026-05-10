import { NavLink } from 'react-router-dom'
import type { CSSProperties } from 'react'
import logo from '../../assets/care-sense-logo.png'
import { Icon } from '../../shared/components/Icons'
import cls from './layout.module.css'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', color: '#1E3A8A' },
  {
    to: '/deterioration',
    label: 'Deterioration Detection',
    icon: 'deterioration',
    color: '#7C3AED',
  },
  { to: '/voice-log', label: 'Voice Log', icon: 'voice', color: '#0EA5E9' },
  { to: '/fall-detection', label: 'Fall Detection', icon: 'fall', color: '#F97316' },
  { to: '/sign-vitals', label: 'Sign & Vitals', icon: 'vitals', color: '#10B981' },
  { to: '/reports', label: 'Reports', icon: 'reports', color: '#6366F1' },
  { to: '/settings', label: 'Settings', icon: 'settings', color: '#64748B' },
] as const

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside className={[cls.sidebar, collapsed ? cls.sidebarCollapsed : null].filter(Boolean).join(' ')}>
      <div className={cls.brand} role="banner">
        <div className={cls.brandMark}>
          <img className={cls.brandLogo} src={logo} alt="CareSense" />
        </div>
        <div className={cls.brandText} aria-hidden={collapsed}>
          <div className={cls.brandName}>CareSense</div>
          <div className={cls.brandTagline}>Care Beyond Words</div>
        </div>
      </div>

      <nav className={cls.nav}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={{ ['--nav-accent' as never]: item.color } as CSSProperties}
            className={({ isActive }) =>
              [cls.navItem, isActive ? cls.navItemActive : null]
                .filter(Boolean)
                .join(' ')
            }
            end={item.to === '/dashboard' || item.to === '/sign-vitals'}
          >
            <span className={cls.navIcon}>
              <Icon name={item.icon} />
            </span>
            <span className={cls.navLabel} aria-hidden={collapsed}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

