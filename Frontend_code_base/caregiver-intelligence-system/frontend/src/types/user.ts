export type UserRole = 'admin' | 'supervisor'

export interface User {
  id: string
  email: string
  role: UserRole
  name: string
  institution: string
  ward: string | null
}
