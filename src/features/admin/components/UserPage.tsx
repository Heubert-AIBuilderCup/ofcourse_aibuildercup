'use client'

import Link from 'next/link'
import { type FormEvent, type ReactNode, useState, useTransition } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  ACCESS_ERRORS,
  type AccountAction,
  accountActionError,
  contentRolesError,
  ROLES,
  type Role,
  roleChangeError,
} from '@/shared/lib/auth/access'
import { lastSeenLabel } from '@/shared/lib/presence'
import { formatWhen } from '@/shared/lib/site'
import { describeUserAgent } from '@/shared/lib/user-agent'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { NETWORK_ERROR } from '../hooks/useAdminAction'
import { CAPABILITY_LABELS, ROLE_LABELS } from '../lib/labels'
import type { UserDetail } from '../users/server'
import { AdminPageHeader } from './AdminPageHeader'
import { CheckField } from './CheckField'
import { Field } from './Field'
import { chipStrong, hint } from './styles'

export type UserPageProps = {
  user: UserDetail
  viewer: { id: string; role: Role }
  /** The server's clock, so the last-seen label matches on hydration. */
  now: number
  /** Superadmins who are not suspended: the last-superadmin rules count them. */
  activeSuperadmins: number
  actions: {
    setRole: (userId: string, role: string) => Promise<ActionResult>
    setCapabilities: (userId: string, editor: boolean, reviewer: boolean) => Promise<ActionResult>
    suspendAccount: (userId: string, reason: string) => Promise<ActionResult>
    reactivateAccount: (userId: string) => Promise<ActionResult>
    signOutEverywhere: (userId: string) => Promise<ActionResult>
  }
}

/**
 * Run one control's action and keep its refusal for display beside it. On success the action's
 * revalidatePath refreshes this page, so the switches and the status read the stored values.
 */
function useControl() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (action: () => Promise<ActionResult>, onDone?: () => void) => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await action()
        if (!res.ok) {
          setError(res.error)
          return
        }
        onDone?.()
      } catch {
        setError(NETWORK_ERROR)
      }
    })
  }
  return { pending, error, run, clear: () => setError(null) }
}

function Refusal({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className={cn(hint, 'text-foreground')}>
      {error}
    </p>
  )
}

/**
 * One account: who they are, their access, account state, sessions and last visit. Each control renders only when access.ts allows this viewer to use it on this
 * account; the server action checks the same rules again.
 */
export function UserPage({ user, viewer, now, activeSuperadmins, actions }: UserPageProps) {
  const name = user.name
  const guard = {
    actorUserId: viewer.id,
    actorRole: viewer.role,
    targetUserId: user.id,
    targetRole: user.role,
    activeSuperadmins,
  }
  const may = (action: AccountAction) => accountActionError({ ...guard, action }) === null
  const roleRefusal = (newRole: string) => roleChangeError({ ...guard, newRole })
  // Keeping the current role is allowed whenever any change is: the select shows only then.
  const canChangeRole = roleRefusal(user.role) === null
  const outranked = accountActionError({ ...guard, action: 'signOut' }) === ACCESS_ERRORS.hierarchy
  const capabilitiesRefusal = contentRolesError({ actorRole: viewer.role })

  return (
    <div className="flex flex-col gap-6">
      <Header user={user} name={name} />

      <Section id="user-profile" title="Profile">
        <Profile user={user} />
      </Section>

      <Section id="user-access" title="Access">
        {outranked && <p className="text-base text-foreground">{ACCESS_ERRORS.hierarchy}</p>}
        {canChangeRole && (
          <RoleSelect
            name={name}
            role={user.role}
            refusal={roleRefusal}
            onChange={(role) => actions.setRole(user.id, role)}
          />
        )}
        {capabilitiesRefusal ? (
          <p className="text-foreground">{capabilitiesRefusal}</p>
        ) : (
          <CapabilityChecks
            name={name}
            caps={{ editor: user.editor, reviewer: user.reviewer }}
            onChange={(caps) => actions.setCapabilities(user.id, caps.editor, caps.reviewer)}
          />
        )}
      </Section>

      <Section id="user-account" title="Account">
        <div className="flex flex-wrap items-start gap-3">
          {user.suspendedAt
            ? may('reactivate') && (
                <Reactivate onReactivate={() => actions.reactivateAccount(user.id)} />
              )
            : may('suspend') && (
                <Suspend name={name} onSuspend={(r) => actions.suspendAccount(user.id, r)} />
              )}
          {may('signOut') && (
            <SignOutEverywhere name={name} onSignOut={() => actions.signOutEverywhere(user.id)} />
          )}
        </div>
      </Section>

      <Section id="user-sessions" title="Sessions">
        <Sessions sessions={user.sessions} />
      </Section>

      <Section id="user-last-seen" title="Last seen">
        <p className="text-sm text-foreground">{lastSeenLabel(user.lastSeenMs, now)}</p>
      </Section>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby={id} className="flex flex-col gap-4 p-5">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </Card>
  )
}

function Header({ user, name }: { user: UserDetail; name: string }) {
  const status = user.suspendedAt
    ? `Suspended ${formatWhen(user.suspendedAt)}${user.suspendReason ? `: ${user.suspendReason}` : ''}`
    : 'Active'
  return (
    <header className="flex flex-col gap-2">
      <Link
        href="/admin/users"
        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        All users
      </Link>
      <AdminPageHeader kicker="People" title={name} lede={user.email} />
      <ul className="flex flex-wrap gap-2">
        <li className={chipStrong}>{ROLE_LABELS[user.role]}</li>
      </ul>
      <p className="text-base font-semibold text-foreground">{status}</p>
    </header>
  )
}

