import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// GLOSS-specific internal navigation. Scoped ENTIRELY to the
// SignLanguage experience — it is not the global CareSense sidebar and
// adds no URL routes (tab state is local useState in SignLanguage.tsx).
// Styling values below are fixed by spec (Task 2).

export interface GlossTab<T extends string> {
  id: T
  label: string
  icon: LucideIcon
}

interface GlossTabBarProps<T extends string> {
  tabs: ReadonlyArray<GlossTab<T>>
  activeId: T
  onChange: (id: T) => void
  children: ReactNode
}

export default function GlossTabBar<T extends string>({
  tabs,
  activeId,
  onChange,
  children,
}: GlossTabBarProps<T>) {
  return (
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label="Sign language learning sections"
        className="flex items-end overflow-x-auto border-b border-slate-200"
        style={{ gap: '24px' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className="flex shrink-0 items-center transition-colors"
              style={{
                height: '44px',
                padding: '0 16px',
                fontSize: '14px',
                fontWeight: 500,
                gap: '4px',
                borderBottom: active
                  ? '2px solid var(--brand-blue)'
                  : '2px solid transparent',
                color: active ? 'var(--brand-blue)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        style={{
          marginTop: '24px',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {children}
      </div>
    </div>
  )
}