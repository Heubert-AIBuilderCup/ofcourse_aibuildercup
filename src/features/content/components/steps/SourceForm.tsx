'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Textarea } from '@/shared/components/ui/textarea'
import type { SuggestedSource } from '../../ai/search'
import { FEED_POST_PAGES } from '../../brands'
import { LANGUAGES, type Language, type LanguageId } from '../../languages'
import type { IdeaStart } from '../../lib/idea-start'
import { SOURCE_ERRORS, SOURCE_LIMITS } from '../../model/artifacts'
import type { Made, Suggested } from '../../server/commands'
import { firstChars } from '../../text/script'

const NETWORK_ERROR = 'Could not reach the server. Please try again.'
const DEFAULT_KIND = 'research summary'

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
 * links that could not be read.
 */
export function SourceFields({
  values,
  onChange,
  pasting,
  onPaste,
  failed,
  pasteExtra,
}: {
  values: SourceValues
  onChange: (values: SourceValues) => void
  pasting: boolean
  onPaste: () => void
  failed: Failed[]
  pasteExtra?: ReactNode
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
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-links`}>Links</Label>
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
        {failed.length > 0 && (
          <ul aria-label="Links not read" className="flex flex-col gap-1 text-caption">
            {failed.map((f) => (
              <li key={f.url} className="wrap-anywhere text-destructive">
                {f.url}: {SOURCE_ERRORS.unread}
              </li>
            ))}
          </ul>
        )}
      </div>
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
      {pasting ? (
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
        <Button type="button" variant="outline" className="self-start" onClick={onPaste}>
          Paste text instead
        </Button>
      )}
    </>
  )
}

/** How many suggestions are ticked when they arrive: the official ones among them (GD29). */
const TOP_TICKED = 3

/**
 * "Start from an idea" (BR12, BR13): the idea, then "Find sources", which lists the pages Google
 * Search suggests with a tick each (the official ones of the top three ticked, GD29), their title,
 * site and why, and Google's search entry point in a sandboxed frame, as its grounding display
 * rules require: the markup is Google's, so it never runs in the page. "Use these" hands the
 * ticked pages on, in the list's order; nothing is used unticked.
 */
function IdeaSources({
  find,
  onUse,
  busy,
  initial = '',
}: {
  find: (input: unknown) => Promise<Suggested>
  onUse: (links: string[]) => void
  busy: boolean
  /** The idea it opens with, from the Ideas queue or an evidence gap. */
  initial?: string
}) {
  const ids = useId()
  const [idea, setIdea] = useState(initial)
  const [found, setFound] = useState<{
    sources: SuggestedSource[]
    entryPoint: string | null
  } | null>(null)
  const [ticked, setTicked] = useState<string[]>([])
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
        setFound({ sources: res.sources, entryPoint: res.entryPoint })
        setTicked(
          res.sources
            .slice(0, TOP_TICKED)
            .filter((s) => s.official)
            .map((s) => s.url),
        )
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
            {finding ? 'Finding…' : 'Find sources'}
          </Button>
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
          <div className="flex items-center gap-4">
            <Button
              type="button"
              disabled={busy || chosen.length === 0 || tooMany}
              onClick={() => onUse(chosen)}
            >
              Use these
            </Button>
            {tooMany && <p className="text-caption text-destructive">{SOURCE_ERRORS.links}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Links, or pasted text, with a framing line and notes, and "Make post" (criteria 93, 94;
 * GD18–GD21): the server reads each link, extracts the facts, and drafts on its own once the post
 * opens. The request id is made once, when the form mounts, and is the new post's id: a double
 * submit or a "Try again" after a failure is still one post. A failure keeps every field as typed
 * (criterion 5); when no link could be read, each is listed under the field. The blog form
 * (BR1) is the same, and its "Make blog" makes a blog.
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
  /** What "Make" makes: a feed post, or a blog. */
  postKind?: 'feed' | 'blog'
  /**
   * The idea it was opened with (lib/idea-start.ts): the form starts on "Start from an idea" with
   * it typed in, and a queue idea's id goes with "Make post", which records the post on it.
   */
  idea?: IdeaStart | null
}) {
  const noun = postKind === 'blog' ? 'blog' : 'post'
  const router = useRouter()
  const ids = useId()
  const [requestId] = useState(() => crypto.randomUUID())
  const [values, setValues] = useState<SourceValues>({
    // English unless the editor chooses another (GD36, GD29).
    language: 'en',
    links: '',
    framing: '',
    notes: '',
    text: '',
  })
  const [pasting, setPasting] = useState(false)
  const [fromIdea, setFromIdea] = useState(!!idea)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState(DEFAULT_KIND)
  // The page the post is made for (criterion 105); none until the editor picks one, since a new
  // post has no theme tag yet for the page rule (pages/index.ts) to read.
  const [page, setPage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<Failed[]>([])
  const [pending, startTransition] = useTransition()
  const links = linkLines(values.links)
  // Pasted text needs its title; links alone may take the first page's.
  const pasted = pasting && values.text.trim() !== ''
  const empty = pasted ? title.trim() === '' : links.length === 0
  const blocked = empty || sourceFieldsError(values, pasting) !== null

  /** "Make post" with these links, from the form or from "Use these". */
  const make = (sending: string[]) => {
    setError(null)
    setFailed([])
    startTransition(async () => {
      try {
        const res = await actions.makePostAction({
          requestId,
          title: pasting ? title : '',
          kind,
          text: pasting ? values.text : '',
          links: sending,
          framing: values.framing,
          notes: values.notes,
          language: values.language,
          pageBrandId: page === '' ? null : page,
          postKind,
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
    if (!blocked) make(links)
  }

  /** The ticked pages in the Links field, then "Make post" as for links (GD18, GD19, BR13). */
  const useSources = (urls: string[]) => {
    const next = { ...values, links: urls.join('\n') }
    setValues(next)
    // Pasted text with the links says so under the field, as typed links would.
    if (sourceFieldsError(next, pasting) === null) make(urls)
  }

  return (
    <Blueprint
      as="form"
      aria-label={postKind === 'blog' ? 'New blog' : 'New feed post'}
      onSubmit={submit}
      className="@container flex max-w-3xl flex-col gap-6 p-6"
    >
      <SourceFields
        values={values}
        onChange={setValues}
        pasting={pasting}
        onPaste={() => setPasting(true)}
        failed={failed}
        pasteExtra={
          <div className="grid gap-4 @xl:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-title`}>Title</Label>
              <Input
                id={`${ids}-title`}
                value={title}
                onChange={(e) => setTitle(firstChars(e.target.value, 200))}
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
      {fromIdea ? (
        <IdeaSources
          find={actions.suggestSourcesAction}
          onUse={useSources}
          busy={pending}
          initial={idea?.text}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setFromIdea(true)}
        >
          Start from an idea
        </Button>
      )}
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
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={blocked || pending}>
          {pending ? 'Running…' : error ? 'Try again' : `Make ${noun}`}
        </Button>
        {error && (
          <p role="alert" className="text-caption text-destructive">
            {error}
          </p>
        )}
      </div>
    </Blueprint>
  )
}
