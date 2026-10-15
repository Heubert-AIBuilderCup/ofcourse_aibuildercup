import { notFound } from 'next/navigation'
import { UserPage } from '@/features/admin'
import {
  reactivateAccount,
  setCapabilities,
  setRole,
  signOutEverywhere,
  suspendAccount,
} from '@/features/admin/users/actions'
import { countActiveSuperadmins, getUserDetail } from '@/features/admin/users/server'
import { isRole } from '@/shared/lib/auth/access'
import { requireAdmin } from '@/shared/lib/auth/session'

const actions = {
  setRole,
  setCapabilities,
  suspendAccount,
  reactivateAccount,
  signOutEverywhere,
}

/** One account: every field, and the controls this viewer may use. Each action checks again. */
export default async function AdminUserPage({ params }: PageProps<'/admin/users/[id]'>) {
  const { user: viewer } = await requireAdmin()
  // requireAdmin let only an admin or a superadmin through; this narrows the type.
  if (!isRole(viewer.role)) notFound()
  const { id } = await params
  const [user, activeSuperadmins] = await Promise.all([getUserDetail(id), countActiveSuperadmins()])
  if (!user) notFound()
  return (
    <UserPage
      user={user}
      viewer={{ id: viewer.id, role: viewer.role }}
      now={Date.now()}
      activeSuperadmins={activeSuperadmins}
      actions={actions}
    />
  )
}
