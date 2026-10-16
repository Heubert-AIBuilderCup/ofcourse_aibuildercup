// Words for the admin tables.

import type { Role } from '@/shared/lib/auth/access'

export const ROLE_LABELS: Record<Role, string> = {
  user: 'User',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

export const CAPABILITY_LABELS = { editor: 'Editor', reviewer: 'Reviewer' } as const
