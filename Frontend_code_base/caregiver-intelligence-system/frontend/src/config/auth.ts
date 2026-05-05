import type { User, UserRole } from '../types/user'

type MockUser = User & { password: string }

export const AUTH_STORAGE_KEY = 'caresense_user'

export const MOCK_USERS: MockUser[] = [
  {
    id: 'admin-001',
    email: 'admin@caresense.lk',
    password: 'Admin@2026',
    role: 'admin' as const,
    name: 'Dr. Nimal Perera',
    institution: 'National Hospital of Sri Lanka',
    ward: null,
  },
  {
    id: 'sup-001',
    email: 'supervisor@caresense.lk',
    password: 'Sup@2026',
    role: 'supervisor' as const,
    name: 'Sr. Kamala Silva',
    institution: 'National Hospital of Sri Lanka',
    ward: 'ICU Ward 3',
  },
  {
    id: 'sup-002',
    email: 'supervisor2@caresense.lk',
    password: 'Sup@2026',
    role: 'supervisor' as const,
    name: 'Sr. Priya Fernando',
    institution: 'National Hospital of Sri Lanka',
    ward: 'General Ward 7',
  },
]

export function authenticateUser(email: string, password: string): User | null {
  const normalizedEmail = email.trim().toLowerCase()
  const match = MOCK_USERS.find((user) => user.email.toLowerCase() === normalizedEmail)

  if (!match || match.password !== password) {
    return null
  }

  return {
    id: match.id,
    email: match.email,
    role: match.role,
    name: match.name,
    institution: match.institution,
    ward: match.ward,
  }
}

export function saveUserToStorage(user: User): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as User
    if (!parsed?.id || !parsed?.email || !parsed?.role) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearStoredUser(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function isAllowedRole(role: string): role is UserRole {
  return role === 'admin' || role === 'supervisor'
}
