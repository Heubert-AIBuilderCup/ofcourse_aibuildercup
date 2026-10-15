/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { UsersParams } from '../lib/params'
import type { UserListRow, WaitingInvite } from '../users/server'

const replace = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ replace, push: () => {}, refresh: () => {} }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams(),
}))

const { UsersList } = await import('./UsersList')

const NOW = Date.UTC(2026, 9, 2, 6, 0, 0)
const MINUTE = 60_000

const row = (over: Partial<UserListRow> & Pick<UserListRow, 'id' | 'name'>): UserListRow => ({
  email: `${over.id}@example.com`,
  role: 'user',
  editor: false,
  reviewer: false,
  suspended: false,
  lastSeenMs: null,
  createdAt: new Date(NOW - 86_400_000),
  ...over,
})

const rows: UserListRow[] = [
  row({ id: 'u1', name: 'Asha Rai', lastSeenMs: NOW - MINUTE, suspended: true }),
  row({
    id: 'u2',
    name: 'Bikash Thapa',
    lastSeenMs: NOW - 12 * MINUTE,
    editor: true,
    reviewer: true,
  }),
  row({ id: 'u3', name: 'Chandra Gurung', lastSeenMs: null }),
]

const params: UsersParams = {
  q: '',
  role: 'all',
  status: 'all',
  online: false,
  page: 0,
}

const waiting: WaitingInvite[] = [
  {
    email: 'new.admin@example.com',
    role: 'admin',
    editor: false,
    reviewer: true,
    createdAt: new Date(NOW),
    createdByName: 'J',
  },
  {
    email: 'new.editor@example.com',
    role: null,
    editor: true,
    reviewer: false,
    createdAt: new Date(NOW),
    createdByName: 'J',
  },
]

const addRoleInvite = mock(
  async (_email: string, _role: string | null, _caps: { editor: boolean; reviewer: boolean }) => ({
    ok: true as const,
    applied: 'invite' as 'invite' | 'account',
  }),
)
const NO_CAPS = { editor: false, reviewer: false }
const removeRoleInvite = mock(async (_email: string) => ({ ok: true as const }))

const props = {
  rows,
  total: 3,
  onlineNow: 3,
  params,
  now: NOW,
  canManageRoles: false,
  waiting: [] as WaitingInvite[],
  addRoleInvite,
  removeRoleInvite,
}

afterEach(() => {
  cleanup()
  replace.mockClear()
  addRoleInvite.mockClear()
  removeRoleInvite.mockClear()
})

const rowOf = (name: string) => {
  const tr = screen.getByRole('link', { name }).closest('tr')
  if (!tr) throw new Error(`no row for ${name}`)
  return within(tr)
}

it('says how many people are online now', () => {
  render(<UsersList {...props} />)
  expect(screen.getByText('3 online now')).toBeInTheDocument()
})

it('labels when each person was last seen, by the server clock', () => {
  render(<UsersList {...props} />)
  expect(rowOf('Asha Rai').getByText('Online')).toBeInTheDocument()
  expect(rowOf('Bikash Thapa').getByText('12m ago')).toBeInTheDocument()
  expect(rowOf('Chandra Gurung').getByText('Never')).toBeInTheDocument()
})

it("links each name to that account's page", () => {
  render(<UsersList {...props} />)
  expect(screen.getByRole('link', { name: 'Asha Rai' })).toHaveAttribute('href', '/admin/users/u1')
  expect(screen.getByRole('link', { name: 'Chandra Gurung' })).toHaveAttribute(
    'href',
    '/admin/users/u3',
  )
})

it('marks a suspended account', () => {
  render(<UsersList {...props} />)
  expect(rowOf('Asha Rai').getByText('Suspended')).toBeInTheDocument()
  expect(rowOf('Bikash Thapa').queryByText('Suspended')).toBeNull()
})

it('searches through the address', () => {
  render(<UsersList {...props} />)
  fireEvent.change(screen.getByLabelText('Search users'), { target: { value: ' asha ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(replace).toHaveBeenCalledWith('/admin/users?q=asha')
})

it('filters to who is online now through the address', () => {
  render(<UsersList {...props} />)
  fireEvent.click(screen.getByRole('switch', { name: 'Online now' }))
  expect(replace).toHaveBeenCalledWith('/admin/users?online=1')
})

it('offers an admin no way to add an address or see the waiting list', () => {
  render(<UsersList {...props} waiting={waiting} />)
  expect(screen.queryByRole('heading', { name: 'Add by email' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Waiting for first sign-in' })).toBeNull()
  expect(screen.queryByText('new.admin@example.com')).toBeNull()
})

it('adds an address with a role and says nothing is sent', async () => {
  render(<UsersList {...props} canManageRoles waiting={waiting} />)
  const form = screen.getByRole('form', { name: 'Add by email' })
  fireEvent.change(within(form).getByLabelText('Email'), {
    target: { value: 'boss@example.com' },
  })
  const nativeRole = form.querySelector('select')
  if (!nativeRole) throw new Error('no role select in the form')
  fireEvent.change(nativeRole, { target: { value: 'superadmin' } })
  await act(async () => {
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }))
  })
  expect(addRoleInvite).toHaveBeenCalledWith('boss@example.com', 'superadmin', NO_CAPS)
  expect(
    screen.getByText(
      'boss@example.com becomes Superadmin at their first sign-in. Nothing is sent to them; tell them yourself.',
    ),
  ).toBeInTheDocument()
})

it('says the role applied at once for an address that already has an account', async () => {
  addRoleInvite.mockImplementationOnce(async () => ({ ok: true as const, applied: 'account' }))
  render(<UsersList {...props} canManageRoles />)
  const form = screen.getByRole('form', { name: 'Add by email' })
  fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'asha@example.com' } })
  await act(async () => {
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }))
  })
  expect(addRoleInvite).toHaveBeenCalledWith('asha@example.com', 'admin', NO_CAPS)
  expect(screen.getByText('asha@example.com is now Admin.')).toBeInTheDocument()
})

