import { redirect } from 'next/navigation'
import { adminHome } from '@/shared/lib/auth/gate'
import { requireBoard } from '@/shared/lib/auth/session'

/** The admin opens on the Board for editors, reviewers and superadmins, and on Users for an admin. */
export default async function AdminPage() {
  const { user } = await requireBoard()
  redirect(adminHome(user))
}
