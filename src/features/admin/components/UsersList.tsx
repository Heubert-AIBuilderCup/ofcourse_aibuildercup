'use client'

import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useId, useState, useTransition } from 'react'
import { emptyBox, filterLabel, hairlineTable, tag } from '@/shared/components/classes'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { INVITE_ROLES, type InviteRole, ROLES, type Role } from '@/shared/lib/auth/access'
import { lastSeenLabel } from '@/shared/lib/presence'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { NETWORK_ERROR, useAdminAction } from '../hooks/useAdminAction'
import { initialsOf } from '../lib/initials'
import { CAPABILITY_LABELS, ROLE_LABELS } from '../lib/labels'
import {
  USER_STATUS_FILTERS,
  USERS_PAGE_SIZE,
  type UserStatusFilter,
  type UsersParams,
} from '../lib/params'
import type { InviteApplied } from '../users/commands'
import type { UserListRow, WaitingInvite } from '../users/server'
import { AdminBand } from './AdminBand'
import { CheckField } from './CheckField'
import { Field } from './Field'
import { Pager } from './Pager'

const { wrap, table, head, body, th, tr, td } = hairlineTable
/** The inputs at the height of the admin's other controls, on the hairline the design draws. */
const control = 'h-11 border-foreground/30'

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

/**
 * The role in a hairline tag, strong for the admin roles, and a dashed tag per capability beside
 * it (Editor and Reviewer are capabilities, not roles). With no role, the capabilities alone.
 */
