import type { Metadata } from 'next'
import { after } from 'next/server'
import { AdminChrome } from '@/features/admin'
import { aiInUse } from '@/features/content/ai/client'
import { requireBoard } from '@/shared/lib/auth/session'
import { recordLastSeen } from '@/shared/lib/presence-server'
import { SITE_NAME } from '@/shared/lib/site'

export const metadata: Metadata = { title: `Admin · ${SITE_NAME}`, robots: { index: false } }

/**
 * Everyone who may see the Board: editors, reviewers, admins and superadmins. The proxy redirects
 * others, this checks again, and each page checks its own section (the users pages need an admin).
 * The admin sign-in page lives outside this group, so it never comes under this check.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const { user } = await requireBoard()

  // Presence, after the response, so an account that works only in the admin still counts as online.
  after(() => recordLastSeen(user.id))

  return (
    <AdminChrome
      viewer={{ role: user.role, editor: user.editor, reviewer: user.reviewer }}
      ai={aiInUse}
    >
      {children}
    </AdminChrome>
  )
}
