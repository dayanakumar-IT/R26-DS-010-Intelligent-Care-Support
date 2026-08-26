import type { IconName } from '../../shared/components/Icon'

export interface NavEntry {
  to: string
  label: string
  icon: IconName
}

export const navigation: NavEntry[] = [
  { to: '/deterioration', label: 'Deterioration Detection', icon: 'activity' },
  { to: '/fall-detection', label: 'Fall Detection', icon: 'footprints' },
  { to: '/sign-vitals', label: 'Sign & Vitals', icon: 'heart-pulse' },
  { to: '/voice-log', label: 'Voice Log', icon: 'mic' },
]
