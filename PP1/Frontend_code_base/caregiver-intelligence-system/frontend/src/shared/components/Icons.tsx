import type { SVGProps } from 'react'
import {
  Activity,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Mic,
  PersonStanding,
  Settings,
  HeartPulse,
} from 'lucide-react'

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
  const size =
    typeof props.width === 'number'
      ? props.width
      : typeof props.height === 'number'
        ? props.height
        : 18

  const common = {
    size,
    color: 'currentColor',
    strokeWidth: 2,
    ...props,
  }

  switch (name) {
    case 'chevron':
      return <ChevronRight {...common} />
    case 'dashboard':
      return <LayoutDashboard {...common} />
    case 'deterioration':
      return <Activity {...common} />
    case 'voice':
      return <Mic {...common} />
    case 'fall':
      return <PersonStanding {...common} />
    case 'vitals':
      return <HeartPulse {...common} />
    case 'reports':
      return <FileText {...common} />
    case 'settings':
      return <Settings {...common} />
  }
}

