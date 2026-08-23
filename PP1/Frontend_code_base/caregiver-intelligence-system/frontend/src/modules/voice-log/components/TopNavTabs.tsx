import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Siren,
  AudioLines,
  ShieldCheck,
  Settings,
} from 'lucide-react'

const tabs = [
  { to: '/voice-log/dashboard',           label: 'Dashboard',           icon: LayoutDashboard },
  { to: '/voice-log/patients',            label: 'Patients',            icon: Users           },
  { to: '/voice-log/adl-reports',         label: 'ADL Reports',         icon: ClipboardList   },
  { to: '/voice-log/alerts',              label: 'Alerts',              icon: Siren           },
  { to: '/voice-log/handover-summaries',  label: 'Handover Summaries',  icon: AudioLines      },
  { to: '/voice-log/reviews',             label: 'Reviews',             icon: ShieldCheck     },
  { to: '/voice-log/settings',            label: 'Settings',            icon: Settings        },
] as const

export function TopNavTabs() {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-1.5 pb-0.5">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/voice-log/dashboard'}
              className={({ isActive }) =>
                [
                  'group relative inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-all duration-200',
                  isActive
                    ? 'text-white shadow-md'
                    : 'border-[rgba(15,23,42,0.08)] bg-white text-[rgba(15,23,42,0.65)] hover:text-[rgba(15,23,42,0.88)]',
                ].join(' ')
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background: 'linear-gradient(135deg,#7C3AED 0%,#1E3A8A 100%)',
                      borderColor: 'transparent',
                      boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                    }
                  : {
                      background: '#ffffff',
                    }
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="grid h-7 w-7 place-items-center rounded-lg border transition-all duration-200"
                    style={
                      isActive
                        ? {
                            background: 'rgba(255,255,255,0.22)',
                            borderColor: 'rgba(255,255,255,0.28)',
                            color: '#ffffff',
                          }
                        : {
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(30,58,138,0.06))',
                            borderColor: 'rgba(15,23,42,0.08)',
                            color: 'rgba(15,23,42,0.68)',
                          }
                    }
                  >
                    <Icon size={15} />
                  </span>
                  <span className="whitespace-nowrap">{t.label}</span>

                  {/* hover underline – only for inactive */}
                  {!isActive && (
                    <span
                      className="absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full transition-all duration-200 group-hover:w-5"
                      style={{ background: 'linear-gradient(90deg,#7C3AED,#1E3A8A)' }}
                      aria-hidden
                    />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