it('shows the refusal when an address cannot be added', async () => {
  addRoleInvite.mockImplementationOnce(
    async () => ({ ok: false, error: 'Enter a valid email address.' }) as never,
  )
  render(<UsersList {...props} canManageRoles />)
  const form = screen.getByRole('form', { name: 'Add by email' })
  fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'nope' } })
  await act(async () => {
    fireEvent.submit(form)
  })
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
})

it('lists the waiting addresses and removes one', async () => {
  render(<UsersList {...props} canManageRoles waiting={waiting} />)
  const list = screen.getByRole('region', { name: 'Waiting for first sign-in' })
  expect(within(list).getByText('new.admin@example.com')).toBeInTheDocument()
  expect(within(list).getByText('Admin')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(within(list).getByRole('button', { name: 'Remove new.admin@example.com' }))
  })
  expect(removeRoleInvite).toHaveBeenCalledWith('new.admin@example.com')
})

it('shows the Editor and Reviewer chips beside the role', () => {
  render(<UsersList {...props} />)
  expect(rowOf('Bikash Thapa').getByText('Editor')).toBeInTheDocument()
  expect(rowOf('Bikash Thapa').getByText('Reviewer')).toBeInTheDocument()
  expect(rowOf('Asha Rai').queryByText('Editor')).toBeNull()
  expect(rowOf('Asha Rai').queryByText('Reviewer')).toBeNull()
})

it('shows what each waiting address will get', () => {
  render(<UsersList {...props} canManageRoles waiting={waiting} />)
  const list = screen.getByRole('region', { name: 'Waiting for first sign-in' })
  const item = (address: string) => {
    const li = within(list).getByText(address).closest('li')
    if (!li) throw new Error(`no item for ${address}`)
    return within(li)
  }
  expect(item('new.admin@example.com').getByText('Admin')).toBeInTheDocument()
  expect(item('new.admin@example.com').getByText('Reviewer')).toBeInTheDocument()
  expect(item('new.admin@example.com').queryByText('Editor')).toBeNull()
  expect(item('new.editor@example.com').getByText('Editor')).toBeInTheDocument()
  expect(item('new.editor@example.com').queryByText('Admin')).toBeNull()
})

it('adds an address with no admin role, only capabilities', async () => {
  render(<UsersList {...props} canManageRoles />)
  const form = screen.getByRole('form', { name: 'Add by email' })
  fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'ed@example.com' } })
  const nativeRole = form.querySelector('select')
  if (!nativeRole) throw new Error('no role select in the form')
  fireEvent.change(nativeRole, { target: { value: 'none' } })
  fireEvent.click(within(form).getByRole('checkbox', { name: 'Editor' }))
  fireEvent.click(within(form).getByRole('checkbox', { name: 'Reviewer' }))
  await act(async () => {
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }))
  })
  expect(addRoleInvite).toHaveBeenCalledWith('ed@example.com', null, {
    editor: true,
    reviewer: true,
  })
  expect(
    screen.getByText(
      'ed@example.com becomes Editor and Reviewer at their first sign-in. Nothing is sent to them; tell them yourself.',
    ),
  ).toBeInTheDocument()
})

it('warns before removing a tick an existing account holds, and saves only once confirmed', async () => {
  addRoleInvite.mockImplementationOnce(
    async () =>
      ({ ok: true as const, applied: 'confirm', removes: ['editor'] }) as unknown as {
        ok: true
        applied: 'invite' | 'account'
      },
  )
  addRoleInvite.mockImplementationOnce(async () => ({ ok: true as const, applied: 'account' }))
  render(<UsersList {...props} canManageRoles />)
  const form = screen.getByRole('form', { name: 'Add by email' })
  fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'asha@example.com' } })
  await act(async () => {
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }))
  })
  expect(
    screen.getByText('asha@example.com already has Editor; saving without Editor removes it.'),
  ).toBeInTheDocument()
  expect(screen.queryByText('asha@example.com is now Admin.')).toBeNull()

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save and remove' }))
  })
  expect(addRoleInvite).toHaveBeenLastCalledWith('asha@example.com', 'admin', NO_CAPS, true)
  expect(screen.getByText('asha@example.com is now Admin.')).toBeInTheDocument()
})