function RoleTags({ role, caps }: { role: Role | null; caps: Capabilities }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {role && (
        <span className={cn(tag, role !== 'user' && 'border-accent-700 text-accent-700')}>
          {ROLE_LABELS[role]}
        </span>
      )}
      {CAPABILITIES.filter((c) => caps[c]).map((c) => (
        <span key={c} className={cn(tag, 'border-dashed border-foreground/40')}>
          {CAPABILITY_LABELS[c]}
        </span>
      ))}
    </span>
  )
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
  /** Every account and the staff (admins and superadmins), whatever the filters. */
  accounts: number
  staff: number
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
  const { rows, total, onlineNow, accounts, staff, params, now, canManageRoles, waiting } = props
  const go = useGo()

  return (
    <div className="flex flex-col gap-6">
      <AdminBand
        kicker="Right now"
        title={`${onlineNow} ${onlineNow === 1 ? 'person' : 'people'} online`}
        // The waiting list is read for superadmins only; an admin's count would be a false 0.
        stats={[
          { value: accounts, label: accounts === 1 ? 'account' : 'accounts' },
          { value: staff, label: 'staff: admin or superadmin' },
          ...(canManageRoles
            ? [{ value: waiting.length, label: 'waiting for first sign-in' }]
            : []),
        ]}
      />

      <UsersFilters params={params} go={go} />

      <div className="flex flex-col gap-3">
        <div className={wrap}>
          <table className={table}>
            <caption className="sr-only">Users</caption>
            <thead className={head}>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Email</th>
                <th className={th}>Role</th>
                <th className={th}>Status</th>
                <th className={th}>Last seen</th>
              </tr>
            </thead>
            <tbody className={body}>
              {rows.map((u) => (
                <UserRow key={u.id} user={u} now={now} />
              ))}
              {rows.length === 0 && (
                <tr className="@max-xl:block">
                  <td colSpan={5} className="py-10 text-center text-muted-foreground @max-xl:block">
                    No users match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager
          total={total}
          page={params.page}
          pageSize={USERS_PAGE_SIZE}
          noun="users"
          onPage={(n) => go({ page: n ? String(n) : '' })}
        />
      </div>

      {canManageRoles && (
        <div className="grid gap-10 @5xl:grid-cols-2">
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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-b pb-5 @max-xl:flex-col @max-xl:items-stretch @max-xl:gap-3 @max-xl:pb-4">
      <search className="min-w-64 flex-1 @5xl:max-w-md @max-xl:min-w-0">
        <form onSubmit={search} className="flex items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <Search
              aria-hidden="true"
              strokeWidth={1.5}
              className="pointer-events-none absolute left-3 size-icon text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search users"
              placeholder="Name or email"
              value={text}
              maxLength={100}
              onChange={(e) => setText(e.target.value)}
              className={cn(control, 'pl-9')}
            />
          </div>
          <Button type="submit" variant="outline" className="h-11">
            Search
          </Button>
        </form>
      </search>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 @max-xl:grid @max-xl:grid-cols-2">
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

/** A filter's label beside its select, as the board's filters draw it; above it on a phone. */
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
  const id = useId()
  return (
    <div className="flex items-center gap-2 @max-xl:flex-col @max-xl:items-stretch @max-xl:gap-1">
      <label htmlFor={id} className={filterLabel}>
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="h-11 w-auto min-w-30 gap-3 border-foreground/30 @max-xl:w-full @max-xl:min-w-0"
        >
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
    </div>
  )
}

/** The square switch the design draws, on the shadcn Switch (its thumb is the root's span). */
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
    <div className="flex min-h-11 items-center gap-2.5 @max-xl:col-span-2">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="h-5.5 w-10 rounded-none border border-foreground/45 px-0.5 data-[state=checked]:border-primary-strong data-[state=checked]:bg-primary-strong data-[state=unchecked]:bg-transparent [&>span]:size-3.5 [&>span]:rounded-none [&>span]:bg-foreground/60 [&>span]:shadow-none [&>span[data-state=checked]]:bg-primary-strong-foreground"
      />
      <label htmlFor={id} className="text-foreground">
        {label}
      </label>
    </div>
  )
}

function UserRow({ user: u, now }: { user: UserListRow; now: number }) {
  const seen = lastSeenLabel(u.lastSeenMs, now)
  return (
    <tr className={tr}>
      <td className={td}>
        <span className="inline-flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex size-8 shrink-0 items-center justify-center border border-foreground/25 font-heading text-caption font-semibold"
          >
            {initialsOf(u.name)}
          </span>
          <Link
            href={`/admin/users/${u.id}`}
            className="font-medium text-accent-700 underline-offset-4 hover:underline"
          >
            {u.name}
          </Link>
        </span>
      </td>
      <td className={cn(td, 'break-all')}>{u.email}</td>
      <td className={td}>
        <RoleTags role={u.role} caps={u} />
      </td>
      <td className={td}>
        {u.suspended ? (
          <span className={tag}>Suspended</span>
        ) : (
          <span className="text-muted-foreground">Active</span>
        )}
      </td>
      <td className={td}>
        {seen === 'Online' ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-accent-700">
            <span aria-hidden="true" className="size-1.75 rounded-full bg-primary" />
            Online
          </span>
        ) : (
          <span className="text-muted-foreground">{seen}</span>
        )}
      </td>
    </tr>
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
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="add-by-email">
      <h2 id="add-by-email" className="text-h3 font-semibold">
        Add by email
      </h2>
      <p className="max-w-prose text-muted-foreground">
        Give an address a role, Editor or Reviewer before its first sign-in. An address that already
        has an account gets them at once.
      </p>
      <form
        aria-labelledby="add-by-email"
        onSubmit={submit}
        className="mt-1 flex flex-wrap items-end gap-3 @max-xl:flex-col @max-xl:items-stretch"
      >
        <Field label="Email" className="min-w-56 flex-1 @max-xl:min-w-0">
          {(id) => (
            <Input
              id={id}
              type="email"
              required
              autoComplete="off"
              maxLength={254}
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={control}
            />
          )}
        </Field>
        <Field label="Role">
          {(id) => (
            <Select value={choice} onValueChange={(v) => setChoice(v as InviteChoice)}>
              <SelectTrigger id={id} className={cn(control, 'w-44 @max-xl:w-full')}>
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
        <fieldset className="flex items-center gap-3">
          <legend className="float-left mr-1 text-caption text-muted-foreground">Can also</legend>
          {CAPABILITIES.map((c) => (
            <CheckField
              key={c}
              label={CAPABILITY_LABELS[c]}
              checked={caps[c]}
              onChange={(on) => setCaps((prev) => ({ ...prev, [c]: on }))}
            />
          ))}
        </fieldset>
        <Button type="submit" disabled={pending} className="h-11 px-5">
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-icon" />
          Add
        </Button>
      </form>
      {confirming && (
        <div className="flex flex-col gap-2">
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
      {notice?.ok && <output className="block text-caption text-foreground">{notice.text}</output>}
      {notice && !notice.ok && (
        <p role="alert" className="text-caption text-foreground">
          {notice.text}
        </p>
      )}
    </section>
  )
}

function WaitingList({
  waiting,
  removeRoleInvite,
}: Pick<UsersListProps, 'waiting' | 'removeRoleInvite'>) {
  const { pending, run } = useAdminAction()
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="waiting-invites">
      <h2 id="waiting-invites" className="text-h3 font-semibold">
        Waiting for first sign-in
      </h2>
      {waiting.length === 0 ? (
        <p className={emptyBox}>No address is waiting.</p>
      ) : (
        <ul className="flex flex-col divide-y border-t-2 border-foreground [&>li]:border-border">
          {waiting.map((w) => (
            <li key={w.email} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium break-all">{w.email}</span>
                <RoleTags role={w.role} caps={w} />
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
    </section>
  )
}
