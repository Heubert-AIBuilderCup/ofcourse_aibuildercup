'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useId, useState, useTransition } from 'react'
import { Blueprint } from '@/shared/components/Blueprint'
import { tag } from '@/shared/components/classes'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { HOME_COUNTRIES, type MockStudent, type MockUpdate } from '..'
import { INSTITUTIONS, type Match, matchAudience } from '../lib/audience'
import {
  DEMO_DRAFT,
  KIND_LABELS,
  STATUS_WORDS,
  type StoredUpdate,
  UPDATE_KINDS,
  UPDATE_LIMITS,
  type UpdateInput,
  type UpdateKind,
  updateStatusLine,
} from '../lib/update'

type Actions = {
  create: (input: unknown) => Promise<ActionResult<{ id: string }>>
  sendToReview: (id: unknown) => Promise<ActionResult>
  approve: (id: unknown) => Promise<ActionResult>
}

type Selected = { kind: 'none' } | { kind: 'new' } | { kind: 'stored'; id: string }

const overline = 'text-overline text-muted-foreground uppercase'
const caption = 'text-caption text-muted-foreground'

const students = (n: number) => `${n} student${n === 1 ? '' : 's'}`

/** "30 Nov 2026" from `2026-11-30`. */
const longDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

/** "Opportunity · Scholarship", "Impact · Rule change": what kind of news it is. */
const overlineOf = (u: UpdateInput) =>
  u.kind === 'opportunity' ? `Opportunity · ${u.category}` : `Impact · ${KIND_LABELS[u.kind]}`

/**
 * Updates (ADR-057, scripted on mock data but real records): the list of updates, the one chosen
 * or being written, and a preview of it in the feed of the first student it reaches. An editor
 * writes one, sees who it reaches and why as she types, saves it as a draft and sends it to review;
 * a reviewer approves it, which makes it live. Reach is counted over the mock students.
 */