function Profile({ user }: { user: UserDetail }) {
  const rows: [string, string][] = [
    ['Name', user.name],
    ['Email', user.email],
    ['Joined', formatWhen(user.createdAt)],
  ]
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function RoleSelect({
  name,
  role,
  refusal,
  onChange,
}: {
  name: string
  role: Role
  refusal: (newRole: string) => string | null
  onChange: (role: Role) => Promise<ActionResult>
}) {
  const [asking, setAsking] = useState<Role | null>(null)
  const { pending, error, run, clear } = useControl()
  const close = () => {
    setAsking(null)
    clear()
  }
  return (
    <form aria-label="Role" onSubmit={(e) => e.preventDefault()}>
      <Field label="Role">
        {(id) => (
          <Select
            value={role}
            onValueChange={(v) => {
              const next = ROLES.find((r) => r === v)
              if (next && next !== role) setAsking(next)
            }}
          >
            <SelectTrigger id={id} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} disabled={r !== role && refusal(r) !== null}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Confirm
        open={asking !== null}
        title="Change role"
        question={`Change ${name} to ${asking ? ROLE_LABELS[asking] : ''}? They are signed out of every session.`}
        confirmLabel="Change role"
        pending={pending}
        error={error}
        onCancel={close}
        onConfirm={() => asking && run(() => onChange(asking), close)}
      />
    </form>
  )
}

type Capability = keyof typeof CAPABILITY_LABELS
type Capabilities = Record<Capability, boolean>
const CAPABILITIES: readonly Capability[] = ['editor', 'reviewer']

/**
 * Editor and Reviewer, which an account can hold together. Each box shows the stored value and
 * changes only after the confirm dialog, when the action's revalidatePath refreshes the page.
 */
function CapabilityChecks({
  name,
  caps,
  onChange,
}: {
  name: string
  caps: Capabilities
  onChange: (caps: Capabilities) => Promise<ActionResult>
}) {
  const [asking, setAsking] = useState<{ capability: Capability; on: boolean } | null>(null)
  const { pending, error, run, clear } = useControl()
  const close = () => {
    setAsking(null)
    clear()
  }
  const label = asking ? CAPABILITY_LABELS[asking.capability] : ''
  const change = asking?.on ? `Give ${name} ${label}?` : `Remove ${label} from ${name}?`
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-caption font-medium">Content roles</legend>
      <div className="flex flex-wrap gap-4">
        {CAPABILITIES.map((c) => (
          <CheckField
            key={c}
            label={CAPABILITY_LABELS[c]}
            checked={caps[c]}
            onChange={(on) => setAsking({ capability: c, on })}
          />
        ))}
      </div>
      <Confirm
        open={asking !== null}
        title="Change access"
        question={`${change} They are signed out of every session.`}
        confirmLabel="Change access"
        pending={pending}
        error={error}
        onCancel={close}
        onConfirm={() =>
          asking && run(() => onChange({ ...caps, [asking.capability]: asking.on }), close)
        }
      />
    </fieldset>
  )
}

/** A yes-or-no question in the shadcn dialog, with the server's refusal shown inside it. */
function Confirm({
  open,
  title,
  question,
  confirmLabel,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  question: string
  confirmLabel: string
  pending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className={hint}>{question}</DialogDescription>
        </DialogHeader>
        <Refusal error={error} />
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SignOutEverywhere({
  name,
  onSignOut,
}: {
  name: string
  onSignOut: () => Promise<ActionResult>
}) {
  const [asking, setAsking] = useState(false)
  const { pending, error, run, clear } = useControl()
  const close = () => {
    setAsking(false)
    clear()
  }
  return (
    <>
      <Button variant="outline" onClick={() => setAsking(true)}>
        Sign out everywhere
      </Button>
      <Confirm
        open={asking}
        title="Sign out everywhere"
        question={`End every open session of ${name}? The account stays active.`}
        confirmLabel="Sign out"
        pending={pending}
        error={error}
        onCancel={close}
        onConfirm={() => run(onSignOut, close)}
      />
    </>
  )
}

function Suspend({
  name,
  onSuspend,
}: {
  name: string
  onSuspend: (reason: string) => Promise<ActionResult>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const { pending, error, run, clear } = useControl()
  const close = () => {
    setOpen(false)
    setReason('')
    clear()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() => onSuspend(reason.trim()), close)
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Suspend…
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Suspend {name}</DialogTitle>
            <DialogDescription className={hint}>
              They are signed out of every session at once, and cannot sign in until reactivated.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Reason">
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
            </Field>
            <Refusal error={error} />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || reason.trim() === ''}>
                Suspend
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Reactivate({ onReactivate }: { onReactivate: () => Promise<ActionResult> }) {
  const { pending, error, run } = useControl()
  return (
    <div className="flex flex-col gap-1">
      <Button disabled={pending} onClick={() => run(onReactivate)}>
        Reactivate
      </Button>
      <Refusal error={error} />
    </div>
  )
}

function Sessions({ sessions }: { sessions: UserDetail['sessions'] }) {
  if (sessions.length === 0) return <p className={hint}>No open sessions</p>
  return (
    <ul className="flex flex-col divide-y divide-border">
      {sessions.map((s) => {
        const { browser, device } = describeUserAgent(s.userAgent)
        return (
          <li key={s.id} className="flex flex-wrap gap-x-2 py-2 text-sm text-foreground">
            <span className="font-semibold">
              {browser} · {device}
            </span>
            <span className="text-muted-foreground">started {formatWhen(s.createdAt)}</span>
          </li>
        )
      })}
    </ul>
  )
}
