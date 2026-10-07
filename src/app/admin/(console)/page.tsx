import { redirect } from 'next/navigation'

/** The admin opens on its first section. */
export default function AdminPage() {
  redirect('/admin/users')
}
