import type { SVGProps } from 'react'

type IconName =
  | 'chevron'
  | 'dashboard'
  | 'deterioration'
  | 'voice'
  | 'fall'
  | 'vitals'
  | 'reports'
  | 'settings'

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  }

  switch (name) {
    case 'chevron':
      return (
        <svg {...common}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      )
    case 'dashboard':
      return (
        <svg {...common}>
          <path d="M4 13a8 8 0 1 1 16 0" />
          <path d="M12 13l3-3" />
          <path d="M6.5 19.5h11" />
        </svg>
      )
    case 'deterioration':
      return (
        <svg {...common}>
          <path d="M3 12h4l2-6 4 14 2-8h6" />
        </svg>
      )
    case 'voice':
      return (
        <svg {...common}>
          <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z" />
          <path d="M19 11a7 7 0 0 1-14 0" />
          <path d="M12 18v3" />
        </svg>
      )
    case 'fall':
      return (
        <svg {...common}>
          <circle cx="9" cy="6" r="2" />
          <path d="M8 22l2-6 2 2 3-4" />
          <path d="M6.5 12.5l3-2.5 2 2.5" />
        </svg>
      )
    case 'vitals':
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M20 19V5" />
          <path d="M7 14h3l2-4 2 6h3" />
        </svg>
      )
    case 'reports':
      return (
        <svg {...common}>
          <path d="M9 3h6" />
          <path d="M10 3v4" />
          <path d="M14 3v4" />
          <rect x="6" y="7" width="12" height="14" rx="2" />
          <path d="M9 11h6" />
          <path d="M9 15h6" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.1-2-3.4-2.2.5a7.6 7.6 0 0 0-1.7-1L15 5h-6l-.6 2.9a7.6 7.6 0 0 0-1.7 1l-2.2-.5-2 3.4L4.6 13a7.9 7.9 0 0 0 .1 2L2.7 16.1l2 3.4 2.2-.5a7.6 7.6 0 0 0 1.7 1L9 23h6l.6-2.9a7.6 7.6 0 0 0 1.7-1l2.2.5 2-3.4L19.4 15Z" />
        </svg>
      )
  }
}