export function UpdatesScreen({
  updates,
  mockUpdates,
  students: pool,
  canWrite,
  canApprove,
  actions,
}: {
  updates: StoredUpdate[]
  mockUpdates: readonly MockUpdate[]
  students: readonly MockStudent[]
  canWrite: boolean
  canApprove: boolean
  actions: Actions
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Selected>({ kind: 'none' })
  const [draft, setDraft] = useState<UpdateInput>(DEMO_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const stored = selected.kind === 'stored' ? updates.find((u) => u.id === selected.id) : undefined
  // The preview shows what is being written, else what is chosen, else the demo scholarship.
  const shown = selected.kind === 'new' ? draft : (stored ?? DEMO_DRAFT)
  const matches = matchAudience(shown.audience, pool)

  const run = (action: () => Promise<ActionResult<{ id?: string }>>) => {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) {
        setError(res.error)
        return
      }
      if (res.id) setSelected({ kind: 'stored', id: res.id })
      router.refresh()
    })
  }

  const openNew = () => {
    setDraft(DEMO_DRAFT)
    setError(null)
    setSelected({ kind: 'new' })
  }

  return (
    <div className="@container grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 font-semibold tracking-tight">Updates</h1>
          <p className="text-muted-foreground">
            Rule changes and opportunities, published to the students they concern.
          </p>
          {canWrite && (
            <Button className="self-start" onClick={openNew}>
              + New update
            </Button>
          )}
        </div>
        <ul aria-label="Updates" className="flex flex-col border-t">
          {updates.map((u) => (
            <li key={u.id} className="border-b">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setSelected({ kind: 'stored', id: u.id })
                }}
                aria-current={stored?.id === u.id ? 'true' : undefined}
                className={cn(
                  'flex w-full cursor-pointer flex-col gap-0.5 px-2 py-3 text-left hover:bg-accent',
                  stored?.id === u.id && 'bg-accent-200',
                )}
              >
                <span className={overline}>{overlineOf(u)}</span>
                <span className="font-heading font-semibold">{u.title}</span>
                <span className={caption}>
                  {updateStatusLine(u.status, matchAudience(u.audience, pool).length)}
                </span>
              </button>
            </li>
          ))}
          {mockUpdates.map((m) => (
            <li key={m.id} className="flex flex-col gap-0.5 border-b px-2 py-3">
              <span className="flex items-center justify-between gap-2">
                <span className={overline}>{m.overline}</span>
                <span className={cn(tag, 'text-muted-foreground')}>Mock</span>
              </span>
              <span className="font-heading font-semibold">{m.title}</span>
              <span className={caption}>{m.status}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {selected.kind === 'new' ? (
          <>
            <UpdateForm value={draft} onChange={setDraft} />
            <Reach matches={matches} />
            <div className="flex flex-wrap items-center gap-4">
              <Button disabled={pending} onClick={() => run(() => actions.create(draft))}>
                Save draft
              </Button>
              <p className={caption}>A reviewer approves it before it goes live.</p>
            </div>
          </>
        ) : stored ? (
          <StoredDetail
            update={stored}
            matches={matches}
            actions={
              <>
                {canWrite && stored.status === 'draft' && (
                  <Button
                    disabled={pending}
                    onClick={() => run(() => actions.sendToReview(stored.id))}
                  >
                    Send to review
                  </Button>
                )}
                {canApprove && stored.status === 'in_review' && (
                  <Button disabled={pending} onClick={() => run(() => actions.approve(stored.id))}>
                    Approve
                  </Button>
                )}
              </>
            }
          />
        ) : (
          <div className="flex flex-col gap-2 border border-dashed p-6">
            <h2 className="text-h4">Create a targeted update</h2>
            <p className={caption}>
              Demo: a new scholarship. You'll see who it reaches, and why, before a reviewer
              approves it.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-caption text-destructive">
            {error}
          </p>
        )}
      </div>

      <Preview update={shown} match={matches[0] ?? null} />
    </div>
  )
}

function Reach({ matches }: { matches: Match[] }) {
  return (
    <section aria-label="Reach" className="flex flex-col gap-2">
      <p className="font-heading font-semibold">{`Reaches ${students(matches.length)} (mock)`}</p>
      {matches.length > 0 && (
        <ul className="flex flex-col gap-1">
          {matches.map((m) => (
            <li key={m.student.id} className="flex flex-wrap gap-x-2 text-caption">
              <span className="font-semibold">{m.student.name}</span>
              <span className="text-muted-foreground">{m.student.homeCountry}</span>
              <span>{m.why}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function StoredDetail({
  update,
  matches,
  actions,
}: {
  update: StoredUpdate
  matches: Match[]
  actions: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={overline}>{overlineOf(update)}</span>
        <span className={tag}>{STATUS_WORDS[update.status]}</span>
      </div>
      <h2 className="text-h3">{update.title}</h2>
      <p>{update.body}</p>
      <Reach matches={matches} />
      {update.status === 'live' && (
        <p className={caption}>
          Delivery is not connected yet: the student feed and email do not receive updates.
        </p>
      )}
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

/** The update as one matched student sees it in her feed. */
function Preview({ update, match }: { update: UpdateInput; match: Match | null }) {
  const id = useId()
  const title = match ? `In ${match.student.name}'s feed` : 'Preview'
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className={overline}>
        {title}
      </h2>
      {match ? (
        <>
          <Blueprint className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className={caption}>
                {`OfCourse · ${KIND_LABELS[update.kind].toLowerCase()}`}
              </span>
              <span className="bg-primary-strong px-2 py-0.5 text-overline text-primary-strong-foreground uppercase">
                For you
              </span>
            </div>
            <p className={overline}>{`${update.category} · ${update.institution}`}</p>
            <h3 className="text-h4">{update.title}</h3>
            <p className="text-caption">{update.body}</p>
            {update.applyBy && (
              <p className="text-caption font-semibold">{`Apply by ${longDate(update.applyBy)}`}</p>
            )}
            <p className="bg-muted p-2 text-caption">{`Why you're seeing this: ${match.why}`}</p>
            {/* Preview only: the student's button, drawn, not pressable here (AD-E27). */}
            <span className="self-start border px-3 py-1.5 font-heading text-caption">
              See it on your route →
            </span>
            <p className={caption}>
              {`Source: ${update.sourceTitle} · checked ${longDate(update.sourceCheckedAt)}`}
            </p>
          </Blueprint>
          <p className={caption}>
            Preview for one matched student. The why line changes per student.
          </p>
        </>
      ) : (
        <p className={caption}>No student matches this rule yet.</p>
      )}
    </section>
  )
}

/** The update's fields and its audience rule; each change goes straight to the preview. */
function UpdateForm({
  value,
  onChange,
}: {
  value: UpdateInput
  onChange: (next: UpdateInput) => void
}) {
  const ids = useId()
  const set = <K extends keyof UpdateInput>(key: K, v: UpdateInput[K]) =>
    onChange({ ...value, [key]: v })
  const field = (name: string) => `${ids}-${name}`
  return (
    <form
      aria-label="New update"
      onSubmit={(e) => e.preventDefault()}
      className="grid gap-3 @xl:grid-cols-2"
    >
      <Field id={field('kind')} label="Kind">
        <NativeSelect
          id={field('kind')}
          value={value.kind}
          onChange={(e) => set('kind', e.target.value as UpdateKind)}
        >
          {UPDATE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id={field('category')} label="Category">
        <Input
          id={field('category')}
          value={value.category}
          maxLength={UPDATE_LIMITS.category}
          onChange={(e) => set('category', e.target.value)}
        />
      </Field>
      <Field id={field('institution')} label="Institution">
        <NativeSelect
          id={field('institution')}
          value={value.institution}
          // The audience follows the institution; it can be changed after.
          onChange={(e) =>
            onChange({
              ...value,
              institution: e.target.value,
              audience: { ...value.audience, institution: e.target.value },
            })
          }
        >
          {INSTITUTIONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id={field('apply')} label="Apply by">
        <Input
          id={field('apply')}
          type="date"
          value={value.applyBy ?? ''}
          onChange={(e) => set('applyBy', e.target.value === '' ? null : e.target.value)}
        />
      </Field>
      <div className="@xl:col-span-2">
        <Field id={field('title')} label="Title">
          <Input
            id={field('title')}
            value={value.title}
            maxLength={UPDATE_LIMITS.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
      </div>
      <div className="@xl:col-span-2">
        <Field id={field('body')} label="Body">
          <Textarea
            id={field('body')}
            rows={3}
            value={value.body}
            maxLength={UPDATE_LIMITS.body}
            onChange={(e) => set('body', e.target.value)}
          />
        </Field>
      </div>
      <Field id={field('source')} label="Source">
        <Input
          id={field('source')}
          value={value.sourceTitle}
          maxLength={UPDATE_LIMITS.source}
          onChange={(e) => set('sourceTitle', e.target.value)}
        />
      </Field>
      <Field id={field('checked')} label="Checked on">
        <Input
          id={field('checked')}
          type="date"
          value={value.sourceCheckedAt}
          onChange={(e) => set('sourceCheckedAt', e.target.value)}
        />
      </Field>
      <fieldset className="grid gap-3 border-t pt-3 @xl:col-span-2 @xl:grid-cols-2">
        <legend className={cn(overline, 'pb-1')}>Audience</legend>
        <Field id={field('aud-inst')} label="Ranked a route at">
          <NativeSelect
            id={field('aud-inst')}
            value={value.audience.institution}
            onChange={(e) => set('audience', { ...value.audience, institution: e.target.value })}
          >
            {INSTITUTIONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={field('aud-country')} label="Home country">
          <NativeSelect
            id={field('aud-country')}
            value={value.audience.homeCountry ?? ''}
            onChange={(e) =>
              set('audience', {
                ...value.audience,
                homeCountry: e.target.value === '' ? null : e.target.value,
              })
            }
          >
            <option value="">Everyone</option>
            {HOME_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </fieldset>
    </form>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
