import { redirect } from 'next/navigation'
import { ADMIN_HOME } from '@/shared/lib/auth/gate'

/** The admin opens on its first section. */
export default function AdminPage() {
  redirect(ADMIN_HOME)
}
