import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { navigation } from '../config/navigation'
import Icon from '../../shared/components/Icon'
import { getStoredUser, logout } from '../../services/authService'
import type { User } from '../../types/user'
import styles from './layout.module.css'

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase()
}

export default function Sidebar() {
  const navigateTo = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let isMounted = true

    getStoredUser().then((profile) => {
      if (isMounted) setUser(profile)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    navigateTo('/login', { replace: true })
  }

  return (
    <aside className={cx(styles.sidebar, collapsed && styles.sidebarCollapsed)}>
      <div className={styles.brandSection}>
        <div className={styles.brandMark}>CS</div>
        {!collapsed && (
          <div>
            <div className={styles.brandName}>CareSense</div>
            <div className={styles.brandTagline}>Care Beyond Words</div>
          </div>
        )}
      </div>

      <div className={styles.userSection}>
        <div className={styles.avatar}>
          {user ? getInitials(user.name) : <Icon name="user" size={16} />}
        </div>
        {!collapsed && user && (
          <div className={styles.userInfo}>
            <div className={styles.userInfoName}>{user.name}</div>
            <div className={styles.userInfoRole}>{user.role}</div>
          </div>
        )}
      </div>

      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {navigation.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cx(
                    styles.navLink,
                    isActive && styles.navLinkActive,
                    collapsed && styles.navLinkCollapsed,
                  )
                }
              >
                <Icon name={item.icon} size={18} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.divider} />

      <div className={styles.bottomNav}>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cx(
              styles.navLink,
              isActive && styles.navLinkActive,
              collapsed && styles.navLinkCollapsed,
            )
          }
        >
          <Icon name="settings" size={18} />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button
          type="button"
          onClick={handleLogout}
          className={cx(styles.navLink, styles.logoutLink, collapsed && styles.navLinkCollapsed)}
        >
          <Icon name="logout" size={18} />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className={styles.collapseToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
      </button>
    </aside>
  )
}
