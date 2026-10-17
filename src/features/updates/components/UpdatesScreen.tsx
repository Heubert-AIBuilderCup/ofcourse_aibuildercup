'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useId, useRef, useState, useTransition } from 'react'
import { tag } from '@/shared/components/classes'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { HOME_COUNTRIES, type MockStudent, type MockUpdate } from '..'
import {
  ALL_INSTITUTIONS,
  ALL_TOPICS,
  type AudienceRule,
  INSTITUTIONS,
  type Match,
  matchAudience,
  NO_TOPIC,
  TOPIC_IDS,
  topicName,
} from '../lib/audience'
import {
  DEMO_DRAFT,
  KIND_LABELS,
  overlineOf,
  previewWords,
  STATUS_WORDS,
  type StoredUpdate,
  UPDATE_KINDS,
  UPDATE_LIMITS,
  type UpdateInput,
  type UpdateKind,
  updateStatusLine,
} from '../lib/update'
import { UpdateCard } from './UpdateCard'

type Actions = {
  create: (input: unknown) => Promise<ActionResult<{ id: string }>>
  sendToReview: (id: unknown) => Promise<ActionResult>
  approve: (id: unknown) => Promise<ActionResult>
}

/** A row of the list: a stored update or a sample. */
type Listed = { kind: 'stored' | 'sample'; id: string }
type Selected = { kind: 'none' } | { kind: 'new' } | Listed

const overline = 'text-overline text-muted-foreground uppercase'
const caption = 'text-caption text-muted-foreground'

const students = (n: number) => `${n} student${n === 1 ? '' : 's'}`

/** The institutions an update can be from or aimed at: all of them first, then the catalogue. */
const INSTITUTION_CHOICES = [ALL_INSTITUTIONS, ...INSTITUTIONS]

/** A sample's fields, without its id and status line: what fills the form. */
const fieldsOf = ({ id: _id, status: _status, ...fields }: MockUpdate): UpdateInput => fields

/**
 * Updates (ADR-057, scripted on mock data but real records): the list of updates, the one chosen
 * or being written, and a preview of it in the feed of the first student it reaches. An editor
 * writes one, sees who it reaches and why as she types, saves it as a draft and sends it to review;
 * a reviewer approves it, which makes it live. Reach is counted over the mock students. The sample
 * updates beside the real ones can be picked too: an editor starts a targeted update from one, its
 * fields filled in.
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
  const detailsRef = useRef<HTMLDivElement>(null)

  const stored = selected.kind === 'stored' ? updates.find((u) => u.id === selected.id) : undefined
  const sample =
    selected.kind === 'sample' ? mockUpdates.find((m) => m.id === selected.id) : undefined
  // The preview shows what is being written, else what is chosen, else the demo scholarship.
  const shown = selected.kind === 'new' ? draft : (stored ?? sample ?? DEMO_DRAFT)
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

  const pick = (next: Selected) => {
    setError(null)
    setSelected(next)
    // Stacked (a narrow screen), the details sit below the list: bring them into view.
    requestAnimationFrame(() => {
      const el = detailsRef.current
      if (!el) return
      const { top } = el.getBoundingClientRect()
      if (top >= 0 && top < window.innerHeight * 0.5) return
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    })
  }

  /** The form, opened on these fields. */
  const openNew = (fields: UpdateInput) => {
    setDraft(fields)
    pick({ kind: 'new' })
  }

  const row = (key: Listed, u: UpdateInput, status: string) => {
    const current = 'id' in selected && selected.kind === key.kind && selected.id === key.id
    return (
      <li key={`${key.kind}-${key.id}`} className="border-b">
        <button
          type="button"
          onClick={() => pick(key)}
          aria-current={current ? 'true' : undefined}
          className={cn(
            'flex w-full cursor-pointer flex-col gap-0.5 px-2 py-3 text-left hover:bg-accent',
            current && 'bg-accent-200',
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className={overline}>{overlineOf(u)}</span>
            {key.kind === 'sample' && (
              <span className={cn(tag, 'text-muted-foreground')}>Mock</span>
            )}
          </span>
          <span className="font-heading font-semibold">{u.title}</span>
          <span className={caption}>{status}</span>
        </button>
      </li>
    )
  }

  return (
    // The container query reads this wrapper: a grid cannot query its own width.
    <div className="@container">
      <div className="grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] @5xl:items-start">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-h1 font-semibold tracking-tight">Updates</h1>
            <p className="text-muted-foreground">
              Rule changes and opportunities, published to the students they concern.
            </p>
            {canWrite && (
              <Button className="self-start" onClick={() => openNew(DEMO_DRAFT)}>
                + New update
              </Button>
            )}
          </div>
          <ul aria-label="Updates" className="flex flex-col border-t">
            {updates.map((u) =>
              row(
                { kind: 'stored', id: u.id },
                u,
                updateStatusLine(u.status, matchAudience(u.audience, pool).length),
              ),
            )}
            {mockUpdates.map((m) => row({ kind: 'sample', id: m.id }, m, m.status))}
          </ul>
        </div>

        <div
          ref={detailsRef}
          className="flex min-w-0 scroll-mt-4 flex-col gap-4 @5xl:sticky @5xl:top-4"
        >
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
            <UpdateDetail
              update={stored}
              label={STATUS_WORDS[stored.status]}
              matches={matches}
              note={
                stored.status === 'live'
                  ? 'Live: it shows at the top of the feed of every student it matches, and on the matching course tiles. Email is not connected yet.'
                  : null
              }
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
                    <Button
                      disabled={pending}
                      onClick={() => run(() => actions.approve(stored.id))}
                    >
                      Approve
                    </Button>
                  )}
                </>
              }
            />
          ) : sample ? (
            <UpdateDetail
              update={sample}
              label="Mock"
              matches={matches}
              note={sample.status}
              actions={
                canWrite && (
                  <Button onClick={() => openNew(fieldsOf(sample))}>
                    Create a targeted update
                  </Button>
                )
              }
            />
          ) : (
            <p className={caption}>Pick an update to see who it reaches, or start a new one.</p>
          )}
          {error && (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          )}
        </div>

        <Preview update={shown} match={matches[0] ?? null} />
      </div>
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

