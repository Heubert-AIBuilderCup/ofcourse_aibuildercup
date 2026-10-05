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
  suspended: false,
  lastSeenMs: null,
  createdAt: new Date(NOW - 86_400_000),
  ...over,
})

const rows: UserListRow[] = [
  row({ id: 'u1', name: 'Asha Rai', lastSeenMs: NOW - MINUTE, suspended: true }),
  row({ id: 'u2', name: 'Bikash Thapa', lastSeenMs: NOW - 12 * MINUTE }),
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
  { email: 'new.admin@example.com', role: 'admin', createdAt: new Date(NOW), createdByName: 'J' },
]

const addRoleInvite = mock(async (_email: string, _role: string) => ({
  ok: true as const,
  applied: 'invite' as 'invite' | 'account',
}))
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
  expect(addRoleInvite).toHaveBeenCalledWith('boss@example.com', 'superadmin')
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
  expect(addRoleInvite).toHaveBeenCalledWith('asha@example.com', 'admin')
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
    fireEvent.click(within(list).getByRole('button', { name: /Remove/ }))
  })
  expect(removeRoleInvite).toHaveBeenCalledWith('new.admin@example.com')
})
