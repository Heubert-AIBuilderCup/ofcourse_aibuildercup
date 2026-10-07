import type { Metadata } from 'next'
import { after } from 'next/server'
import { AdminChrome } from '@/features/admin'
import { requireAdmin } from '@/shared/lib/auth/session'
import { recordLastSeen } from '@/shared/lib/presence-server'
import { SITE_NAME } from '@/shared/lib/site'

export const metadata: Metadata = { title: `Admin · ${SITE_NAME}`, robots: { index: false } }

/** Admins only (admin and superadmin): the proxy redirects others, and this checks again. */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const { user } = await requireAdmin()

  // Presence, after the response, so an admin who works only in the admin still counts as online.
  after(() => recordLastSeen(user.id))

  return <AdminChrome>{children}</AdminChrome>
}
