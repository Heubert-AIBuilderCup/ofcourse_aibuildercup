'use client'

import { Lightbulb, Link2, Lock, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useId,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'
import { Duck } from '@/shared/components/Duck'
import motion from '@/shared/components/motion.module.css'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import { Spin, Working } from '@/shared/components/Working'
import { BOARD_PATH } from '@/shared/lib/auth/gate'
import { cn } from '@/shared/lib/utils'
import type { SuggestedSource } from '../../ai/search'
import { FEED_POST_PAGES } from '../../brands'
import { LANGUAGES, type Language, type LanguageId } from '../../languages'
import type { IdeaStart } from '../../lib/idea-start'
import { IDEA_KIND, SOURCE_ERRORS, SOURCE_LIMITS } from '../../model/artifacts'
import type { Made, Suggested } from '../../server/commands'
import { firstChars } from '../../text/script'
import { usePress } from '../usePostAction'

const NETWORK_ERROR = 'Could not reach the server. Please try again.'
const DEFAULT_KIND = 'research summary'
/** What "Make post" and the idea's makes say while the source is read and its ideas found. */
const READING = 'Reading the source and finding ideas · this can take a minute'
/** The longest title a source takes, in characters as a reader sees them. */
const TITLE_MAX = 200

const IDEA_ONLY =
  'No sources ticked: the post is built from your idea alone, and its source check compares against your idea.'

/**
 * How a source's kind reads on the post: one made from the idea alone says so; one remade from
 * links since keeps its kind but is no longer the idea alone.
 */
export function sourceKindLabel(source: { kind: string; parts?: unknown[] }): string {
  return source.kind === IDEA_KIND && (source.parts?.length ?? 0) === 0
    ? 'From your idea, no outside source'
    : source.kind
}

/** The links field's lines, trimmed, blank ones dropped. */
export function linkLines(links: string): string[] {
  return links
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

/**
 * What the source fields hold: the post's language, the links as typed, the framing line, the
 * notes and pasted text.
 */
export type SourceValues = {
  language: LanguageId
  links: string
  framing: string
  notes: string
  text: string
}

/** A language as the choice shows it: its own name, and its English one when that differs. */
function languageName(language: Language): string {
  return language.nativeLabel === language.label
    ? language.label
    : `${language.nativeLabel} · ${language.label}`
}

/**
 * Why the fields cannot be sent as they are, the server's own words (GD18), or null: more than
 * five links, or links and pasted text together, since neither may silently win.
 */
export function sourceFieldsError(values: SourceValues, pasting: boolean): string | null {
  const links = linkLines(values.links)
  if (links.length > SOURCE_LIMITS.links) return SOURCE_ERRORS.links
  if (links.length > 0 && pasting && values.text.trim() !== '') return SOURCE_ERRORS.both
  return null
}
type Failed = { url: string; error: string }

/**
 * The fields "Make post" and the source step's "Save and remake" share (GD18): the post's
 * language first (GD36), then the links, one per line, the framing line and the notes, each with
 * its placeholder and help text; "Paste text instead" opens the text box, with `pasteExtra` (the
 * title) above it. More than five links, or
 * links with pasted text, says so under the field and in its description; `failed` lists the
 * links that could not be read. `linksLabel` names the links field; without `sources` the links
 * and the paste box are left out (the idea start finds its own), the failed links still listed.
 */
export function SourceFields({
  values,
  onChange,
  pasting,
  onPaste,
  failed,
  pasteExtra,
  linksLabel = 'Links',
  sources = true,
}: {
  values: SourceValues
  onChange: (values: SourceValues) => void
  pasting: boolean
  onPaste: () => void
  failed: Failed[]
  pasteExtra?: ReactNode
  linksLabel?: string
  sources?: boolean
}) {
  const ids = useId()
  // A field with a limit holds that many characters as a reader sees them (a Devanagari conjunct,
  // a Thai letter with its marks, is one); the browser's maxLength would count code units.
  const set = (key: keyof SourceValues, max?: number) => (e: { target: { value: string } }) =>
    onChange({
      ...values,
      [key]: max === undefined ? e.target.value : firstChars(e.target.value, max),
    })
  const error = sourceFieldsError(values, pasting)
  const unread = failed.length > 0 && (
    <ul aria-label="Links not read" className="flex flex-col gap-1 text-caption">
      {failed.map((f) => (
        <li key={f.url} className="wrap-anywhere text-destructive">
          {f.url}: {SOURCE_ERRORS.unread}
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-language`}>Language</Label>
        <NativeSelect
          id={`${ids}-language`}
          value={values.language}
          aria-describedby={`${ids}-language-note`}
          onChange={set('language')}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {languageName(l)}
            </option>
          ))}
        </NativeSelect>
        <p id={`${ids}-language-note`} className="text-caption text-muted-foreground">
          The post is written in this language. Sources stay as they are.
        </p>
      </div>
      {sources ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-links`}>{linksLabel}</Label>
          <Textarea
            id={`${ids}-links`}
            value={values.links}
            rows={3}
            maxLength={12_000}
            placeholder="https://… one link per line, up to five"
            aria-describedby={`${ids}-links-note${error ? ` ${ids}-links-error` : ''}`}
            aria-invalid={error !== null || undefined}
            onChange={set('links')}
          />
          <p id={`${ids}-links-note`} className="text-caption text-muted-foreground">
            We read each article and pull out its points.
          </p>
          {error && (
            <p id={`${ids}-links-error`} className="text-caption text-destructive">
              {error}
            </p>
          )}
          {unread}
        </div>
      ) : (
        unread
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-framing`}>What do you want this post to say?</Label>
        <Input
          id={`${ids}-framing`}
          value={values.framing}
          placeholder="e.g. Show first-year students why 20 hours is the limit"
          aria-describedby={`${ids}-framing-note`}
          onChange={set('framing', SOURCE_LIMITS.framing)}
        />
        <p id={`${ids}-framing-note`} className="text-caption text-muted-foreground">
          Tell Gemini the story you want to tell. Optional.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-notes`}>Your own notes</Label>
        <Textarea
          id={`${ids}-notes`}
          value={values.notes}
          rows={3}
          placeholder="Your own view or experience"
          aria-describedby={`${ids}-notes-note`}
          onChange={set('notes', SOURCE_LIMITS.notes)}
        />
        <p id={`${ids}-notes-note`} className="text-caption text-muted-foreground">
          Kept as your opinion, never used as a fact. Optional.
        </p>
      </div>
      {!sources ? null : pasting ? (
        <>
          {pasteExtra}
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-source`}>Source</Label>
            <Textarea
              id={`${ids}-source`}
              value={values.text}
              rows={12}
              maxLength={60_000}
              onChange={set('text')}
              placeholder="Paste the source, one paragraph per block."
            />
          </div>
        </>
      ) : (
        <Button type="button" variant="text" className="self-start" onClick={onPaste}>
          Paste text instead
        </Button>
      )}
    </>
  )
}

/** How many suggestions are ticked when they arrive: the official ones among them (GD29). */
const TOP_TICKED = 3

type PostKind = 'feed' | 'blog'
/** The idea start's two makes: a blog from the pages first, or the feed post straight away. */
const IDEA_MAKES: { kind: PostKind; label: string }[] = [
  { kind: 'blog', label: 'Write a blog first' },
  { kind: 'feed', label: 'Go straight to the post' },
]

/** The idea start's search: the idea typed, the pages found for it, and which are ticked. */
type IdeaSearch = {
  idea: string
  found: { sources: SuggestedSource[]; entryPoint: string | null } | null
  ticked: string[]
}

/**
 * "Start from an idea" (BR12, BR13): the idea, then "Find sources", which lists the pages Google
 * Search suggests with a tick each (the official ones of the top three ticked, GD29), their title,
 * site and why, and Google's search entry point in a sandboxed frame, as its grounding display
 * rules require: the markup is Google's, so it never runs in the page. "Write a blog first" and
 * "Go straight to the post" hand the ticked pages on, in the list's order, with the kind to make;
 * nothing is used unticked. With none ticked (no search run, nothing found, or all unticked) they
 * hand on none, and the post is made from the idea alone, as the note under them says. The search
 * is the form's, so a switch to the blog start and back keeps the pages found (a paid search).
 */
function IdeaSources({
  find,
  onUse,
  busy,
  using,
  search: kept,
  onSearch,
}: {
  find: (input: unknown) => Promise<Suggested>
  onUse: (links: string[], kind: PostKind) => void
  busy: boolean
  /** The make pressed, while its post is being made. */
  using: PostKind | null
  search: IdeaSearch
  onSearch: Dispatch<SetStateAction<IdeaSearch>>
}) {
  const ids = useId()
  const { idea, found, ticked } = kept
  const setIdea = (next: string) => onSearch((was) => ({ ...was, idea: next }))
  const setFound = (next: IdeaSearch['found']) => onSearch((was) => ({ ...was, found: next }))
  const setTicked = (next: (was: string[]) => string[]) =>
    onSearch((was) => ({ ...was, ticked: next(was.ticked) }))
  const [error, setError] = useState<string | null>(null)
  const [finding, startFinding] = useTransition()
  const empty = idea.trim() === ''
  const chosen = (found?.sources ?? []).filter((s) => ticked.includes(s.url)).map((s) => s.url)
  const tooMany = chosen.length > SOURCE_LIMITS.links

  const search = () => {
    if (empty || finding) return
    setError(null)
    startFinding(async () => {
      try {
        const res = await find({ idea })
        if (!res.ok) {
          setError(res.error)
          setFound(null)
          return
        }
        onSearch((was) => ({
          ...was,
          found: { sources: res.sources, entryPoint: res.entryPoint },
          ticked: res.sources
            .slice(0, TOP_TICKED)
            .filter((s) => s.official)
            .map((s) => s.url),
        }))
      } catch {
        setError(NETWORK_ERROR)
      }
    })
  }
  const tick = (url: string, on: boolean) =>
    setTicked((was) => (on ? [...was, url] : was.filter((u) => u !== url)))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-idea`}>Your idea</Label>
        <Input
          id={`${ids}-idea`}
          value={idea}
          placeholder="e.g. Working while you study in Australia"
          aria-describedby={`${ids}-idea-note`}
          onChange={(e) => setIdea(firstChars(e.target.value, SOURCE_LIMITS.idea))}
          onKeyDown={(e) => {
            // Enter searches; it never submits the form around it.
            if (e.key !== 'Enter') return
            e.preventDefault()
            search()
          }}
        />
        <p id={`${ids}-idea-note`} className="text-caption text-muted-foreground">
          Gemini searches Google and suggests pages to read.
        </p>
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" disabled={empty || finding} onClick={search}>
            {finding && <Spin />}
            {finding ? 'Finding…' : 'Find sources'}
          </Button>
          {finding && <Working words="Searching for sources…" />}
          {error && (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
      {found && (
        <div className="flex flex-col gap-4">
          <ul aria-label="Suggested sources" className="flex flex-col gap-3">
            {found.sources.map((s, i) => (
              <li key={s.url} className="flex items-start gap-3">
                <Checkbox
                  id={`${ids}-source-${i}`}
                  className="mt-1"
                  checked={ticked.includes(s.url)}
                  aria-describedby={`${ids}-source-${i}-about`}
                  onCheckedChange={(on) => tick(s.url, on === true)}
                />
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${ids}-source-${i}`}>{s.title}</Label>
                  <p
                    id={`${ids}-source-${i}-about`}
                    className="wrap-anywhere text-caption text-muted-foreground"
                  >
                    {s.site} · {s.why}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {found.entryPoint && (
            // Google's markup in its own document: no script and no access to this page; its
            // search chips open in a new tab.
            <iframe
              title="Google Search suggestions"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcDoc={`<base target="_blank">${found.entryPoint}`}
              className="h-20 w-full"
            />
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-4">
          {IDEA_MAKES.map(({ kind, label }) => (
            <Button
              key={kind}
              type="button"
              variant={kind === 'feed' ? 'outline' : 'default'}
              disabled={busy || empty || tooMany}
              onClick={() => onUse(chosen, kind)}
            >
              {using === kind && <Spin />}
              {using === kind ? 'Running…' : label}
            </Button>
          ))}
          {using && <Working words={READING} />}
          {tooMany && <p className="text-caption text-destructive">{SOURCE_ERRORS.links}</p>}
        </div>
        {chosen.length === 0 && <p className="text-caption text-muted-foreground">{IDEA_ONLY}</p>}
      </div>
    </div>
  )
}

/** Where a new post starts: a blog already written, or an idea to find sources for. */
const STARTS = [
  { id: 'blog', label: 'From a blog', about: 'One to five links, or pasted text', icon: Link2 },
  { id: 'idea', label: 'From an idea', about: 'Gemini finds pages to read', icon: Lightbulb },
] as const
type Start = (typeof STARTS)[number]['id']

/** The workbench's steps as "What happens next" lists them, in the step bar's words. */
const NEXT_STEPS = [
  { label: 'Source', about: 'Read the links, pull out the points' },
  { label: 'Ideas', about: 'Angles to tell it' },
  { label: 'Outline', about: 'One line per slide' },
  { label: 'Text', about: 'The words on each slide' },
  { label: 'Images', about: 'Art in the page’s style' },
  { label: 'Settings', about: 'Where it shows, and to whom' },
  { label: 'Review', about: 'A reviewer checks the facts' },
  { label: 'Live', about: 'In the feed, or exported' },
] as const

/**
 * The blue panel beside a new feed post's form: the eight steps the post goes through, the first
 * lit, and the reviewer's lock. The band's panel style (motion.grid), marked light like the others.
 */
function WhatHappensNext() {
  return (
    <aside
      aria-labelledby="what-happens-next"
      data-theme="light"
      className={cn(
        motion.grid,
        'relative flex flex-col gap-4 overflow-hidden px-6 py-7 text-panel-foreground @5xl:sticky @5xl:top-6',
      )}
    >
      <Duck size="3rem" className="relative size-12 -scale-x-100 object-contain" />
      <h2 id="what-happens-next" className="relative text-h3 text-panel-foreground">
        What happens next
      </h2>
      <ol className="relative flex flex-col">
        {NEXT_STEPS.map((s, i) => (
          <li
            key={s.label}
            className="relative flex gap-3 pb-3.5 not-last:before:absolute not-last:before:top-7 not-last:before:bottom-0 not-last:before:left-3.5 not-last:before:w-px not-last:before:bg-panel-foreground/40"
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center border border-panel-foreground/70 font-heading font-semibold',
                i === 0 && 'bg-panel-foreground text-panel',
              )}
            >
              {i + 1}
            </span>
            <span className="flex flex-col">
              <span className="font-heading text-h4 font-semibold">{s.label}</span>
              <span className="text-caption text-panel-foreground dark:text-panel-foreground/78">
                {s.about}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="relative flex items-center gap-2 border-t border-panel-foreground/35 pt-3.5 text-caption">
        <Lock aria-hidden="true" strokeWidth={1.5} className="size-icon-sm shrink-0" />
        Nothing reaches students until a reviewer approves it.
      </p>
    </aside>
  )
}

/**
 * "Start from" a blog or an idea, then the source (criteria 1–4; 93, 94; GD18–GD21). From a blog:
 * its link, or pasted text, with a framing line and notes, and "Make post", which always makes a
 * feed post. From an idea: the found pages ticked, or with none the idea itself as the source, then
 * "Write a blog first" (a blog) or "Go straight to the post" (a feed post). The server reads each link, extracts the facts, and drafts on its own
 * once the post opens. The request ids are made once, when the form mounts, one per kind of post,
 * and each is the new post's id: a double submit or a "Try again" after a failure is still one
 * post, and the other kind is always another. A failure keeps every
 * field as typed (criterion 5); when no link could be read, each is listed.
 */
export function SourceForm({
  actions,
  postKind = 'feed',
  idea,
}: {
  /** The page passes the server actions by name. */
  actions: {
    makePostAction: (input: unknown) => Promise<Made>
    suggestSourcesAction: (input: unknown) => Promise<Suggested>
  }
  /** The page it is on: New feed post, or New blog (BR1), which opens on the idea start. */
  postKind?: PostKind
  /**
   * The idea it was opened with (lib/idea-start.ts): the form starts from an idea with it typed
   * in, and a queue idea's id goes with the make, which records the post on it.
   */
  idea?: IdeaStart | null
}) {
  const router = useRouter()
  const ids = useId()
  // One per kind: a lost response to a blog's make can never answer the feed post's, or back.
  const [requestIds] = useState<Record<PostKind, string>>(() => ({
    feed: crypto.randomUUID(),
    blog: crypto.randomUUID(),
  }))
  const [values, setValues] = useState<SourceValues>({
    // English unless the editor chooses another (GD36, GD29).
    language: 'en',
    links: '',
    framing: '',
    notes: '',
    text: '',
  })
  const [pasting, setPasting] = useState(false)
  const [start, setStart] = useState<Start>(idea || postKind === 'blog' ? 'idea' : 'blog')
  const fromIdea = start === 'idea'
  // It opens with the idea from the Ideas queue or an evidence gap.
  const [search, setSearch] = useState<IdeaSearch>({
    idea: idea?.text ?? '',
    found: null,
    ticked: [],
  })
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState(DEFAULT_KIND)
  // The page the post is made for (criterion 105); none until the editor picks one, since a new
  // post has no theme tag yet for the page rule (pages/index.ts) to read.
  const [page, setPage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<Failed[]>([])
  const [pending, startTransition] = useTransition()
  // Which press is making the post: the form's own button, or one of the idea's makes.
  const { mark, pressed } = usePress<'form' | PostKind>(pending)
  const making = pressed('form')
  const using = pressed('blog') ? 'blog' : pressed('feed') ? 'feed' : null
  const links = linkLines(values.links)
  // Pasted text needs its title; links alone may take the first page's.
  const pasted = pasting && values.text.trim() !== ''
  const empty = pasted ? title.trim() === '' : links.length === 0
  const blocked = empty || sourceFieldsError(values, pasting) !== null

  /**
   * Makes a post of `makes` from this source: the blog start's "Make post" (its links or pasted
   * text), or an idea's make with the ticked pages, or with none the idea itself.
   */
  const make = (
    sent: { links: string[]; title: string; kind: string; text: string },
    makes: PostKind,
    from: 'form' | PostKind,
  ) => {
    mark(from)
    setError(null)
    setFailed([])
    startTransition(async () => {
      try {
        const res = await actions.makePostAction({
          requestId: requestIds[makes],
          title: sent.title,
          kind: sent.kind,
          text: sent.text,
          links: sent.links,
          framing: values.framing,
          notes: values.notes,
          language: values.language,
          pageBrandId: page === '' ? null : page,
          postKind: makes,
          ...(idea?.ideaId ? { ideaId: idea.ideaId } : {}),
        })
        if (!res.ok) {
          setError(res.error)
          setFailed('failed' in res ? (res.failed ?? []) : [])
          return
        }
        toast.success('Ideas extracted')
        router.push(`/admin/posts/${res.id}`)
      } catch {
        setError(NETWORK_ERROR)
      }
    })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    // From an idea only its own makes send; a blog always makes a feed post (criterion 2).
    if (fromIdea || blocked) return
    const text = pasting ? values.text : ''
    make({ links, title: pasting ? title : '', kind, text }, 'feed', 'form')
  }

  /**
   * An idea's make: the ticked pages, or with none the idea alone as the source, titled by it. The
   * framing and notes go as their own fields, as always: they steer the post, never become facts.
   */
  const makeFromIdea = (urls: string[], makes: PostKind) => {
    if (urls.length > 0) {
      make({ links: urls, title: '', kind, text: '' }, makes, makes)
      return
    }
    const idea = search.idea.trim()
    make(
      { links: [], title: firstChars(idea, TITLE_MAX), kind: IDEA_KIND, text: idea },
      makes,
      makes,
    )
  }

  const form = (
    <form
      aria-label={postKind === 'blog' ? 'New blog' : 'New feed post'}
      onSubmit={submit}
      className="@container flex max-w-2xl min-w-0 flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <p id={`${ids}-start`} className="font-medium">
          Start from
        </p>
        {/* Two option cards: each card's title names its radio, its line describes it. */}
        <div
          role="radiogroup"
          aria-labelledby={`${ids}-start`}
          className="grid grid-cols-2 gap-3 @max-xl:grid-cols-1"
        >
          {STARTS.map((s) => (
            <label
              key={s.id}
              className="group relative grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 border border-foreground/25 py-3.5 pr-10 pl-3.5 transition-colors hover:border-foreground/55 has-checked:border-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
            >
              <input
                type="radio"
                name={`${ids}-start`}
                value={s.id}
                checked={start === s.id}
                aria-labelledby={`${ids}-start-${s.id}`}
                aria-describedby={`${ids}-start-${s.id}-about`}
                onChange={() => {
                  // A refusal belongs to the start that made it.
                  setStart(s.id)
                  setError(null)
                  setFailed([])
                }}
                className="peer sr-only"
              />
              <s.icon
                aria-hidden="true"
                strokeWidth={1.5}
                className="row-span-2 size-icon-lg text-accent-700"
              />
              <span id={`${ids}-start-${s.id}`} className="font-heading text-h4 font-semibold">
                {s.label}
              </span>
              <span
                id={`${ids}-start-${s.id}-about`}
                className="text-caption text-muted-foreground"
              >
                {s.about}
              </span>
              {/* The drawn radio: a ring, filled while chosen. */}
              <span
                aria-hidden="true"
                className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 rounded-full border border-foreground/45 peer-checked:border-accent-700 peer-checked:bg-[radial-gradient(circle,var(--color-accent-700)_0_0.25rem,transparent_0.2625rem)]"
              />
            </label>
          ))}
        </div>
      </div>
      <SourceFields
        values={values}
        onChange={setValues}
        pasting={pasting}
        onPaste={() => setPasting(true)}
        failed={failed}
        linksLabel="Blog link"
        sources={!fromIdea}
        pasteExtra={
          <div className="grid gap-4 @xl:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-title`}>Title</Label>
              <Input
                id={`${ids}-title`}
                value={title}
                onChange={(e) => setTitle(firstChars(e.target.value, TITLE_MAX))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-kind`}>Kind</Label>
              <Input
                id={`${ids}-kind`}
                value={kind}
                maxLength={60}
                onChange={(e) => setKind(e.target.value)}
              />
            </div>
          </div>
        }
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-page`}>Page</Label>
        <NativeSelect
          id={`${ids}-page`}
          value={page}
          aria-describedby={`${ids}-page-note`}
          onChange={(e) => setPage(e.target.value)}
        >
          <option value="">None</option>
          {FEED_POST_PAGES.map((b) => (
            <option key={b.id} value={b.id}>
              {b.instagram ? `${b.name} · @${b.instagram.handle}` : b.name}
            </option>
          ))}
        </NativeSelect>
        <p id={`${ids}-page-note`} className="text-caption text-muted-foreground">
          The drafts and covers follow its design language, if it has one.
        </p>
      </div>
      {fromIdea && (
        <IdeaSources
          find={actions.suggestSourcesAction}
          onUse={makeFromIdea}
          busy={pending}
          using={using}
          search={search}
          onSearch={setSearch}
        />
      )}
      {(!fromIdea || error) && (
        <div className="flex flex-wrap items-center gap-4">
          {!fromIdea && (
            <Button
              type="submit"
              disabled={blocked || pending}
              className="h-11 px-5 @max-xl:flex-1"
            >
              {making ? (
                <Spin />
              ) : (
                <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-icon" />
              )}
              {making ? 'Running…' : error ? 'Try again' : 'Make post'}
            </Button>
          )}
          {!making && (
            <Link href={BOARD_PATH} className={buttonVariants({ variant: 'text' })}>
              Cancel
            </Link>
          )}
          {making && <Working words={READING} />}
          {error && (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </form>
  )

  // A blog's steps are not a feed post's, so only New feed post lists them beside the form.
  if (postKind === 'blog') return form
  return (
    <div className="@container">
      <div className="grid items-start gap-8 @5xl:grid-cols-[minmax(0,1fr)_22rem]">
        {form}
        <WhatHappensNext />
      </div>
    </div>
  )
}
