import { AdminPageHeader, parseUsersParams, UsersList } from '@/features/admin'
import { addRoleInvite, removeRoleInvite } from '@/features/admin/users/actions'
import { getUsers, getWaitingInvites } from '@/features/admin/users/server'
import { canManageRoles } from '@/shared/lib/auth/access'
import { requireAdmin } from '@/shared/lib/auth/session'

/** Every account: search, filters, who's live, and roles waiting on an email. */
export default async function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
  const { user } = await requireAdmin()
  const params = parseUsersParams(await searchParams)
  const managesRoles = canManageRoles(user.role)
  // The waiting addresses are for superadmins only; an admin's page never reads them.
  const [list, waiting] = await Promise.all([
    getUsers(params),
    managesRoles ? getWaitingInvites() : Promise.resolve([]),
  ])
  return (
    <>
      <AdminPageHeader
        kicker="People"
        title="Users"
        lede="Every account, with who is online now. Personal data: for admins only."
      />
      <UsersList
        rows={list.rows}
        total={list.total}
        onlineNow={list.onlineNow}
        accounts={list.accounts}
        staff={list.staff}
        params={params}
        now={Date.now()}
        canManageRoles={managesRoles}
        waiting={waiting}
        addRoleInvite={addRoleInvite}
        removeRoleInvite={removeRoleInvite}
      />
    </>
  )
}
