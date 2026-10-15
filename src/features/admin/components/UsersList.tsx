'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useState, useTransition } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { INVITE_ROLES, type InviteRole, ROLES } from '@/shared/lib/auth/access'
import { lastSeenLabel } from '@/shared/lib/presence'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { NETWORK_ERROR, useAdminAction } from '../hooks/useAdminAction'
import { CAPABILITY_LABELS, ROLE_LABELS } from '../lib/labels'
import {
  USER_STATUS_FILTERS,
  USERS_PAGE_SIZE,
  type UserStatusFilter,
  type UsersParams,
} from '../lib/params'
import type { InviteApplied } from '../users/commands'
import type { UserListRow, WaitingInvite } from '../users/server'
import { CheckField } from './CheckField'
import { Field } from './Field'
import { Pager } from './Pager'
import { chip, hint } from './styles'

const STATUS_LABELS: Record<UserStatusFilter, string> = {
  all: 'All',
  active: 'Active',
  suspended: 'Suspended',
}

type Capability = keyof typeof CAPABILITY_LABELS
type Capabilities = Record<Capability, boolean>
const CAPABILITIES: readonly Capability[] = ['editor', 'reviewer']

/** The invite form's role choice for an address that gets only capabilities. */
const NO_ROLE = 'none'
type InviteChoice = InviteRole | typeof NO_ROLE
const INVITE_CHOICE_LABELS: Record<InviteChoice, string> = {
  none: 'No admin role',
  admin: ROLE_LABELS.admin,
  superadmin: ROLE_LABELS.superadmin,
}

/** A chip per capability the account or the invite holds. */
function CapabilityChips({ caps }: { caps: Capabilities }) {
  return CAPABILITIES.filter((c) => caps[c]).map((c) => (
    <span key={c} className={cn(chip, 'text-caption')}>
      {CAPABILITY_LABELS[c]}
    </span>
  ))
}

/** "Editor", "Editor and Reviewer": the capabilities named, joined. */
function capabilityList(caps: readonly Capability[]): string {
  const names = caps.map((c) => CAPABILITY_LABELS[c])
  const last = names.pop() ?? ''
  return names.length ? `${names.join(', ')} and ${last}` : last
}

/** "<address> already has Editor; saving without Editor removes it." */
function removalWarning(address: string, removes: readonly Capability[]): string {
  const list = capabilityList(removes)
  return `${address} already has ${list}; saving without ${list} removes ${removes.length > 1 ? 'them' : 'it'}.`
}

/** "Admin", "Editor and Reviewer", "Admin, Editor and Reviewer": what an address gets. */
function accessLabel(role: InviteRole | null, caps: Capabilities): string {
  const names = [
    ...(role ? [ROLE_LABELS[role]] : []),
    ...CAPABILITIES.filter((c) => caps[c]).map((c) => CAPABILITY_LABELS[c]),
  ]
  const last = names.pop() ?? ''
  return names.length ? `${names.join(', ')} and ${last}` : last
}

export type UsersListProps = {
  rows: UserListRow[]
  total: number
  onlineNow: number
  params: UsersParams
  /** The server's clock, so the last-seen labels match on hydration. */
  now: number
  canManageRoles: boolean
  /** The addresses waiting on a first sign-in; empty for admins. */
  waiting: WaitingInvite[]
  /**
   * `role` is null for no admin role, when only capabilities are given. An existing account
   * that would lose a capability answers `confirm` until `confirmed` is true.
   */
  addRoleInvite: (
    email: string,
    role: string | null,
    caps: Capabilities,
    confirmed?: boolean,
  ) => Promise<ActionResult<InviteApplied>>
  removeRoleInvite: (email: string) => Promise<ActionResult>
}

/** Patch the address's search parameters; an empty value drops the parameter. */
function useGo() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    router.replace(`${pathname}?${next.toString()}`)
  }
}

