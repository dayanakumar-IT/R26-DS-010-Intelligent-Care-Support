import { NavLink } from 'react-router-dom'
import type { CSSProperties } from 'react'
import logo from '../../assets/care-sense-logo.png'
import { Button } from '../../shared/components/Button'
import { Icon } from '../../shared/components/Icons'
import cls from './layout.module.css'

const nav = [
  {
    to: '/deterioration',
    label: 'Deterioration Detection',
    icon: 'deterioration',
    color: 'var(--brand-purple)',
  },
  { to: '/voice-log', label: 'Voice Log', icon: 'voice', color: 'var(--brand-blue)' },
  { to: '/fall-detection', label: 'Fall Detection', icon: 'fall', color: 'var(--brand-accent)' },
  { to: '/sign-vitals', label: 'Sign & Vitals', icon: 'vitals', color: 'var(--brand-purple)' },
  { to: '/reports', label: 'Reports', icon: 'reports', color: 'var(--brand-blue)' },
  { to: '/settings', label: 'Settings', icon: 'settings', color: 'var(--brand-purple)' },
] as const

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  showCollapseInSidebar,
}: {
  collapsed: boolean
  onToggleCollapsed?: () => void
  showCollapseInSidebar?: boolean
}) {
  return (
    <aside className={[cls.sidebar, collapsed ? cls.sidebarCollapsed : null].filter(Boolean).join(' ')}>
      <div className={cls.brand} role="banner">
        <div className={cls.brandLeft}>
          <div className={cls.brandMark}>
            <img className={cls.brandLogo} src={logo} alt="CareSense" />
          </div>
          <div className={cls.brandText} aria-hidden={collapsed}>
            <div className={cls.brandName}>CareSense</div>
            <div className={cls.brandTagline}>Care Beyond Words</div>
          </div>
        </div>
        {showCollapseInSidebar && onToggleCollapsed ? (
          <Button
            variant="ghost"
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapsed}
            style={{
              flexShrink: 0,
              transform: collapsed ? 'rotate(180deg)' : undefined,
            }}
          >
            <Icon name="chevron" />
          </Button>
        ) : null}
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
            end={item.to === '/sign-vitals'}
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

