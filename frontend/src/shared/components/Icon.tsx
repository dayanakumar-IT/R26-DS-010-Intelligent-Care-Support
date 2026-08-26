import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Footprints,
  HeartPulse,
  LogOut,
  Mic,
  Settings,
  TrendingUp,
  User,
  Users,
} from 'lucide-react'
import type { LucideIcon, LucideProps } from 'lucide-react'

const ICONS = {
  settings: Settings,
  logout: LogOut,
  user: User,
  bell: Bell,
  eye: Eye,
  'eye-off': EyeOff,
  warning: AlertTriangle,
  activity: Activity,
  footprints: Footprints,
  'heart-pulse': HeartPulse,
  mic: Mic,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'bar-chart-3': BarChart3,
  users: Users,
  'trending-up': TrendingUp,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName
}

export default function Icon({ name, ...props }: IconProps) {
  const LucideComponent = ICONS[name]
  return <LucideComponent {...props} />
}