/** Every account: search, filters, who's live, and roles waiting on an email. */
export function UsersList(props: UsersListProps) {
  const { rows, total, onlineNow, params, now, canManageRoles, waiting } = props
  const go = useGo()

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-center gap-2 text-base font-semibold text-foreground">
        <span aria-hidden className="size-2 rounded-full bg-primary" />
        {onlineNow} online now
      </p>

      <UsersFilters params={params} go={go} />

      <Card>
        <Table>
          <TableCaption className="sr-only">Users</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <UserRow key={u.id} user={u} now={now} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No users match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <Pager
        total={total}
        page={params.page}
        pageSize={USERS_PAGE_SIZE}
        noun="users"
        onPage={(n) => go({ page: n ? String(n) : '' })}
      />

      {canManageRoles && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AddByEmail addRoleInvite={props.addRoleInvite} />
          <WaitingList waiting={waiting} removeRoleInvite={props.removeRoleInvite} />
        </div>
      )}
    </div>
  )
}

function UsersFilters({
  params,
  go,
}: {
  params: UsersParams
  go: (patch: Record<string, string>) => void
}) {
  const [text, setText] = useState(params.q)
  const search = (e: FormEvent) => {
    e.preventDefault()
    go({ q: text.trim(), page: '' })
  }
  // Every filter starts the list again from its first page; "all" leaves the address clean.
  const pick = (key: string) => (v: string) => go({ [key]: v === 'all' ? '' : v, page: '' })
  const toggle = (key: string) => (on: boolean) => go({ [key]: on ? '1' : '', page: '' })

  return (
    <div className="flex flex-col gap-4">
      <search>
        <form onSubmit={search} className="flex flex-wrap items-end gap-3">
          <Field label="Search users" className="w-full max-w-sm">
            {(id) => (
              <Input
                id={id}
                type="search"
                placeholder="Name or email"
                value={text}
                maxLength={100}
                onChange={(e) => setText(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </search>

      <div className="flex flex-wrap items-end gap-4">
        <FilterSelect
          label="Role"
          value={params.role}
          options={['all', ...ROLES]}
          labels={{ all: 'All', ...ROLE_LABELS }}
          onChange={pick('role')}
        />
        <FilterSelect
          label="Status"
          value={params.status}
          options={USER_STATUS_FILTERS}
          labels={STATUS_LABELS}
          onChange={pick('status')}
        />
        <FilterSwitch
          id="filter-online"
          label="Online now"
          checked={params.online}
          onChange={toggle('online')}
        />
      </div>
    </div>
  )
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  labels: Record<T, string>
  onChange: (v: string) => void
}) {
  return (
    <Field label={label}>
      {(id) => (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {labels[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )
}

function FilterSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div className="flex h-11 items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
    </div>
  )
}

function UserRow({ user: u, now }: { user: UserListRow; now: number }) {
  const seen = lastSeenLabel(u.lastSeenMs, now)
  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/admin/users/${u.id}`}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {u.name}
        </Link>
      </TableCell>
      <TableCell>{u.email}</TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          {ROLE_LABELS[u.role]}
          <CapabilityChips caps={u} />
        </span>
      </TableCell>
      <TableCell>
        <ul className="flex flex-wrap gap-1">
          {u.suspended && <li className={chip}>Suspended</li>}
        </ul>
      </TableCell>
      <TableCell>
        {seen === 'Online' ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            <span aria-hidden className="size-2 rounded-full bg-primary" />
            Online
          </span>
        ) : (
          <span className="text-muted-foreground">{seen}</span>
        )}
      </TableCell>
    </TableRow>
  )
}

function AddByEmail({ addRoleInvite }: Pick<UsersListProps, 'addRoleInvite'>) {
  const [email, setEmail] = useState('')
  const [choice, setChoice] = useState<InviteChoice>('admin')
  const [caps, setCaps] = useState<Capabilities>({ editor: false, reviewer: false })
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  /** The ticks an existing account would lose, asked about before anything is saved. */
  const [confirming, setConfirming] = useState<{ address: string; removes: Capability[] } | null>(
    null,
  )
  const [pending, startTransition] = useTransition()

  const save = (confirmed: boolean) => {
    const address = email.trim()
    const role = choice === NO_ROLE ? null : choice
    const roleName = accessLabel(role, caps)
    startTransition(async () => {
      try {
        const res = confirmed
          ? await addRoleInvite(address, role, caps, true)
          : await addRoleInvite(address, role, caps)
        setConfirming(null)
        if (!res.ok) {
          setNotice({ ok: false, text: res.error })
          return
        }
        if (res.applied === 'confirm') {
          setNotice(null)
          setConfirming({ address, removes: res.removes })
          return
        }
        setEmail('')
        setNotice({
          ok: true,
          text:
            res.applied === 'invite'
              ? `${address} becomes ${roleName} at their first sign-in. Nothing is sent to them; tell them yourself.`
              : `${address} is now ${roleName}.`,
        })
      } catch {
        setNotice({ ok: false, text: NETWORK_ERROR })
      }
    })
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save(false)
  }

  return (
    <Card as="section" className="p-5" aria-labelledby="add-by-email">
      <h2 id="add-by-email" className="text-lg font-semibold">
        Add by email
      </h2>
      <p className={cn(hint, 'mt-1 max-w-prose')}>
        Give an address a role, Editor or Reviewer before its first sign-in. An address that already
        has an account gets them at once.
      </p>
      <form
        aria-labelledby="add-by-email"
        onSubmit={submit}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <Field label="Email" className="w-full max-w-xs">
          {(id) => (
            <Input
              id={id}
              type="email"
              required
              autoComplete="off"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Role">
          {(id) => (
            <Select value={choice} onValueChange={(v) => setChoice(v as InviteChoice)}>
              <SelectTrigger id={id} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {([NO_ROLE, ...INVITE_ROLES] as const).map((r) => (
                  <SelectItem key={r} value={r}>
                    {INVITE_CHOICE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        {CAPABILITIES.map((c) => (
          <CheckField
            key={c}
            label={CAPABILITY_LABELS[c]}
            checked={caps[c]}
            onChange={(on) => setCaps((prev) => ({ ...prev, [c]: on }))}
          />
        ))}
        <Button type="submit" disabled={pending}>
          Add
        </Button>
      </form>
      {confirming && (
        <div className="mt-3 flex flex-col gap-2">
          <p role="alert" className="text-caption">
            {removalWarning(confirming.address, confirming.removes)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => save(true)}>
              Save and remove
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {notice?.ok && (
        <output className={cn(hint, 'mt-3 block text-foreground')}>{notice.text}</output>
      )}
      {notice && !notice.ok && (
        <p role="alert" className={cn(hint, 'mt-3 text-foreground')}>
          {notice.text}
        </p>
      )}
    </Card>
  )
}

function WaitingList({
  waiting,
  removeRoleInvite,
}: Pick<UsersListProps, 'waiting' | 'removeRoleInvite'>) {
  const { pending, run } = useAdminAction()
  return (
    <Card as="section" className="p-5" aria-labelledby="waiting-invites">
      <h2 id="waiting-invites" className="text-lg font-semibold">
        Waiting for first sign-in
      </h2>
      {waiting.length === 0 ? (
        <p className={cn(hint, 'mt-2')}>No address is waiting.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {waiting.map((w) => (
            <li key={w.email} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-foreground">
                <span className="font-semibold">{w.email}</span>{' '}
                {w.role && <span className={cn(chip, 'text-caption')}>{ROLE_LABELS[w.role]}</span>}{' '}
                <CapabilityChips caps={w} />
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                aria-label={`Remove ${w.email}`}
                onClick={() =>
                  run(() => removeRoleInvite(w.email), `${w.email} is no longer waiting.`)
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