/** A chosen update, stored or sample: its kind and one-word tag, what it says, who it reaches. */
function UpdateDetail({
  update,
  label,
  matches,
  note,
  actions,
}: {
  update: UpdateInput
  label: string
  matches: Match[]
  note: string | null
  actions: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={overline}>{overlineOf(update)}</span>
        <span className={tag}>{label}</span>
      </div>
      <h2 className="text-h3">{update.title}</h2>
      <p>{update.body}</p>
      <Reach matches={matches} />
      {note && <p className={caption}>{note}</p>}
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

/** The update as one matched student sees it in her feed, framed for the admin looking at it. */
function Preview({ update, match }: { update: UpdateInput; match: Match | null }) {
  const id = useId()
  const words = match ? previewWords(match) : null
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 @5xl:sticky @5xl:top-4">
      <h2 id={id} className={overline}>
        {words ? words.heading : 'Preview'}
      </h2>
      {words ? (
        <>
          {/* No href: the student's button is drawn, not pressable here (AD-E27). */}
          <UpdateCard update={update} badge={words.badge} why={words.why} />
          <p className={caption}>
            Preview for one matched student. Once live, it shows at the top of the feed of every
            student it matches; the why line changes per student.
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
          {INSTITUTION_CHOICES.map((i) => (
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
        <Field id={field('aud-inst')} label="Ranked a route at" className="@xl:col-span-2">
          <NativeSelect
            id={field('aud-inst')}
            value={value.audience.institution}
            onChange={(e) => set('audience', { ...value.audience, institution: e.target.value })}
          >
            {INSTITUTION_CHOICES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={field('aud-topic')} label="Topic">
          <NativeSelect
            id={field('aud-topic')}
            value={value.audience.topic}
            onChange={(e) =>
              set('audience', {
                ...value.audience,
                topic: e.target.value as AudienceRule['topic'],
              })
            }
          >
            {/* A stored topic that is none of the eight: shown as it is, never as All topics. */}
            {value.audience.topic === NO_TOPIC && (
              <option value={NO_TOPIC} disabled>
                No topic (unknown)
              </option>
            )}
            <option value={ALL_TOPICS}>{ALL_TOPICS}</option>
            {TOPIC_IDS.map((t) => (
              <option key={t} value={t}>
                {topicName(t)}
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

function Field({
  id,
  label,
  className,
  children,
}: {
  id: string
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
