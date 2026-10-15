/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Role } from '@/shared/lib/auth/access'
import type { ActionResult } from '@/shared/types/action-result'
import type { UserDetail } from '../users/server'
import { UserPage, type UserPageProps } from './UserPage'

const NOW = Date.UTC(2026, 9, 2, 6, 0, 0)
const MINUTE = 60_000
const PIXEL_8_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'

const user: UserDetail = {
  id: 'u1',
  email: 'alex@example.com',
  name: 'Alex Doe',
  role: 'user',
  editor: false,
  reviewer: false,
  suspendedAt: null,
  suspendReason: null,
  createdAt: new Date(Date.UTC(2026, 8, 1, 8, 30)),
  sessions: [{ id: 's1', createdAt: new Date(NOW - 86_400_000), userAgent: PIXEL_8_CHROME }],
  lastSeenMs: NOW - 12 * MINUTE,
}

const ok = async (): Promise<ActionResult> => ({ ok: true })
const actions = {
  setRole: mock(async (_id: string, _role: string) => ok()),
  setCapabilities: mock(async (_id: string, _editor: boolean, _reviewer: boolean) => ok()),
  suspendAccount: mock(async (_id: string, _reason: string) => ok()),
  reactivateAccount: mock(async (_id: string) => ok()),
  signOutEverywhere: mock(async (_id: string) => ok()),
}

const ADMIN = { id: 'a1', role: 'admin' as Role }
const SUPERADMIN = { id: 's1', role: 'superadmin' as Role }

const view = (over: Partial<UserPageProps> = {}) =>
  render(
    <UserPage
      user={user}
      viewer={ADMIN}
      now={NOW}
      activeSuperadmins={2}
      actions={actions}
      {...over}
    />,
  )

afterEach(() => {
  cleanup()
  for (const a of Object.values(actions)) a.mockClear()
})

const HIERARCHY = 'Only a superadmin can act on admins and superadmins.'

const definition = (term: string) => {
  const dd = screen.getByText(term, { selector: 'dt' }).nextElementSibling
  if (dd?.tagName !== 'DD') throw new Error(`no definition for ${term}`)
  return dd
}

it('shows who they are, their role and status', () => {
  view()
  expect(screen.getByRole('heading', { level: 1, name: 'Alex Doe' })).toBeInTheDocument()
  expect(screen.getByText('User')).toBeInTheDocument()
  expect(screen.getByText('Active')).toBeInTheDocument()
  expect(definition('Email')).toHaveTextContent('alex@example.com')
  expect(definition('Joined')).toHaveTextContent('1 Sep 2026, 08:30')
})

it('offers an admin on a user the account controls but no role control', () => {
  view()
  expect(screen.getByRole('button', { name: 'Suspend…' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Role' })).toBeNull()
  expect(screen.queryByText(HIERARCHY)).toBeNull()
})

it('offers an admin on an admin no account control, and says why', () => {
  view({ user: { ...user, role: 'admin' } })
  expect(screen.queryByRole('button', { name: 'Suspend…' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Sign out everywhere' })).toBeNull()
  expect(screen.getByText(HIERARCHY)).toBeInTheDocument()
})

it('offers a superadmin on a user the role select', () => {
  view({ viewer: SUPERADMIN })
  expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument()
})

const SUPERADMIN_ONLY = 'Only a superadmin can change roles.'

it('shows an admin no Editor or Reviewer control, and says why', () => {
  view()
  expect(screen.getByText(SUPERADMIN_ONLY)).toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: 'Editor' })).toBeNull()
  expect(screen.queryByRole('checkbox', { name: 'Reviewer' })).toBeNull()
})

it('offers a superadmin the Editor and Reviewer checkboxes, showing what the account holds', () => {
  view({ viewer: SUPERADMIN, user: { ...user, reviewer: true } })
  expect(screen.getByRole('checkbox', { name: 'Editor' })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Reviewer' })).toBeChecked()
  expect(screen.queryByText(SUPERADMIN_ONLY)).toBeNull()
})

it('asks before giving a capability, then saves both flags', async () => {
  view({ viewer: SUPERADMIN, user: { ...user, reviewer: true } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Editor' }))
  const dialog = screen.getByRole('dialog')
  expect(
    within(dialog).getByText('Give Alex Doe Editor? They are signed out of every session.'),
  ).toBeInTheDocument()
  expect(actions.setCapabilities).not.toHaveBeenCalled()
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change access' }))
  })
  expect(actions.setCapabilities).toHaveBeenCalledWith('u1', true, true)
})

it('asks before removing a capability', async () => {
  view({ viewer: SUPERADMIN, user: { ...user, reviewer: true } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Reviewer' }))
  const dialog = screen.getByRole('dialog')
  expect(
    within(dialog).getByText(
      'Remove Reviewer from Alex Doe? They are signed out of every session.',
    ),
  ).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change access' }))
  })
  expect(actions.setCapabilities).toHaveBeenCalledWith('u1', false, false)
})

it('offers the viewer only "Sign out everywhere" on their own page', () => {
  view({ user: { ...user, id: 's1', role: 'superadmin' }, viewer: SUPERADMIN })
  expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Suspend…' })).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'Role' })).toBeNull()
})

it('asks before changing a role, then changes it', async () => {
  view({ viewer: SUPERADMIN })
  const nativeRole = screen.getByRole('form', { name: 'Role' }).querySelector('select')
  if (!nativeRole) throw new Error('no native role select')
  fireEvent.change(nativeRole, { target: { value: 'admin' } })
  const dialog = screen.getByRole('dialog')
  expect(
    within(dialog).getByText('Change Alex Doe to Admin? They are signed out of every session.'),
  ).toBeInTheDocument()
  expect(actions.setRole).not.toHaveBeenCalled()
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change role' }))
  })
  expect(actions.setRole).toHaveBeenCalledWith('u1', 'admin')
})

it('asks before signing someone out everywhere', async () => {
  view()
  fireEvent.click(screen.getByRole('button', { name: 'Sign out everywhere' }))
  expect(actions.signOutEverywhere).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog')
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))
  })
  expect(actions.signOutEverywhere).toHaveBeenCalledWith('u1')
})

it('shows a suspension with its reason and offers to reactivate', () => {
  view({
    user: {
      ...user,
      suspendedAt: new Date(Date.UTC(2026, 9, 26, 10, 45)),
      suspendReason: 'Spam',
    },
  })
  expect(screen.getByText('Suspended 26 Oct 2026, 10:45: Spam')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Suspend…' })).toBeNull()
})

it('suspends with the reason given in the dialog', async () => {
  view()
  fireEvent.click(screen.getByRole('button', { name: 'Suspend…' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Spam' } })
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }))
  })
  expect(actions.suspendAccount).toHaveBeenCalledWith('u1', 'Spam')
})

it("shows the server's refusal beside the control", async () => {
  actions.suspendAccount.mockImplementationOnce(async () => ({
    ok: false,
    error: 'Give a reason.',
  }))
  view()
  fireEvent.click(screen.getByRole('button', { name: 'Suspend…' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'x' } })
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }))
  })
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Give a reason.')
})

it('says when there are no open sessions', () => {
  view({ user: { ...user, sessions: [] } })
  expect(screen.getByText('No open sessions')).toBeInTheDocument()
})

it('names the browser and device of each session, and when they were last seen', () => {
  view()
  expect(screen.getByText(/Chrome · Android phone/)).toBeInTheDocument()
  expect(screen.getByText(/started 1 Oct 2026, 06:00/)).toBeInTheDocument()
  expect(screen.getByText('12m ago')).toBeInTheDocument()
})
