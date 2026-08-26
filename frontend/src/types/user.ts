export type UserRole = 'admin' | 'supervisor' | 'caregiver'

export interface User {
  id: string
  email: string
  role: UserRole
  name: string
  institution: string
  ward: string
}
